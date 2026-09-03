#!/usr/bin/env python3
"""
瑞士景觀鐵道資料管線（RhB＋MGB 全網 ∪ 官方景觀類別全集）。

opentransportdata.swiss 的全國 GTFS 官方明文不提供 shapes.txt（上游 HAFAS 資料無幾何,
怕自動產生品質不佳,見 hand off/海外研究_2026-07-11/scenic_railways.md）。本腳本:
  1. 下載全國 GTFS(免註冊,CKAN 資源頁抓最新 GTFS_FP2026_*.zip permalink)。
  2. 篩出 RhB(agency_id 72)＋MGB(agency_id 48 fo / 93 bvz)的鐵路路線,聯集官方景觀類別全集
     (route_type=107 / route_desc=PE 的 10 條,橫跨 SBB／BLS／MOB／FART／Zentralbahn 等八家
     營運商)。兩個景觀判準若選到不同集合就中止,代表官方分類欄位變了。
  3. 用 Overpass 抓 OSM railway=narrow_gauge 與 railway=rail 兩套路網,**各建一張獨立的圖**
     (合圖會讓米軌路線在共用節點處抄標準軌捷徑),依路線營運商決定走哪張;圖內優先走已知營運商
     的軌道,缺口才退該軌距全圖,再退到直線。每條 GTFS 路線用當日聯合停靠站集合的「最遠兩端點」做 Dijkstra 取得真實線形
     (比對單一代表車次:多數路線同日有長短交路,單一代表車次涵蓋不了聯合站集合,故改用端點法+
     跨連通分量(如 Brig 折返)分段拼接)。
  4. 組一份自包含的合成 GTFS 目錄(agency/routes/trips[補 shape_id]/stop_times/stops/calendar/
     calendar_dates/shapes),丟給既有 scripts/gtfs2rail.mjs(唯讀,原樣呼叫)產生
     data/swiss.json + data/swiss_schedule_dense.json,schema 與 norway.json 同構。
  5. 驗證:站點到 shape 距離、d 單調遞增、抽驗車次、Albula 螺旋隧道座標密度檢查。

用法: SWISS_SCRATCH=<暫存目錄> python3 tools/build_swiss_shapes.py
      (暫存目錄放 241MB 的 GTFS zip 與解壓中繼檔;未設則用 ~/.cache/railisland-swiss)
"""
import csv
import io
import json
import math
import os
import re
import subprocess
import time
import urllib.parse
import urllib.request
from collections import deque

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
# 暫存區改吃環境變數：原本寫死的是某個 session 的 scratchpad，session 一結束就消失，
# 下次跑會靜默重下 500MB。SWISS_SCRATCH 未設就退到 repo 外的固定路徑。
SCRATCH = os.environ.get("SWISS_SCRATCH") or os.path.expanduser("~/.cache/railisland-swiss")
# Overpass 快取放暫存區,不放 repo 樹:它是衍生資料(單檔 12MB),而 repo 是 PUBLIC、
# 又沒有被 .gitignore 蓋到,留在 tools/ 底下遲早會被一次 `git add -A` 收進公開歷史。
CACHE = os.path.join(SCRATCH, "overpass_cache")
os.makedirs(SCRATCH, exist_ok=True)
os.makedirs(CACHE, exist_ok=True)

GTFS_ZIP = os.path.join(SCRATCH, "gtfs_fp2026.zip")
SYNTH_GTFS_DIR = os.path.join(SCRATCH, "synth_gtfs")
OUT_PREFIX = os.path.join(ROOT, "data", "swiss")

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")

RAIL_AGENCIES = {"72", "48", "93"}          # RhB, MGB(fo), MGB(bvz) 的完整路網
# 官方景觀類別:GTFS 的 route_desc="PE"(Panoramic Express)與 route_type=107 選到完全同一組
# 10 條路線(2026-08-29 版 feed 實測),故以 route_type 為準、route_desc 為交叉驗證。
SCENIC_ROUTE_TYPE = "107"
SCENIC_ROUTE_DESC = "PE"
# 景觀線橫跨八家營運商,不再只有 RhB/MGB
AGENCY_DISPLAY = {
    "72": "Rhätische Bahn", "48": "Matterhorn Gotthard Bahn", "93": "Matterhorn Gotthard Bahn",
    "11": "SBB", "33": "BLS", "49": "FART", "64": "MOB", "86": "Zentralbahn", "9999": "Glacier Express",
}
AGENCY_COLOR = {
    "72": "#D9291C", "48": "#1B3668", "93": "#1B3668",
    "11": "#EB0000", "33": "#005AA0", "49": "#E2001A", "64": "#0F5FA6", "86": "#C8102E", "9999": "#B01C2E",
}
DEFAULT_COLOR = "#666666"
# 標準軌營運商:其餘全是米軌。混成同一張圖會讓冰河快車在 Brig 被繞到辛普隆標準軌上,
# 所以兩種軌距各建一張圖,依路線的營運商分派。
STANDARD_GAUGE_AGENCIES = {"11", "33"}       # SBB(哥達全景 PE)、BLS(金色山口快車東段)
EXCLUDE_ROUTE_TYPES = {"700"}                # 巴士替代役

# 基準日:2026-09-05(週六)。整週聯集 46 條候選路線,週六到 45 條、只差「38」一條,
# 是七天裡最完整的;十條景觀線則每天都有班,不影響選日。
TARGET_DATE = "20260905"
TARGET_WEEKDAY_IDX = 5            # Mon=0..Sun=6, 週六=5

# OSM 的 operator 標籤值(用來挑「優先走這些營運商的軌道」的 op 圖;比對不到就退 full 圖)
OSM_OPERATORS = {
    "RhB", "Rhätische Bahn", "MGB", "Matterhorn Gotthard Bahn",
    "MOB", "Montreux-Oberland Bernois", "Chemin de fer Montreux Oberland bernois",
    "FART", "SSIF", "BLS", "BLS AG", "SBB", "SBB CFF FFS", "zb", "Zentralbahn",
}

OVERPASS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]


def log(*a):
    print(*a, flush=True)


# ══════════════════════════════════════════════════════════════════
# 1) 下載 GTFS(CKAN 資源頁抓最新 permalink;免註冊)
# ══════════════════════════════════════════════════════════════════
def discover_gtfs_url():
    req = urllib.request.Request(
        "https://data.opentransportdata.swiss/en/dataset/timetable-2026-gtfs2020",
        headers={"User-Agent": UA})
    html = urllib.request.urlopen(req, timeout=60).read().decode("utf-8", "ignore")
    blocks = re.findall(r'<li class="resource-item"[^>]*data-id="([a-f0-9-]+)"[^>]*>.*?title="([^"]+\.zip)"', html, re.S)
    # 取檔名日期最大者(GTFS_FP2026_YYYYMMDD.zip)
    best = None
    for rid, fname in blocks:
        m = re.search(r"(\d{8})", fname)
        if not m:
            continue
        d = m.group(1)
        if best is None or d > best[0]:
            best = (d, rid, fname)
    if not best:
        raise RuntimeError("CKAN 資源頁找不到 GTFS_FP2026_*.zip 連結")
    _, rid, fname = best
    res_url = f"https://data.opentransportdata.swiss/en/dataset/timetable-2026-gtfs2020/resource/{rid}"
    req = urllib.request.Request(res_url, headers={"User-Agent": UA})
    html2 = urllib.request.urlopen(req, timeout=60).read().decode("utf-8", "ignore")
    m = re.search(r'https://[a-zA-Z0-9./_%-]*' + re.escape(fname.lower()), html2)
    if not m:
        raise RuntimeError(f"resource 頁 {res_url} 找不到下載直連")
    return m.group(0), fname


