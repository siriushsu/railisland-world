#!/usr/bin/env python3
"""
瑞士景觀鐵道（RhB＋MGB）資料管線。

opentransportdata.swiss 的全國 GTFS 官方明文不提供 shapes.txt（上游 HAFAS 資料無幾何,
怕自動產生品質不佳,見 hand off/海外研究_2026-07-11/scenic_railways.md）。本腳本:
  1. 下載全國 GTFS(免註冊,CKAN 資源頁抓最新 GTFS_FP2026_*.zip permalink)。
  2. 篩出 RhB(agency_id 72)＋MGB(agency_id 48 fo / 93 bvz)的鐵路路線(排除 route_type=700 巴士)。
  3. 用 Overpass 抓 OSM railway=narrow_gauge 路網(operator=RhB/MGB 優先,缺口才退到全 narrow_gauge
     圖,再退到直線),每條 GTFS 路線用當日聯合停靠站集合的「最遠兩端點」做 Dijkstra 取得真實線形
     (比對單一代表車次:多數路線同日有長短交路,單一代表車次涵蓋不了聯合站集合,故改用端點法+
     跨連通分量(如 Brig 折返)分段拼接)。
  4. 組一份自包含的合成 GTFS 目錄(agency/routes/trips[補 shape_id]/stop_times/stops/calendar/
     calendar_dates/shapes),丟給既有 scripts/gtfs2rail.mjs(唯讀,原樣呼叫)產生
     data/swiss.json + data/swiss_schedule_dense.json,schema 與 norway.json 同構。
  5. 驗證:站點到 shape 距離、d 單調遞增、抽驗車次、Albula 螺旋隧道座標密度檢查。

用法: python3 scripts/build_swiss_shapes.py
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
SCRATCH = "/private/tmp/claude-501/-Users-xuxiang-Code------/2cbdb064-06d3-4c63-90ae-6b17706bf3bc/scratchpad/swiss"
CACHE = os.path.join(HERE, ".overpass_cache")
os.makedirs(SCRATCH, exist_ok=True)
os.makedirs(CACHE, exist_ok=True)

GTFS_ZIP = os.path.join(SCRATCH, "gtfs_fp2026.zip")
SYNTH_GTFS_DIR = os.path.join(SCRATCH, "synth_gtfs")
OUT_PREFIX = os.path.join(ROOT, "data", "swiss")

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")

RAIL_AGENCIES = {"72", "48", "93"}          # RhB, MGB(fo), MGB(bvz)
AGENCY_DISPLAY = {"72": "Rhätische Bahn", "48": "Matterhorn Gotthard Bahn", "93": "Matterhorn Gotthard Bahn"}
AGENCY_COLOR = {"72": "#D9291C", "48": "#1B3668", "93": "#1B3668"}
EXCLUDE_ROUTE_TYPES = {"700"}                # 巴士替代役

TARGET_DATE = "20260715"          # 下週三(今天 2026-07-11 六)
TARGET_WEEKDAY_IDX = 2            # Mon=0..Sun=6, 週三=2

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
    cand_routes = {rid: r for rid, r in routes.items()
                   if r["agency_id"] in RAIL_AGENCIES and r["route_type"] not in EXCLUDE_ROUTE_TYPES}
    log(f"routes.txt: RhB+MGB 候選鐵路路線 {len(cand_routes)} 條(已排除 route_type=700 巴士)")

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


def route_one_pair(a_pt, b_pt, coord_op, adj_op, coord_full, adj_full):
    """單一端點對:先在 op 圖找路,失敗退到 full 圖,再失敗直線退。回傳 (poly[(lat,lon)], used, fallback_flag)"""
    na, da = nearest_node(coord_op, a_pt)
    nb, db = nearest_node(coord_op, b_pt)
    if da < 0.3 and db < 0.3:
        p = dijkstra(adj_op, coord_op, na, nb)
        if p:
            poly, _ = path_polyline_and_len(p, coord_op)
            return poly, "op", False
    # 退到全 narrow_gauge 圖(含非 RhB/MGB tag 但實體相連的路段)
    na2, da2 = nearest_node(coord_full, a_pt)
    nb2, db2 = nearest_node(coord_full, b_pt)
    if da2 < 0.3 and db2 < 0.3:
        p = dijkstra(adj_full, coord_full, na2, nb2)
        if p:
            poly, _ = path_polyline_and_len(p, coord_full)
            return poly, "full", False
    return [a_pt, b_pt], "straight", True


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
        members = [pt for sid, pt in union_stop_pts if stop_comp.get(sid) == comp]
        if len(members) < 2:
            full_shape.extend(members)
            continue
        # 該段最遠兩端點當「軸線」,其餘站投影排序(只用來定順序,不是真的量測)。
        # 重要:不能對「最遠兩端點」直接跑單趟長程 Dijkstra ── Chur 這類多線交會樞紐,
        # 圖上真正最短路徑常會抄到別條支線繞一大圈(實測 Thusis↔Schiers 最短路徑長達 81km,
        # 抄去 Filisur/Davos 方向,而非直達的 35km Chur 正線)。改採「投影排序後逐站相鄰
        # Dijkstra」,每一段都是幾公里的短程,不會被全域最短路徑帶偏,做法比照
        # fetch_shapes.py 對 TRA/MRT 的既有慣例(相鄰站逐段路由)。
        best_pair, best_d = None, -1
        for i in range(len(members)):
            for j in range(i + 1, len(members)):
                d = haversine(members[i], members[j])
                if d > best_d:
                    best_d, best_pair = d, (members[i], members[j])
        axis_a, axis_b = best_pair
        ax_lat, ax_lon = axis_b[0] - axis_a[0], axis_b[1] - axis_a[1]

        def proj(pt):
            return (pt[0] - axis_a[0]) * ax_lat + (pt[1] - axis_a[1]) * ax_lon

        ordered = sorted(dict.fromkeys(members), key=proj)  # 去重(同座標)+投影排序
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
def sanitize(s):
    return re.sub(r"[^A-Za-z0-9_-]", "", s)


def main():
    ensure_gtfs()
    g = load_gtfs_subset()
    routes, cand_routes = g["routes"], g["cand_routes"]
    trip_route, trip_stops, stops = g["trip_route"], g["trip_stops"], g["stops"]

    # 每條路線的聯合停靠站集合(當日全部 trip),及代表車次(當日停靠站最多者)供順序提示
    route_union = {}   # routeId -> [stopId,...] (去重,依代表車次+其餘出現順序)
    route_rep_order = {}  # routeId -> [stopId,...] 代表車次原始順序(給分段判斷用)
    trip_by_route = {}
    for tid, rid in trip_route.items():
        trip_by_route.setdefault(rid, []).append(tid)
    for rid, tids in trip_by_route.items():
        best_tid = max(tids, key=lambda t: len(trip_stops.get(t, [])))
        rep_order = [sid for _, sid in trip_stops.get(best_tid, [])]
        route_rep_order[rid] = rep_order
        union = list(dict.fromkeys(rep_order))
        seen = set(union)
        for tid in tids:
            for _, sid in trip_stops.get(tid, []):
                if sid not in seen:
                    seen.add(sid)
                    union.append(sid)
        route_union[rid] = union
    log(f"共 {len(route_union)} 條路線當日有服務(其餘候選路線當日無班次,略過)")

    # bbox(含 5% 邊界緩衝)
    all_pts = [(stops[sid]["lat"], stops[sid]["lon"]) for u in route_union.values() for sid in u]
    lat0, lat1 = min(p[0] for p in all_pts) - 0.05, max(p[0] for p in all_pts) + 0.05
    lon0, lon1 = min(p[1] for p in all_pts) - 0.05, max(p[1] for p in all_pts) + 0.05
    log(f"OSM bbox: lat[{lat0:.3f},{lat1:.3f}] lon[{lon0:.3f},{lon1:.3f}]")

    osm = overpass_fetch((lat0, lon0, lat1, lon1), "swiss_rhb_mgb")
    ways = [e for e in osm["elements"] if e.get("type") == "way"]
    op_ways = [w for w in ways if w.get("tags", {}).get("operator") in ("RhB", "MGB")]
    log(f"OSM narrow_gauge ways: {len(ways)} 條,operator=RhB/MGB {len(op_ways)} 條")

    coord_op, adj_op = build_graph(op_ways)
    coord_full, adj_full = build_graph(ways)
    nb_op = bridge_gaps(coord_op, adj_op)
    nb_full = bridge_gaps(coord_full, adj_full)
    log(f"補橋接邊(修 OSM 節點未共用的拓撲缺口,<50m 才接): op圖 {nb_op} 條, full圖 {nb_full} 條")
    comp_of_op, comps = connected_components(coord_op, adj_op)
    log(f"graph_op: {len(coord_op)} nodes, {len(comps)} 個連通分量(前 5 大: {sorted([len(c) for c in comps], reverse=True)[:5]})")
    comp_of_full, comps_full = connected_components(coord_full, adj_full)
    log(f"graph_full: {len(coord_full)} nodes, {len(comps_full)} 個連通分量(前 5 大: {sorted([len(c) for c in comps_full], reverse=True)[:5]})")

    # 逐路線建 shape
    line_shapes = {}    # routeId -> {'shape':[[lat,lon]...], 'fallback_hops':n}
    total_fb = 0
    for rid, union in route_union.items():
        pts = [(sid, (stops[sid]["lat"], stops[sid]["lon"])) for sid in union]
        order_hint = route_rep_order[rid] if route_rep_order[rid] else union
        shape, fb, seg_breaks = build_route_shape(pts, comp_of_full, coord_op, adj_op, coord_full, adj_full, order_hint)
        total_fb += fb
        line_shapes[rid] = {"shape": shape, "fallback_hops": fb, "seg_breaks": seg_breaks}
        r = cand_routes[rid]
        log(f"  {r['route_short_name']:6s} ({rid:16s}) union_stops={len(union):3d} shapePts={len(shape):5d} "
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
      [[aid, AGENCY_DISPLAY[aid], agency_by_id[aid]["agency_url"], "Europe/Zurich", "de"]
       for aid in sorted(RAIL_AGENCIES) if aid in agency_by_id])

    # routes.txt(僅有當日班次的路線;補 route_color / route_long_name)
    w("routes.txt", ["route_id", "agency_id", "route_short_name", "route_long_name", "route_type", "route_color"],
      [[rid, cand_routes[rid]["agency_id"], cand_routes[rid]["route_short_name"], route_long_name[rid],
        cand_routes[rid]["route_type"], AGENCY_COLOR[cand_routes[rid]["agency_id"]].lstrip("#")]
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
            "官方不提供 shapes.txt,線形自建:OpenStreetMap railway=narrow_gauge 路網"
            "(© OpenStreetMap contributors, ODbL,operator=RhB/MGB 優先,缺口退全 narrow_gauge 圖)"
            "跑 Dijkstra 取真實軌跡;每路線取當日聯合停靠站最遠兩端點(跨連通分量如 Brig 折返則分段拼接),"
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
