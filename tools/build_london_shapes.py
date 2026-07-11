#!/usr/bin/env python3
"""
Fetch real London Underground track geometry from OpenStreetMap (Overpass) and
attach a curved `shape` polyline to each line entry in data/london.json, plus
each station's arc-length position `d` (km) along that shape.

Copied & adapted from fetch_shapes.py (same Dijkstra-over-way-graph approach).
Differences from the TRA/MRT version:
  - Query pulls only the ways that are members of TfL's own "route=subway"
    relations (operator=Transport for London), not a raw bbox tag filter.
    This matters because London Underground track is tagged inconsistently
    (deep-tube sections railway=subway, sub-surface/shared-with-National-Rail
    sections often railway=rail) — filtering by relation membership instead
    of tag value captures the real LU path either way without pulling in
    unrelated National Rail/DLR/Elizabeth line ways in the same bbox.
  - Larger max_km ceiling for Dijkstra (London branches run ~40km, e.g.
    Aldgate–Amersham), and a larger detour-rejection multiplier since
    sub-surface stations sit closer together than TRA's intercity stops.

Source: OpenStreetMap contributors, ODbL. Station/topology source: TfL
Unified API (Powered by TfL Open Data).
"""
import json, math, heapq, sys, urllib.request, urllib.parse, os, time

OVERPASS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(HERE, "data", "london.json")
CACHE = os.path.join(HERE, "scripts", ".overpass_cache")

def haversine(a, b):
    R = 6371.0
    la1, lo1, la2, lo2 = map(math.radians, [a[0], a[1], b[0], b[1]])
    dla, dlo = la2 - la1, lo2 - lo1
    h = math.sin(dla/2)**2 + math.cos(la1)*math.cos(la2)*math.sin(dlo/2)**2
    return 2 * R * math.asin(math.sqrt(h))

def overpass(query, cache_key):
    os.makedirs(CACHE, exist_ok=True)
    cf = os.path.join(CACHE, cache_key + ".json")
    if os.path.exists(cf):
        print(f"  (cache hit {cache_key})", flush=True)
        return json.load(open(cf))
    data = urllib.parse.urlencode({"data": query}).encode()
    last = None
    for attempt in range(6):
        ep = OVERPASS[attempt % len(OVERPASS)]
        try:
            req = urllib.request.Request(ep, data=data,
                                         headers={"User-Agent": "rail-shape-london/1.0"})
            with urllib.request.urlopen(req, timeout=300) as r:
                out = json.loads(r.read().decode())
            json.dump(out, open(cf, "w"))
            return out
        except Exception as e:
            last = e
            print(f"  attempt {attempt+1} on {ep.split('/')[2]} failed: {e}; backing off", flush=True)
            time.sleep(15 * (attempt + 1))
    raise last

def build_graph(elements):
    """node_id -> (lat,lon); adj: node_id -> list of (nbr_id, dist_km).

    London Underground OSM data frequently maps parallel tracks / adjacent
    lines as geometrically-coincident but node-ID-disjoint ways (junctions
    don't always share a literal node object even when they're the same
    physical point) — a plain shared-node-id graph came out as 304 disconnected
    islands (biggest ~42% of nodes) and Dijkstra failed on almost every
    station pair. Fix: union-find nodes that are within 12m of each other
    (typical OSM digitisation slop at junctions) in addition to actual way
    edges, then build the graph over the merged vertex ids. This collapses
    the graph to essentially one component (>99.7% of nodes).
    """
    raw_coord = {}
    edges = []
    for el in elements:
        if el.get("type") != "way":
            continue
        nodes = el.get("nodes") or []
        geom = el.get("geometry") or []
        if len(nodes) != len(geom):
            continue
        for nid, g in zip(nodes, geom):
            raw_coord[nid] = (g["lat"], g["lon"])
        for i in range(len(nodes) - 1):
            edges.append((nodes[i], nodes[i+1]))

    parent = {n: n for n in raw_coord}
    def find(x):
        root = x
        while parent[root] != root:
            root = parent[root]
        while parent[x] != root:
            parent[x], x = root, parent[x]
        return root
    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[ra] = rb

    # NOTE: only proximity-merge here (below), do NOT union edge endpoints —
    # that would collapse each connected component into a single vertex and
    # destroy the very path structure Dijkstra needs to route through.

    CELL = 0.0003  # ~33m grid cell at London latitude
    THRESH_KM = 0.012  # 12m snap threshold
    grid = {}
    for nid, (la, lo) in raw_coord.items():
        grid.setdefault((round(la / CELL), round(lo / CELL)), []).append(nid)
    for nid, (la, lo) in raw_coord.items():
        cx, cy = round(la / CELL), round(lo / CELL)
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for other in grid.get((cx + dx, cy + dy), ()):
                    if other <= nid:
                        continue
                    if haversine(raw_coord[nid], raw_coord[other]) < THRESH_KM:
                        union(nid, other)

    # representative coordinate per merged cluster = first-seen raw coord
    coord = {}
    for nid in raw_coord:
        r = find(nid)
        if r not in coord:
            coord[r] = raw_coord[r]
    node_root = {nid: find(nid) for nid in raw_coord}

    adj = {}
    for a, b in edges:
        ra, rb = node_root[a], node_root[b]
        if ra == rb:
            continue
        w = haversine(coord[ra], coord[rb])
        adj.setdefault(ra, []).append((rb, w))
        adj.setdefault(rb, []).append((ra, w))
    return coord, adj