def ensure_gtfs():
    if os.path.exists(GTFS_ZIP) and os.path.getsize(GTFS_ZIP) > 50_000_000:
        log(f"GTFS 已快取: {GTFS_ZIP} ({os.path.getsize(GTFS_ZIP)/1e6:.1f}MB)")
        return
    url, fname = discover_gtfs_url()
    log(f"下載 GTFS(免註冊): {fname}\n  {url}")
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=600) as r, open(GTFS_ZIP + ".part", "wb") as f:
        while True:
            chunk = r.read(1 << 20)
            if not chunk:
                break
            f.write(chunk)
    os.replace(GTFS_ZIP + ".part", GTFS_ZIP)
    log(f"下載完成: {os.path.getsize(GTFS_ZIP)/1e6:.1f}MB")


def stream_csv(entry):
    p = subprocess.Popen(["unzip", "-p", GTFS_ZIP, entry], stdout=subprocess.PIPE)
    return csv.DictReader(io.TextIOWrapper(p.stdout, encoding="utf-8-sig"))


# ══════════════════════════════════════════════════════════════════
# 2)-5) GTFS 篩選:候選路線 → 目標日期有效 trip 白名單 → 停靠站
# ══════════════════════════════════════════════════════════════════
def service_active(sid, calendar, exceptions):
    ex = exceptions.get(sid)
    if ex == "1":
        return True
    if ex == "2":
        return False
    c = calendar.get(sid)
    if not c:
        return False
    if TARGET_DATE < c["start_date"] or TARGET_DATE > c["end_date"]:
        return False
    days = [c["monday"], c["tuesday"], c["wednesday"], c["thursday"], c["friday"], c["saturday"], c["sunday"]]
    return days[TARGET_WEEKDAY_IDX] == "1"


def load_gtfs_subset():
    routes = {r["route_id"]: r for r in stream_csv("routes.txt")}
    scenic = {rid for rid, r in routes.items() if r["route_type"] == SCENIC_ROUTE_TYPE}
    by_desc = {rid for rid, r in routes.items() if r.get("route_desc") == SCENIC_ROUTE_DESC}
    if scenic != by_desc:
        raise RuntimeError(f"景觀類別兩個判準不一致:route_type={len(scenic)} vs route_desc={len(by_desc)};"
                           "官方 feed 的分類欄位變了,先查清楚再跑")
    cand_routes = {rid: r for rid, r in routes.items()
                   if (r["agency_id"] in RAIL_AGENCIES or rid in scenic)
                   and r["route_type"] not in EXCLUDE_ROUTE_TYPES}
    log(f"routes.txt: 候選 {len(cand_routes)} 條 = RhB/MGB 全網 ∪ 官方景觀類別 {len(scenic)} 條"
        f"(已排除 route_type=700 巴士)")

    calendar = {r["service_id"]: r for r in stream_csv("calendar.txt")}
    exceptions = {}
    for r in stream_csv("calendar_dates.txt"):
        if r["date"] == TARGET_DATE:
            exceptions[r["service_id"]] = r["exception_type"]

    trip_route = {}
    trip_service = {}
    for r in stream_csv("trips.txt"):
        if r["route_id"] not in cand_routes:
            continue
        if not service_active(r["service_id"], calendar, exceptions):
            continue
        trip_route[r["trip_id"]] = r["route_id"]
        trip_service[r["trip_id"]] = r["service_id"]
    log(f"trips.txt: 目標日期 {TARGET_DATE} 有效白名單 trip {len(trip_route)} 筆")
    if not trip_route:
        raise RuntimeError("白名單為空")

    trip_stops = {}   # tripId -> [(seq, stopId)]
    scanned = 0
    for r in stream_csv("stop_times.txt"):
        scanned += 1
        tid = r["trip_id"]
        if tid not in trip_route:
            continue
        trip_stops.setdefault(tid, []).append((int(r["stop_sequence"]), r["stop_id"]))
    log(f"stop_times.txt: 掃了 {scanned} 列,命中 trip {len(trip_stops)}")
    for lst in trip_stops.values():
        lst.sort()

    used_stop_ids = set(sid for lst in trip_stops.values() for _, sid in lst)
    stops = {}
    for r in stream_csv("stops.txt"):
        if r["stop_id"] in used_stop_ids:
            stops[r["stop_id"]] = {"name": r["stop_name"], "lat": float(r["stop_lat"]), "lon": float(r["stop_lon"])}
    log(f"stops.txt: 用到 {len(stops)} 站")

    agency_rows = list(stream_csv("agency.txt"))

    return {
        "routes": routes, "cand_routes": cand_routes,
        "trip_route": trip_route, "trip_service": trip_service,
        "trip_stops": trip_stops, "stops": stops,
        "calendar": calendar, "exceptions": exceptions,
        "agency_rows": agency_rows,
    }