def nearest_node(coord, pt):
    best, bd = None, 1e9
    for nid, c in coord.items():
        d = haversine(pt, c)
        if d < bd:
            bd, best = d, nid
    return best, bd

def dijkstra(adj, coord, src, dst, max_km=90):
    if src == dst:
        return [src]
    dist = {src: 0.0}
    prev = {}
    pq = [(0.0, src)]
    while pq:
        d, u = heapq.heappop(pq)
        if u == dst:
            break
        if d > dist.get(u, 1e9):
            continue
        if d > max_km:
            continue
        for v, w in adj.get(u, ()):
            nd = d + w
            if nd < dist.get(v, 1e9):
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

LU_Q = """
[out:json][timeout:300];
rel["route"="subway"]["operator"="Transport for London"](51.35,-0.65,51.75,0.30);
way(r) -> .allways;
(.allways;);
out geom;
"""

def process():
    print("=== London Underground: querying Overpass (relation members) ===", flush=True)
    res = overpass(LU_Q, "london_lu_ways")
    els = res.get("elements", [])
    print(f"  ways returned: {sum(1 for e in els if e.get('type')=='way')}", flush=True)
    coord, adj = build_graph(els)
    print(f"  graph nodes: {len(coord)}", flush=True)

    d = json.load(open(DATA))
    total_fb = 0
    bad_snap = []
    for ln in d["lines"]:
        sts = ln["stations"]
        snapped = []
        for st in sts:
            nid, gap = nearest_node(coord, (st["lat"], st["lon"]))
            snapped.append(nid)
            if gap > 0.35:  # >350m from any LU-relation track: flag for review
                bad_snap.append((ln["id"], st["name"], round(gap*1000)))
        shape = [list(coord[snapped[0]])]
        cum = 0.0
        sts[0]["d"] = 0.0
        fb = 0
        for i in range(1, len(sts)):
            straight = haversine((sts[i-1]["lat"], sts[i-1]["lon"]),
                                 (sts[i]["lat"], sts[i]["lon"]))
            p = dijkstra(adj, coord, snapped[i-1], snapped[i])
            routed = None
            if p and len(p) >= 2:
                routed = 0.0
                for j in range(len(p)-1):
                    routed += haversine(coord[p[j]], coord[p[j+1]])
            if p is None or len(p) < 2 or routed > 2.5 * straight + 1.0:
                fb += 1
                cur = [sts[i]["lat"], sts[i]["lon"]]
                cum += haversine(shape[-1], cur)
                shape.append(cur)
                sts[i]["d"] = round(cum, 4)
            else:
                for nid in p[1:]:
                    c = list(coord[nid])
                    cum += haversine(shape[-1], c)
                    shape.append(c)
                sts[i]["d"] = round(cum, 4)
        ln["shape"] = [[round(a, 6), round(b, 6)] for a, b in shape]
        ln["shapeLen"] = round(cum, 4)
        total_fb += fb
        print(f"  {ln['id']:38s} stations={len(sts):3d} shapePts={len(shape):5d} "
              f"len={cum:7.2f}km fallback={fb}", flush=True)

    d["shape_source"] = ("OSM Overpass, ways from TfL 'route=subway' relations "
                          "(operator=Transport for London), Dijkstra-routed between "
                          "stations. Map data © OpenStreetMap contributors, ODbL. "
                          "Station/topology: Powered by TfL Open Data.")
    json.dump(d, open(DATA, "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"\nWROTE {DATA}  (total straight-line fallbacks: {total_fb})", flush=True)
    if bad_snap:
        print(f"\nSTATIONS >350m FROM NEAREST LU TRACK NODE ({len(bad_snap)}):", flush=True)
        for lid, name, gap_m in bad_snap:
            print(f"    {lid:38s} {name:30s} {gap_m}m", flush=True)

if __name__ == "__main__":
    process()
    print("\nDONE", flush=True)