# ══════════════════════════════════════════════════════════════════
# 6)-8) OSM Overpass 線形管線
# ══════════════════════════════════════════════════════════════════
def haversine(a, b):
    R = 6371.0
    la1, lo1, la2, lo2 = math.radians(a[0]), math.radians(a[1]), math.radians(b[0]), math.radians(b[1])
    dla, dlo = la2 - la1, lo2 - lo1
    h = math.sin(dla / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin(dlo / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


def overpass_fetch(bbox, cache_key):
    cf = os.path.join(CACHE, cache_key + ".json")
    if os.path.exists(cf):
        log(f"  (Overpass cache hit {cache_key})")
        return json.load(open(cf))
    query = (
        "[out:json][timeout:300];\n(\n"
        f'  way["railway"="narrow_gauge"]["service"!~"siding|yard|spur"]'
        f"({bbox[0]:.3f},{bbox[1]:.3f},{bbox[2]:.3f},{bbox[3]:.3f});\n"
        # 標準軌:金色山口快車東段(BLS Zweisimmen–Interlaken)與哥達全景(SBB)不在窄軌網上
        f'  way["railway"="rail"]["service"!~"siding|yard|spur"]'
        f"({bbox[0]:.3f},{bbox[1]:.3f},{bbox[2]:.3f},{bbox[3]:.3f});\n"
        ");\nout geom;\n"
    )
    data = urllib.parse.urlencode({"data": query}).encode()
    last = None
    for attempt in range(6):
        ep = OVERPASS[attempt % len(OVERPASS)]
        try:
            req = urllib.request.Request(ep, data=data, headers={"User-Agent": "rail-shape-swiss/1.0"})
            with urllib.request.urlopen(req, timeout=300) as r:
                out = json.loads(r.read().decode())
            json.dump(out, open(cf, "w"))
            log(f"  Overpass OK {ep.split('/')[2]}: {len(out.get('elements', []))} elements")
            return out
        except Exception as e:
            last = e
            log(f"  Overpass attempt {attempt+1} on {ep.split('/')[2]} failed: {e}; backing off")
            time.sleep(15 * (attempt + 1))
    raise last


def build_graph(ways):
    coord, adj = {}, {}
    for w in ways:
        nodes = w.get("nodes") or []
        geom = w.get("geometry") or []
        if len(nodes) != len(geom):
            continue
        for nid, g in zip(nodes, geom):
            if g is None:
                continue
            coord[nid] = (g["lat"], g["lon"])
        for i in range(len(nodes) - 1):
            a, b = nodes[i], nodes[i + 1]
            if a not in coord or b not in coord:
                continue
            d = haversine(coord[a], coord[b])
            adj.setdefault(a, []).append((b, d))
            adj.setdefault(b, []).append((a, d))
    return coord, adj


def bridge_gaps(coord, adj, threshold_km=0.05):
    """OSM 常見毛病:同一實體路軌在不同 way 段落數位化時未共用節點,造成拓撲圖出現本不該有的
    斷點(如 Reichenau-Tamins 附近實測缺口只有 24m)。用網格分桶找「不同連通分量但距離
    <threshold_km」的最近節點對,補一條真實距離的邊接起來。回傳補了幾條橋接邊。"""
    comp_of, _ = connected_components(coord, adj)
    cell = 0.01  # 分桶邊長 ~1.1km(緯度),留足搜尋鄰格margin
    grid = {}
    for nid, (lat, lon) in coord.items():
        key = (round(lat / cell), round(lon / cell))
        grid.setdefault(key, []).append(nid)
    best_bridge = {}  # frozenset({compA,compB}) -> (dist, nodeA, nodeB)
    for nid, (lat, lon) in coord.items():
        ca = comp_of[nid]
        cx, cy = round(lat / cell), round(lon / cell)
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for other in grid.get((cx + dx, cy + dy), ()):
                    if other == nid:
                        continue
                    cb = comp_of[other]
                    if cb == ca:
                        continue
                    d = haversine((lat, lon), coord[other])
                    if d > threshold_km:
                        continue
                    key = frozenset((ca, cb))
                    if key not in best_bridge or d < best_bridge[key][0]:
                        best_bridge[key] = (d, nid, other)
    for (d, na, nb) in best_bridge.values():
        adj.setdefault(na, []).append((nb, d))
        adj.setdefault(nb, []).append((na, d))
    return len(best_bridge)


def connected_components(coord, adj):
    visited = set()
    comp_of = {}
    comps = []
    for start in coord:
        if start in visited:
            continue
        idx = len(comps)
        members = []
        q = deque([start])
        visited.add(start)
        while q:
            u = q.popleft()
            members.append(u)
            comp_of[u] = idx
            for v, _ in adj.get(u, ()):
                if v not in visited:
                    visited.add(v)
                    q.append(v)
        comps.append(members)
    return comp_of, comps


def nearest_node(coord, pt, node_pool=None):
    pool = node_pool if node_pool is not None else coord.keys()
    best, bd = None, 1e18
    for nid in pool:
        d = haversine(pt, coord[nid])
        if d < bd:
            bd, best = d, nid
    return best, bd


def dijkstra(adj, coord, src, dst, max_km=250):
    if src == dst:
        return [src]
    dist = {src: 0.0}
    prev = {}
    import heapq
    pq = [(0.0, src)]
    while pq:
        d, u = heapq.heappop(pq)
        if u == dst:
            break
        if d > dist.get(u, 1e18):
            continue
        if d > max_km:
            continue
        for v, w in adj.get(u, ()):
            nd = d + w
            if nd < dist.get(v, 1e18):
                dist[v] = nd
                prev[v] = u
                heapq.heappush(pq, (nd, v))
    if dst not in prev and dst != src:
        return None
    path = [dst]
    while path[-1] != src:
        p = prev.get(path[-1])
        if p is None:
            return None
        path.append(p)
    path.reverse()
    return path


def path_polyline_and_len(path, coord):
    pts = [coord[n] for n in path]
    tot = 0.0
    for i in range(1, len(pts)):
        tot += haversine(pts[i - 1], pts[i])
    return pts, tot


def project_point_to_polyline(pt, poly):
    """回傳 (最近距離km, 投影弧長km)。poly 為 [(lat,lon),...],沿線累積弧長。"""
    best_dist, best_s = 1e18, 0.0
    cum = 0.0
    for j in range(len(poly) - 1):
        a, b = poly[j], poly[j + 1]
        k = math.cos(math.radians(a[0]))
        ax, ay = a[1] * k, a[0]
        bx, by = b[1] * k, b[0]
        px, py = pt[1] * k, pt[0]
        vx, vy = bx - ax, by - ay
        L2 = vx * vx + vy * vy
        t = 0.0 if L2 == 0 else max(0.0, min(1.0, ((px - ax) * vx + (py - ay) * vy) / L2))
        qlat = a[0] + (b[0] - a[0]) * t
        qlon = a[1] + (b[1] - a[1]) * t
        dd = haversine(pt, (qlat, qlon))
        seg_len = haversine(a, b)
        s = cum + seg_len * t
        if dd < best_dist:
            best_dist, best_s = dd, s
        cum += seg_len
    return best_dist, best_s


DETOUR_SANITY_RATIO = 2.0   # op 圖路徑超過直線這個倍數就不直接採用,改跟 full 圖比一次取較短者


def route_one_pair(a_pt, b_pt, coord_op, adj_op, coord_full, adj_full):
    """單一端點對:先在 op 圖找路,失敗退到 full 圖,再失敗直線退。回傳 (poly[(lat,lon)], used, fallback_flag)

    原本只要 op 圖「找得到路」就採用,對「找到一條荒謬的路」完全沒有判斷,而退 full 圖只在
    完全找不到時才發生。實測 R38 的 Domat/Ems→Domat/Ems Werk 直線 1.87km,op 圖繞 7.64km、
    full 圖只要 2.83km——多出來的那段折返會讓 gtfs2rail 的 projectAll 對同一個站投影出多個
    位置,成品站列因此印出「Felsberg → Domat/Ems → Felsberg → Felsberg」。
    所以 op 圖路徑明顯過長時多花一次 Dijkstra 比 full 圖,取較短者:這一步只可能縮短路徑,
    而且正常的跳(全網 518 跳裡的中位數是直線的 1.08 倍)會在第一個 return 就走掉,不付代價。
    門檻 2.0 是量出來的,而且刻意訂在真實山岳幾何(Klosters→Cavadürli 4.3、Alp Grüm 的馬蹄彎
    4.0)**之下**:那些跳的 op 與 full 長度完全相同,多比一次不會改變結果,所以門檻訂低只是多花
    Dijkstra、不會為它們選錯路。反過來訂高會漏掉真的假折返——實測 RE8 的 Domat/Ems→Bonaduz
    op 13.01km、full 只要 7.26km,比值 2.6,訂 3.0 就抓不到。全網 518 跳的比值中位數 1.08、
    p90 1.47,所以絕大多數跳仍在第一個 return 就採用 op 圖,營運商優先沒有被放棄。"""
    straight = haversine(a_pt, b_pt)
    best = None                      # (km, poly, used)
    na, da = nearest_node(coord_op, a_pt)
    nb, db = nearest_node(coord_op, b_pt)
    if da < 0.3 and db < 0.3:
        p = dijkstra(adj_op, coord_op, na, nb)
        if p:
            poly, km = path_polyline_and_len(p, coord_op)
            if km <= straight * DETOUR_SANITY_RATIO + 0.5:
                return poly, "op", False
            best = (km, poly, "op")
    # 退到全 narrow_gauge 圖(含非 RhB/MGB tag 但實體相連的路段)
    na2, da2 = nearest_node(coord_full, a_pt)
    nb2, db2 = nearest_node(coord_full, b_pt)
    if da2 < 0.3 and db2 < 0.3:
        p = dijkstra(adj_full, coord_full, na2, nb2)
        if p:
            poly, km = path_polyline_and_len(p, coord_full)
            if best is None or km < best[0]:
                best = (km, poly, "full")
    if best is not None:
        return best[1], best[2], False
    return [a_pt, b_pt], "straight", True


def order_stops_for_segment(mem, order_hint):
    """回傳這一段的停靠順序。骨架用「代表車次的實際停靠序列」——那是營運商給的真實站序。

    原本是用「最遠兩端點連線的投影」排序,對彎折的路網會排錯:RhB 的
    Chur–Thusis–Filisur–St. Moritz 是個大 Z 字,投影到一條直線之後站序被打亂,
    接著逐站 Dijkstra 就一路來回折返。實測 BEX 兩端只差 88km 卻畫出 363km,
    53% 的網格被走過兩次以上;R38 更誇張,迂迴比 7.8。
    代表車次沒涵蓋到的站,用「插入後增加的直線里程最小」的位置補進去,不再用投影。
    """
    # 按車站去重:同一條線的去程與回程在 GTFS 裡是不同的 stop_id,但指的是同一個車站。
    # 不去重的話每個站會出現兩次,排序後就變成「走到底再折回來」。
    # 用官方 stop_id 裡的車站段,不用幾何網格——網格在邊界會把同一個車站的兩個月台
    # 切成兩格(見 station_key 的說明)。
    pt_of = {}                      # stationKey -> pt(首見者)
    key_of_sid = {}
    for sid, pt in mem:
        k = station_key(sid)
        pt_of.setdefault(k, pt)
        key_of_sid.setdefault(sid, k)

    seq = list(dict.fromkeys(key_of_sid[sid] for sid in order_hint if sid in key_of_sid))
    rest = [k for k in pt_of if k not in set(seq)]

    if len(seq) < 2:
        # 代表車次幾乎沒涵蓋這一段(例如跨連通分量的另一半),退回原本的投影排序
        pts = list(dict.fromkeys(pt_of.values()))
        if len(pts) < 2:
            return pts
        best_pair, best_d = (pts[0], pts[1]), -1
        for i in range(len(pts)):
            for j in range(i + 1, len(pts)):
                d = haversine(pts[i], pts[j])
                if d > best_d:
                    best_d, best_pair = d, (pts[i], pts[j])
        a, b = best_pair
        ax_lat, ax_lon = b[0] - a[0], b[1] - a[1]
        return sorted(pts, key=lambda q: (q[0] - a[0]) * ax_lat + (q[1] - a[1]) * ax_lon)

    for key in rest:
        q = pt_of[key]
        best_k, best_add = 0, None
        for k in range(len(seq) + 1):
            a = pt_of[seq[k - 1]] if k > 0 else None
            b = pt_of[seq[k]] if k < len(seq) else None
            if a is None:
                add = haversine(q, b)
            elif b is None:
                add = haversine(a, q)
            else:
                add = haversine(a, q) + haversine(q, b) - haversine(a, b)
            if best_add is None or add < best_add:
                best_add, best_k = add, k
        seq.insert(best_k, key)

    out = []
    for key in seq:
        q = pt_of[key]
        if not out or q != out[-1]:
            out.append(q)
    return out


def build_route_shape(union_stop_pts, comp_of_full, coord_op, adj_op, coord_full, adj_full, order_hint):
    """union_stop_pts: [(stopId,(lat,lon))]。order_hint: 代表車次的 stopId 順序(可能不含全部站),
    用來判斷跨連通分量時的段落先後。回傳 (shape:[[lat,lon]], fallback_hops, seg_breaks)

    分段用「全 narrow_gauge 連通分量」(comp_of_full)判斷,不是只看 operator=RhB/MGB 的窄圖──
    實測 MGB Andermatt–Göschenen(Schöllenen 線 ref=611)整段 OSM way 都沒有 operator 標籤,
    若只用 operator 圖分段會把 Göschenen 誤判成「不屬於任何分量」而整站漏掉建線,車站本身
    座標沒錯,但畫出來的線完全繞過該站(實測偏差達 3.2km)。分段放寬到全圖,實際逐站 Dijkstra
    路由仍在 route_one_pair() 裡優先試 operator 圖、退full圖、再退直線,精度不受影響。"""
    # 分配每站所屬連通分量(用全 narrow_gauge 圖,含未標 operator 但實體相連的路段)
    stop_comp = {}
    for sid, pt in union_stop_pts:
        nid, dist = nearest_node(coord_full, pt)
        stop_comp[sid] = comp_of_full.get(nid) if dist < 0.3 else None

    def seg_order_key(comp):
        for sid in order_hint:
            if stop_comp.get(sid) == comp:
                return order_hint.index(sid)
        return 10 ** 9

    comps_present = sorted(set(c for c in stop_comp.values() if c is not None), key=seg_order_key)
    if not comps_present:
        comps_present = [None]

    full_shape = []
    fallback_hops = 0
    seg_breaks = []
    for ci, comp in enumerate(comps_present):
        mem = [(sid, pt) for sid, pt in union_stop_pts if stop_comp.get(sid) == comp]
        if len(mem) < 2:
            full_shape.extend([pt for _, pt in mem])
            continue
        # 站序照代表車次的真實停靠順序(見 order_stops_for_segment)。
        # 排好序之後才逐站相鄰 Dijkstra ── 不能對「最遠兩端點」直接跑單趟長程 Dijkstra:
        # Chur 這類多線交會樞紐,圖上真正最短路徑常會抄到別條支線繞一大圈(實測
        # Thusis↔Schiers 最短路徑長達 81km,抄去 Filisur/Davos 方向,而非直達的 35km 正線)。
        # 每一段都是幾公里的短程,不會被全域最短路徑帶偏,做法比照 fetch_shapes.py 對
        # TRA/MRT 的既有慣例(相鄰站逐段路由)。
        ordered = order_stops_for_segment(mem, order_hint)
        if len(ordered) < 2:
            full_shape.extend(ordered)
            continue
        if full_shape:
            seg_breaks.append(len(full_shape))
        full_shape.append(ordered[0])
        for i in range(1, len(ordered)):
            poly, used, fb = route_one_pair(ordered[i - 1], ordered[i], coord_op, adj_op, coord_full, adj_full)
            if fb:
                fallback_hops += 1
            full_shape.extend(poly)  # poly 首尾是「吸附後」節點座標,跟前一站原始座標會差幾公尺,可忽略
    return full_shape, fallback_hops, seg_breaks


# ══════════════════════════════════════════════════════════════════
# main
# ══════════════════════════════════════════════════════════════════
# ══════════════════════════════════════════════════════════════════
# 服務型態拆線
# ══════════════════════════════════════════════════════════════════
# 一個 GTFS route_id 常混著多條**實體走法**。BEX(伯連納快車)當日 10 個 trip 其實是兩條:
#   Chur–(阿爾布拉線)–Tirano 15 站,與 St. Moritz–(伯連納線)–Tirano 8 站。
# 把兩者的聯集當成一條線來排序,折線必然來回折返(實測兩端直線差 88km 卻畫出 269km)。
# 這一組函式把每條 route 拆成若干「服務型態」,每個型態各自成為一條線。
MERGE_EXTRA_KM = 5.0      # 合併後總直線里程相對較長者容許的增量上限(公里),純安全網


def station_key(stop_id):
    """車站識別:直接取官方 stop_id 裡的車站段,不用幾何網格。

    網格量化有邊界假象——迪森蒂斯各月台實際只差 15m,但經度乘 700 取整分別落在
    6198 與 6199,同一條走法因此被誤判成兩種型態。網格只保證「同格必近」,
    不保證「相近必同格」。瑞士 GTFS 的 stop_id 本身就帶車站 id(sloid)與月台後綴:
        ch:1:sloid:1300:2:5                          → ch:1:sloid:1300
        ch:1:sloid:9179_gen:ch:1:sloid:9179:0:110081 → ch:1:sloid:9179
        8301003_gen:missingSLOID_pf:31               → 8301003
    實測 348 個 stop_id 收斂成 213 個車站,三道閘門全過(同鍵點距 ≤300m、同鍵同名、
    沒有同名被拆成多鍵)——閘門在 verify_station_keys() 裡,每次建置都會跑。
    """
    base = stop_id.split("_gen", 1)[0]
    m = re.match(r"^(ch:\d+:sloid:\d+)(?::.*)?$", base)
    if m:
        return m.group(1)
    m = re.match(r"^(\d+)", base)
    if m:
        return m.group(1)
    return base


def verify_station_keys(stops):
    """車站識別的三道閘門。解析規則是對官方 id 格式的假設,格式一變就要當場炸,
    不能讓它靜默把兩個車站併成一個(線形會少站)或把一個拆成兩個(線形會多折返)。"""
    by = {}
    for sid, st in stops.items():
        by.setdefault(station_key(sid), []).append((sid, st))
    far, mixed = [], []
    for k, v in by.items():
        pts = [(st["lat"], st["lon"]) for _, st in v]
        if len(pts) > 1:
            d = max(haversine(a, b) for a in pts for b in pts)
            if d > 0.3:
                far.append((k, round(d * 1000)))
        if len({st["name"] for _, st in v}) > 1:
            mixed.append((k, sorted({st["name"] for _, st in v})))
    byname = {}
    for k, v in by.items():
        for _, st in v:
            byname.setdefault(st["name"], set()).add(k)
    split = [(n, sorted(ks)) for n, ks in byname.items() if len(ks) > 1]
    if far or mixed or split:
        raise RuntimeError(
            f"車站識別解析失敗,官方 stop_id 格式可能變了:"
            f"同鍵點距超過 300m {far[:5]};同鍵異名 {mixed[:5]};同名被拆多鍵 {split[:5]}")
    log(f"車站識別:{len(stops)} 個 stop_id → {len(by)} 個車站(三道閘門全過)")
    return by


def _is_subseq(a, b):
    """a 是 b 的子序列嗎(不必連續)。"""
    it = iter(b)
    return all(x in it for x in a)


def _absorbed_by(a, b):
    """a 或其反轉是 b 的子序列嗎。

    雙向的理由:方向正規化是各自比較首末站鍵決定的,兩個端點集合不同的序列很容易
    選到相反的朝向(例 91-GEX-j26-1 的 2 站型態 Chur → Disentis 相對 6 站型態是反向)。

    誠實話:**在目前這份資料上,改成單向的結果與雙向逐字相同**(比對含站序、朝向與
    每個 trip 歸屬的完整指紋)。因為後面的合併步驟本來就會試 b 的反轉,反向的子序列
    在那裡也會被吸收掉。保留雙向是讓「吸收」這一步自己語意完整,不是靠下游補救,
    但它現在不是承重的判準——別把它當成「有牙的閘門」引用。
    """
    return _is_subseq(a, b) or _is_subseq(tuple(reversed(a)), b)


def _order_compatible(a, b):
    """共同站(至少 2 個)在雙方的相對順序是否完全一致。"""
    common = set(a) & set(b)
    if len(common) < 2:
        return False
    return [x for x in a if x in common] == [x for x in b if x in common]


def _scs_merge(a, b):
    """兩個順序相容的序列合成最短共同超序列;走不下去就回 None。

    結尾兩道守門是刻意的。原本那裡是「輸出去重」,遇到折返或環狀(同一站在序列裡
    出現兩次)會把第二次出現**靜默刪掉**:合併結果不再是輸入的超序列,那條 trip 的
    折返腿就在成品裡消失,而線數、trip 數都對得上,看不出來。今天這 45 條 route、
    1013 個 trip 實測 0 個非相鄰重複,但換基準日或官方改點就會踩到,所以改成偵測
    到就拒絕合併——寧可多留一條線,不要吐出壞掉的站序。
    """
    i = j = 0
    out = []
    while i < len(a) and j < len(b):
        if a[i] == b[j]:
            out.append(a[i]); i += 1; j += 1
        elif a[i] not in b[j:]:
            out.append(a[i]); i += 1
        elif b[j] not in a[i:]:
            out.append(b[j]); j += 1
        else:
            return None
    out.extend(a[i:])
    out.extend(b[j:])
    if len(set(out)) != len(out):
        return None                    # 有站重複出現(折返/環狀)→ 不合併
    m = tuple(out)
    if not (_is_subseq(a, m) and _is_subseq(b, m)):
        return None                    # 不變式:合併結果必須是雙方的超序列
    return m


def _is_subpath(inner, outer):
    """inner 的兩個端點是否都落在 outer 的站集裡——即 inner 是 outer 的一段,不是分支。

    這是「該不該合併」的關鍵判準,而**距離不是**。實測數字:
      BEX 的分支型態(St. Moritz–Tirano)硬合進主型態時,St. Moritz 會被插在
      Bergün/Bravuogn 與 Pontresina 之間,直線增量只有約 2 公里——因為聖莫里茲本來就在
      那兩站的直線附近。可是鐵路上那是另一條走法(阿爾布拉線 vs 伯連納線),必須留成兩條線。
      反過來 GEX 兩個型態只差 Tiefencastel/Filisur 一站,直線增量約 3 公里,卻是同一條走法。
    也就是說,任何直線距離門檻都會同時弄錯這兩個——2 公里放行 BEX、3 公里擋掉 GEX。
    改看拓樸:端點都在對方裡面 ⇒ 子路徑,可以合;端點是對方沒有的站 ⇒ 分支,不能合。
      S 線 型態2(Chur–Landquart)兩端都在 型態1(Schiers–Thusis)裡 ⇒ 合併 ✓
      BEX 型態2 的 St. Moritz 不在 型態1 裡 ⇒ 不合 ✓
      R15 型態2 的 Pontresina 不在 型態1 裡 ⇒ 不合 ✓
    """
    outer_set = set(outer)
    return inner[0] in outer_set and inner[-1] in outer_set


def _seq_km(seq, pt_of):
    return sum(haversine(pt_of[a], pt_of[b]) for a, b in zip(seq, seq[1:]))


def _fold_patterns(pats, pt_of):
    """pats: {序列 tuple -> set(tripId)}。反覆吸收與合併,直到收斂。

    順序固定(依 -長度、再依序列本身)才不會因為配對順序不同而給出不同的型態集。
    """
    def key(t):
        return (-len(t), t)

    changed = True
    while changed:
        changed = False
        order = sorted(pats, key=key)
        # 1) 吸收:a(或其反轉)是 b 的子序列 → a 併入 b
        for a in order:
            if a not in pats:
                continue
            for b in order:
                if b is a or b not in pats or a not in pats or a == b:
                    continue
                if len(a) <= len(b) and _absorbed_by(a, b):
                    pats[b] |= pats.pop(a)
                    changed = True
                    break
            if changed:
                break
        if changed:
            continue
        # 2) 合併:順序相容(任一朝向)、一方是另一方的子路徑、且總里程沒暴增 → 合成超序列。
        #    從**所有**可行配對裡挑「共同站最多」的那一組,不是掃到的第一組。
        #    貪婪取第一組會有順序依賴:實測放寬里程安全網之後 BEX 反而從 2 個型態變成 3 個
        #    (先成立的一次合併吃掉了兩個型態,擋住後面更好的摺疊)。條件放寬卻得到更多型態
        #    是非單調的,代表結果取決於掃描順序而不是判準本身。挑重疊最大的可以讓
        #    「最像同一條走法」的先合,結果只由判準決定。
        order = sorted(pats, key=key)
        best = None
        for ai in range(len(order)):
            for bi in range(ai + 1, len(order)):
                a, b = order[ai], order[bi]
                for cand in (b, tuple(reversed(b))):
                    if not _order_compatible(a, cand):
                        continue
                    if not (_is_subpath(cand, a) or _is_subpath(a, cand)):
                        continue
                    m = _scs_merge(a, cand)
                    if m is None:
                        continue
                    if _seq_km(m, pt_of) > max(_seq_km(a, pt_of), _seq_km(cand, pt_of)) + MERGE_EXTRA_KM:
                        continue
                    # 排序鍵:共同站多者優先;同分再比合併後里程小者、最後比序列本身求確定性
                    score = (-len(set(a) & set(cand)), _seq_km(m, pt_of), m)
                    if best is None or score < best[0]:
                        best = (score, a, b, m)
        if best is not None:
            _, a, b, m = best
            pats[m] = pats.pop(a) | pats.pop(b)
            changed = True
    return pats


def _terminus_tag(pt_name):
    """端點站名壓成可放進線 id 的短標籤。"""
    t = re.sub(r"[^0-9A-Za-zÀ-ÿ]+", "", pt_name.split("(")[0])
    return t[:14] or "X"


def split_route_patterns(trip_route, trip_stops, stops, cand_routes):
    """把每條 route 拆成服務型態。回傳 (pattern_of_trip, pattern_routes, pattern_order)。

    trip 歸屬靠**來源追蹤**而不是事後比對:每個相異序列一開始就帶著自己的 trip 集合,
    吸收與合併時把集合搬過去。事後用「這個 trip 是不是該型態的子序列」去回推的話,
    對不到的 trip 會靜默消失、對到多個的無從裁決——而少掉的車次在成品裡看不出來。
    """
    verify_station_keys(stops)
    rep_stop, pt_of = {}, {}
    for sid, st in stops.items():
        k = station_key(sid)
        if k not in rep_stop:
            rep_stop[k] = sid
            pt_of[k] = (st["lat"], st["lon"])

    by_route = {}
    for tid, rid in trip_route.items():
        by_route.setdefault(rid, []).append(tid)

    pattern_of_trip, pattern_routes, pattern_order = {}, {}, {}
    n_short = 0
    for rid in sorted(by_route):
        tids = by_route[rid]
        pats = {}
        for tid in tids:
            seq = []
            for _, sid in sorted(trip_stops.get(tid, [])):
                k = station_key(sid)
                if not seq or seq[-1] != k:
                    seq.append(k)
            if len(seq) < 2:
                n_short += 1
                continue
            t = tuple(seq)
            if t[0] > t[-1]:
                t = tuple(reversed(t))
            pats.setdefault(t, set()).add(tid)
        if not pats:
            continue
        n_raw = len(pats)
        pats = _fold_patterns(pats, pt_of)

        # 閘門:每個 trip 恰好落在一個型態裡,總數守恆
        assigned = [t for v in pats.values() for t in v]
        if len(assigned) != len(set(assigned)):
            raise RuntimeError(f"{rid}: 有 trip 落在多個型態裡")
        if len(assigned) + sum(1 for t in tids if len(trip_stops.get(t, [])) < 2) != len(tids):
            raise RuntimeError(f"{rid}: trip 總數不守恆 {len(assigned)} vs {len(tids)}")

        base = cand_routes[rid]
        short = base["route_short_name"] or rid
        ordered = sorted(pats, key=lambda t: (-len(t), t))
        multi = len(ordered) > 1
        used = set()
        # 短名不只決定線 id,還會漏進車次代碼:gtfs2rail.mjs:390 用
        # `{route_short_name}-{時分}` 當 train code,跟車面板與 ?train= 深連結都看得到。
        # 所以只把「真的有差異的那一端」寫進去——BEX 兩條都到 Tirano,差在 Chur /
        # St. Moritz,命名成 BEX-Chur / BEX-StMoritz,車次代碼就還是 BEX-Chur-0730。
        heads = {s[0] for s in ordered}
        tails = {s[-1] for s in ordered}
        nm = lambda k: _terminus_tag(stops[rep_stop[k]]["name"])
        for seq in ordered:
            if multi:
                # 會分岔的 route:每條都用端點命名,不設「主線」。
                # 用排名(-2、-3)的話,下次重建若站數互換,兩條線就會互換身分。
                if len(tails) == 1 and len(heads) > 1:
                    tag = f"{short}-{nm(seq[0])}"
                elif len(heads) == 1 and len(tails) > 1:
                    tag = f"{short}-{nm(seq[-1])}"
                else:
                    tag = f"{short}-{nm(seq[0])}-{nm(seq[-1])}"
                stem, n = tag, 2
                while tag in used:
                    tag = f"{stem}-{n}"; n += 1
            else:
                tag = short          # 單一型態的 route 維持原短名,線 id 零變動
            used.add(tag)
            pid = f"{rid}::{tag}"
            r = dict(base)
            r["route_id"] = pid
            r["route_short_name"] = tag
            pattern_routes[pid] = r
            pattern_order[pid] = [rep_stop[k] for k in seq]
            for tid in pats[seq]:
                pattern_of_trip[tid] = pid
        if multi:
            log(f"  拆線 {short}({rid}): {len(tids)} trip、{n_raw} 個相異序列 → {len(ordered)} 條線 "
                + "; ".join(f"{stops[rep_stop[q[0]]]['name']}–{stops[rep_stop[q[-1]]]['name']}({len(q)}站,{len(pats[q])}trip)"
                            for q in ordered))
    if n_short:
        log(f"  ⚠ 略過停靠少於 2 站的 trip {n_short} 筆")
    log(f"服務型態拆線:{len(by_route)} 條 route → {len(pattern_routes)} 條線"
        f"(其中 {sum(1 for r in by_route if sum(1 for p in pattern_routes.values() if p['route_id'].startswith(r + '::')) > 1)} 條 route 有多條走法)")
    return pattern_of_trip, pattern_routes, pattern_order


def sanitize(s):
    return re.sub(r"[^A-Za-z0-9_-]", "", s)


def main():
    ensure_gtfs()
    g = load_gtfs_subset()
    routes, cand_routes = g["routes"], g["cand_routes"]
    trip_route, trip_stops, stops = g["trip_route"], g["trip_stops"], g["stops"]

    # 先把每條 route 拆成服務型態,之後整條管線都以「型態」為單位,一個型態一條線。
    # 原本是把一條 route 當日所有 trip 的停靠站取聯集、再挑「站最多的代表車次」定順序——
    # 對混了多條走法的 route(BEX 同時有阿爾布拉線與伯連納線)必然畫出來回折返的折線。
    pattern_of_trip, pattern_routes, pattern_order = split_route_patterns(
        trip_route, trip_stops, stops, cand_routes)
    trip_route = dict(pattern_of_trip)
    cand_routes = pattern_routes
    # 型態序列本身就是正確的站序(直接來自真實班次的停靠順序),不必再聯集後另行排序
    route_union = pattern_order
    route_rep_order = pattern_order

    # bbox(含 5% 邊界緩衝)
    all_pts = [(stops[sid]["lat"], stops[sid]["lon"]) for u in route_union.values() for sid in u]
    lat0, lat1 = min(p[0] for p in all_pts) - 0.05, max(p[0] for p in all_pts) + 0.05
    lon0, lon1 = min(p[1] for p in all_pts) - 0.05, max(p[1] for p in all_pts) + 0.05
    log(f"OSM bbox: lat[{lat0:.3f},{lat1:.3f}] lon[{lon0:.3f},{lon1:.3f}]")

    osm = overpass_fetch((lat0, lon0, lat1, lon1), "swiss_scenic_v2")
    all_ways = [e for e in osm["elements"] if e.get("type") == "way"]

    # 兩種軌距各建一張獨立的圖。**不可以合成一張**:米軌與標準軌在 Brig、Interlaken Ost、
    # Zweisimmen 等站的 OSM 節點常常是共用的,合圖之後 Dijkstra 會讓冰河快車(米軌)沿辛普隆
    # 標準軌線抄捷徑,畫出一條實際上不存在的路徑。
    def gauges_of(w):
        return set((w.get("tags", {}).get("gauge") or "").split(";"))

    G = {}
    for gauge, tag in (("narrow", "narrow_gauge"), ("rail", "rail")):
        if gauge == "narrow":
            # 米軌圖要收「三軌雙軌距」路段:Chur 站區有 15 條 RhB 軌道標成
            # railway=rail + gauge=1000;1435(米軌與標準軌共用同一段路基),只認
            # railway=narrow_gauge 的話,米軌網會在 Chur 整個斷開——實測 Chur West→Chur
            # 直線 1.13km 卻要繞 133km(佔 S 線全長 199km 的三分之二),而且退到全窄軌圖
            # 也一樣,因為那段路本來就不在窄軌圖裡。全快取只有 51 條這種路段
            # (全部 gauge=1000;1435),納入不會把標準軌專用線帶進來:純 1435 仍被排除。
            ways = [w for w in all_ways
                    if w.get("tags", {}).get("railway") == "narrow_gauge" or "1000" in gauges_of(w)]
        else:
            ways = [w for w in all_ways if w.get("tags", {}).get("railway") == tag]
        op_ways = [w for w in ways if w.get("tags", {}).get("operator") in OSM_OPERATORS]
        coord_op, adj_op = build_graph(op_ways)
        coord_full, adj_full = build_graph(ways)
        nb_op = bridge_gaps(coord_op, adj_op)
        nb_full = bridge_gaps(coord_full, adj_full)
        comp_of_op, comps = connected_components(coord_op, adj_op)
        comp_of_full, comps_full = connected_components(coord_full, adj_full)
        G[gauge] = dict(coord_op=coord_op, adj_op=adj_op, coord_full=coord_full,
                        adj_full=adj_full, comp_of_full=comp_of_full)
        log(f"OSM {tag}: ways {len(ways)} 條,已知營運商 {len(op_ways)} 條;"
            f"op圖 {len(coord_op)} nodes/{len(comps)} 分量、full圖 {len(coord_full)} nodes/{len(comps_full)} 分量;"
            f"橋接邊 op {nb_op}/full {nb_full}")

    # 逐路線建 shape
    line_shapes = {}    # routeId -> {'shape':[[lat,lon]...], 'fallback_hops':n}
    total_fb = 0
    for rid, union in route_union.items():
        pts = [(sid, (stops[sid]["lat"], stops[sid]["lon"])) for sid in union]
        order_hint = route_rep_order[rid] if route_rep_order[rid] else union
        gauge = "rail" if cand_routes[rid]["agency_id"] in STANDARD_GAUGE_AGENCIES else "narrow"
        gg = G[gauge]
        shape, fb, seg_breaks = build_route_shape(
            pts, gg["comp_of_full"], gg["coord_op"], gg["adj_op"], gg["coord_full"], gg["adj_full"], order_hint)
        total_fb += fb
        line_shapes[rid] = {"shape": shape, "fallback_hops": fb, "seg_breaks": seg_breaks}
        r = cand_routes[rid]
        log(f"  {r['route_short_name']:6s} ({rid:16s}) {gauge:6s} union_stops={len(union):3d} shapePts={len(shape):5d} "
            f"fallback_hops={fb} segs={len(seg_breaks)+1}")
    log(f"總 fallback hops(退直線): {total_fb} / {len(route_union)} 條路線")

    # ── 端點站名 → route_long_name(給 gtfs2rail 用,比空白 longName 好看) ──
    route_long_name = {}
    for rid, union in route_union.items():
        order = route_rep_order[rid]
        if len(order) >= 2:
            a, b = stops[order[0]]["name"], stops[order[-1]]["name"]
        else:
            a, b = stops[union[0]]["name"], stops[union[0]]["name"]
        route_long_name[rid] = f"{a} – {b}"

    # ══════════════════════════════════════════════════════════════
    # 組合成 GTFS 目錄(僅白名單資料),交給 gtfs2rail.mjs(唯讀呼叫)
    # ══════════════════════════════════════════════════════════════
    if os.path.exists(SYNTH_GTFS_DIR):
        import shutil
        shutil.rmtree(SYNTH_GTFS_DIR)
    os.makedirs(SYNTH_GTFS_DIR)

    def w(fname, header, rows):
        with open(os.path.join(SYNTH_GTFS_DIR, fname), "w", newline="", encoding="utf-8") as f:
            wr = csv.writer(f)
            wr.writerow(header)
            for row in rows:
                wr.writerow(row)

    # agency.txt(僅 RhB/MGB;MGB 兩個 agency_id 顯示名稱統一,typeName 才會合併成同一品牌)
    agency_by_id = {r["agency_id"]: r for r in g["agency_rows"]}
    w("agency.txt", ["agency_id", "agency_name", "agency_url", "agency_timezone", "agency_lang"],
      [[aid, AGENCY_DISPLAY.get(aid, agency_by_id[aid]["agency_name"]),
        agency_by_id[aid]["agency_url"], "Europe/Zurich", "de"]
       for aid in sorted({cand_routes[rid]["agency_id"] for rid in route_union}) if aid in agency_by_id])

    # routes.txt(僅有當日班次的路線;補 route_color / route_long_name)
    w("routes.txt", ["route_id", "agency_id", "route_short_name", "route_long_name", "route_type", "route_color"],
      [[rid, cand_routes[rid]["agency_id"], cand_routes[rid]["route_short_name"], route_long_name[rid],
        cand_routes[rid]["route_type"],
        AGENCY_COLOR.get(cand_routes[rid]["agency_id"], DEFAULT_COLOR).lstrip("#")]
       for rid in route_union])

    # trips.txt(白名單 trip,補 shape_id)
    shape_id_of = {rid: f"swiss_{sanitize(rid)}" for rid in route_union}
    trips_rows = []
    for tid, rid in trip_route.items():
        trips_rows.append([rid, g["trip_service"][tid], tid, "", "0", shape_id_of[rid]])
    w("trips.txt", ["route_id", "service_id", "trip_id", "trip_headsign", "direction_id", "shape_id"], trips_rows)

    # stop_times.txt(白名單 trip 全部列)
    st_rows = []
    for tid, lst in trip_stops.items():
        if tid not in trip_route:
            continue
        for seq, sid in lst:
            st_rows.append([tid, sid, seq])
    # 補 arrival/departure:再掃一次原始檔取得真實時間(較省記憶體,不整檔常駐)
    st_time = {}
    for r in stream_csv("stop_times.txt"):
        if r["trip_id"] in trip_route:
            st_time[(r["trip_id"], int(r["stop_sequence"]))] = (r["arrival_time"], r["departure_time"], r["pickup_type"], r["drop_off_type"])
    w("stop_times.txt", ["trip_id", "arrival_time", "departure_time", "stop_id", "stop_sequence", "pickup_type", "drop_off_type"],
      [[tid, *st_time.get((tid, seq), ("", "", "0", "0"))[:2], sid, seq, *st_time.get((tid, seq), ("", "", "0", "0"))[2:]]
       for tid, sid, seq in st_rows])

    # stops.txt
    w("stops.txt", ["stop_id", "stop_name", "stop_lat", "stop_lon"],
      [[sid, s["name"], s["lat"], s["lon"]] for sid, s in stops.items()])

    # calendar.txt + calendar_dates.txt(僅白名單用到的 service_id)
    used_services = set(g["trip_service"].values())
    w("calendar.txt", ["service_id", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday", "start_date", "end_date"],
      [[sid, c["monday"], c["tuesday"], c["wednesday"], c["thursday"], c["friday"], c["saturday"], c["sunday"], c["start_date"], c["end_date"]]
       for sid, c in g["calendar"].items() if sid in used_services])
    w("calendar_dates.txt", ["service_id", "date", "exception_type"],
      [[sid, TARGET_DATE, ex] for sid, ex in g["exceptions"].items() if sid in used_services])

    # shapes.txt(OSM 產生的真實線形)
    shape_rows = []
    for rid, info in line_shapes.items():
        sid = shape_id_of[rid]
        for i, (lat, lon) in enumerate(info["shape"]):
            shape_rows.append([sid, lat, lon, i])
    w("shapes.txt", ["shape_id", "shape_pt_lat", "shape_pt_lon", "shape_pt_sequence"], shape_rows)

    log(f"合成 GTFS 目錄寫至 {SYNTH_GTFS_DIR}")

    # ══════════════════════════════════════════════════════════════
    # 呼叫既有 gtfs2rail.mjs(唯讀,不修改)
    # ══════════════════════════════════════════════════════════════
    cmd = ["node", os.path.join(HERE, "gtfs2rail.mjs"),
           "--gtfs", SYNTH_GTFS_DIR, "--sys", "瑞士景觀鐵道", "--tz", "Europe/Zurich",
           "--route-types", "100-117", "--out-prefix", OUT_PREFIX, "--date", TARGET_DATE,
           "--rdp-eps", "0.03"]
    log("執行: " + " ".join(cmd))
    subprocess.run(cmd, check=True, cwd=ROOT)

    # 附加來源標註(opentransportdata.swiss + OSM ODbL),gtfs2rail.mjs 寫的 source_notes 是挪威範本文字,
    # 需覆寫成瑞士正確來源(唯讀規則只限 gtfs2rail.mjs 本體,輸出的 data/swiss*.json 是本腳本產物,可改)
    for suffix in (".json", "_schedule_dense.json"):
        p = OUT_PREFIX + suffix
        d = json.load(open(p))
        d["source_notes"] = (
            "時刻表來源:opentransportdata.swiss 全國 GTFS(免費/免註冊/可商用,需標註來源 "
            "\"opentransportdata.swiss\";檔案 gtfs_fp2026,服務日 " + TARGET_DATE + ");"
            "路線母體 = RhB/MGB 全網 ∪ 官方景觀類別全集(GTFS route_type=107、route_desc=PE,"
            "兩個判準選到完全同一組 10 條:金色山口全景 30、百谷線 72、伯連納快車 BEX、冰河快車 GEX×3、"
            "金色山口快車 GPX×2、琉森-茵特拉肯快車 LIX、哥達全景快車 PE);"
            "官方不提供 shapes.txt,線形自建:OpenStreetMap 路網"
            "(© OpenStreetMap contributors, ODbL)跑 Dijkstra 取真實軌跡——米軌走 railway=narrow_gauge "
            "以及 gauge 含 1000 的三軌雙軌距路段(庫爾站區的 RhB 軌道標成 railway=rail + "
            "gauge=1000;1435,漏收會讓米軌網在庫爾斷開)、"
            "標準軌(哥達全景與金色山口快車東段)走 railway=rail,**兩張圖各自獨立**,"
            "因為兩種軌距在 Brig／Interlaken Ost／Zweisimmen 的 OSM 節點常共用,合圖會讓米軌路線抄捷徑;"
            "各圖內優先走已知營運商的軌道,缺口才退該軌距的全圖。"
            "每路線取當日聯合停靠站最遠兩端點(跨連通分量如 Brig 折返則分段拼接),"
            "Douglas-Peucker 簡化(eps=0.03km)。"
        )
        json.dump(d, open(p, "w"), ensure_ascii=False, separators=(",", ":"))
    log("已覆寫 source_notes 為瑞士正確來源標註")

    # 存一份驗證用中繼資料供獨立驗證腳本讀取
    json.dump({
        "route_union": route_union, "route_rep_order": route_rep_order,
        "shape_id_of": shape_id_of, "fallback_hops": {rid: v["fallback_hops"] for rid, v in line_shapes.items()},
        "stops": stops, "target_date": TARGET_DATE,
    }, open(os.path.join(SCRATCH, "build_meta.json"), "w"), ensure_ascii=False)
    log("DONE")


if __name__ == "__main__":
    main()
