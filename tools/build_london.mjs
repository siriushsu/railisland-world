#!/usr/bin/env node
// 從 TfL Unified API 現行 Route/Sequence 資料重建倫敦固定軌道路網。
//
// 收錄範圍：Underground、Elizabeth line、DLR、Tram，以及使用六個現行品牌線名的
// London Overground。一般 National Rail、Cable Car 與 Thames river services 不收錄。
// 分岔不壓成單一路徑；TfL 回傳的每一組端點／via 都保留成獨立 variant。Tram 在
// Croydon 市中心有方向不同的單向環段，因此六個方向性 route 全部保留並標 oneWay。
//
// 幾何：既有 Underground 線形以 OSM route relations 建成，本腳本會在同一母線的
// 舊線形 graph 上逐站尋路；缺少的區段與其他模式使用 TfL 官方站序與站點座標連線。
// 這能維持原有 Tube 曲線細節，同時讓新增路徑不因幾何來源延誤上線。
//
// 用法：
//   node tools/build_london.mjs --tfl-dir /path/to/sequence-json [--geometry-seed data/london.json]
// 若未給 --tfl-dir，會下載至 .cache/tfl-london（需要網路）。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DATA_FILE = path.join(ROOT, 'data', 'london.json');
const CACHE_DIR = path.join(ROOT, '.cache', 'tfl-london');
const API = 'https://api.tfl.gov.uk/Line';
const SNAPSHOT = '2026-08-31';

const LINE_IDS = [
  'bakerloo', 'central', 'circle', 'district', 'dlr', 'elizabeth',
  'hammersmith-city', 'jubilee', 'liberty', 'lioness', 'metropolitan',
  'mildmay', 'northern', 'piccadilly', 'suffragette', 'tram', 'victoria',
  'waterloo-city', 'weaver', 'windrush',
];

const COLORS = {
  bakerloo: '#B26300', central: '#DC241F', circle: '#FFC80A', district: '#007D32',
  'hammersmith-city': '#F589A6', jubilee: '#838D93', metropolitan: '#9B0058',
  northern: '#000000', piccadilly: '#0019A8', victoria: '#039BE5',
  'waterloo-city': '#76D0BD', dlr: '#00A4A7', elizabeth: '#6950A1', tram: '#84B817',
  liberty: '#5D6061', lioness: '#F4A900', mildmay: '#0072CE', windrush: '#DC241F',
  weaver: '#9B0058', suffragette: '#18A558',
};

const MODE_HEADWAYS = {
  tube: [900, 1200], dlr: [600, 900], 'elizabeth-line': [900, 1200],
  overground: [900, 1200], tram: [720, 900],
};
const SPECIAL_HEADWAYS = {
  liberty: [1800, 1800], victoria: [450, 600], 'waterloo-city': [600, 900],
};

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
}

async function ensureInputs(dir) {
  fs.mkdirSync(dir, { recursive: true });
  for (const id of LINE_IDS) {
    const file = path.join(dir, `${id}.json`);
    if (fs.existsSync(file)) continue;
    const url = `${API}/${id}/Route/Sequence/all`;
    console.log(`GET ${url}`);
    const res = await fetch(url, { headers: { 'user-agent': 'railisland-world-route-audit/1.0' } });
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    fs.writeFileSync(file, await res.text());
  }
}

function cleanName(raw = '') {
  return raw
    .replace(/\s+Underground Station$/i, '')
    .replace(/\s+DLR Station$/i, '')
    .replace(/\s+Tram Stop$/i, '')
    .replace(/\s+Rail Station$/i, '')
    .replace(/\s*\(London\)\s*$/i, '')
    .replace(/\s+-\s+Underground$/i, '')
    .replace(/-Underground$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseRouteName(raw) {
  const s = raw.replaceAll('&harr;', '↔').replace(/\s+/g, ' ').trim();
  const [from, tail = ''] = s.split('↔').map((x) => x.trim());
  const via = tail.match(/^(.*?)\s+via\s+(.+)$/i);
  return { from, to: via ? via[1].trim() : tail, via: via ? via[2].trim() : '' };
}

function routeKey(route) {
  const { from, to, via } = parseRouteName(route.name);
  return `${[from, to].sort().join('|')}|${via}`;
}

function selectRoutes(doc) {
  if (doc.lineId === 'tram') return doc.orderedLineRoutes.map((route, i) => ({ route, directionIndex: i }));
  const chosen = new Map();
  for (const [i, route] of doc.orderedLineRoutes.entries()) {
    const key = routeKey(route);
    const old = chosen.get(key);
    // 雙向站序偶爾因單向停靠差異長度不同；路網展示選較長者，避免漏掉可見車站。
    if (!old || (route.naptanIds?.length || 0) > (old.route.naptanIds?.length || 0)) {
      chosen.set(key, { route, directionIndex: i });
    }
  }
  return [...chosen.values()];
}

function stationMaster(doc) {
  const all = [
    ...(doc.stations || []),
    ...(doc.stopPointSequences || []).flatMap((seq) => seq.stopPoint || []),
  ];
  const map = new Map();
  for (const st of all) {
    const id = st.stationId || st.id;
    if (!id || !Number.isFinite(st.lat) || !Number.isFinite(st.lon)) continue;
    map.set(id, st);
    if (st.id) map.set(st.id, st);
    if (st.stationId) map.set(st.stationId, st);
  }
  return map;
}

function hav(a, b) {
  const R = 6371, rad = Math.PI / 180;
  const p1 = a[0] * rad, p2 = b[0] * rad;
  const dp = (b[0] - a[0]) * rad, dl = (b[1] - a[1]) * rad;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function densify(a, b, maxKm = 0.22) {
  const n = Math.max(1, Math.ceil(hav(a, b) / maxKm));
  const out = [];
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return out;
}

function family(id) {
  if (id.startsWith('met-')) return 'metropolitan';
  for (const base of LINE_IDS) if (id === base || id.startsWith(`${base}-`)) return base;
  return id;
}

function graphFromOld(oldLines, base) {
  const coord = new Map(), adj = new Map();
  const keyOf = ([lat, lon]) => `${Number(lat).toFixed(5)},${Number(lon).toFixed(5)}`;
  const add = (a, b) => {
    const ka = keyOf(a), kb = keyOf(b), w = hav(a, b);
    coord.set(ka, [Number(a[0]), Number(a[1])]); coord.set(kb, [Number(b[0]), Number(b[1])]);
    if (!adj.has(ka)) adj.set(ka, []); if (!adj.has(kb)) adj.set(kb, []);
    adj.get(ka).push([kb, w]); adj.get(kb).push([ka, w]);
  };
  for (const line of oldLines.filter((line) => family(line.id) === base)) {
    for (let i = 1; i < (line.shape || []).length; i++) add(line.shape[i - 1], line.shape[i]);
  }
  return { coord, adj };
}

function nearest(graph, point) {
  let best = null, dist = Infinity;
  for (const [id, c] of graph.coord) {
    const d = hav(c, point);
    if (d < dist) { best = id; dist = d; }
  }
  return [best, dist];
}

function dijkstra(graph, src, dst, ceiling = 100) {
  if (!src || !dst) return null;
  if (src === dst) return [src];
  const dist = new Map([[src, 0]]), prev = new Map(), open = [[0, src]];
  while (open.length) {
    open.sort((a, b) => a[0] - b[0]);
    const [du, u] = open.shift();
    if (u === dst) break;
    if (du !== dist.get(u) || du > ceiling) continue;
    for (const [v, w] of graph.adj.get(u) || []) {
      const nd = du + w;
      if (nd < (dist.get(v) ?? Infinity)) { dist.set(v, nd); prev.set(v, u); open.push([nd, v]); }
    }
  }
  if (!prev.has(dst)) return null;
  const ids = [dst];
  while (ids.at(-1) !== src) ids.push(prev.get(ids.at(-1)));
  return ids.reverse();
}

function makeShape(stations, graph) {
  const shape = [[stations[0].lat, stations[0].lon]];
  const stationD = [0];
  let total = 0, fallbackSegments = 0, graphSegments = 0;
  for (let i = 1; i < stations.length; i++) {
    const a = [stations[i - 1].lat, stations[i - 1].lon];
    const b = [stations[i].lat, stations[i].lon];
    const straight = hav(a, b);
    let segment = null;
    if (graph?.coord.size) {
      const [sa, ga] = nearest(graph, a), [sb, gb] = nearest(graph, b);
      if (ga < 0.7 && gb < 0.7) {
        const ids = dijkstra(graph, sa, sb);
        if (ids?.length) {
          const candidate = ids.map((id) => graph.coord.get(id));
          const len = candidate.slice(1).reduce((sum, p, j) => sum + hav(candidate[j], p), 0);
          if (len <= straight * 4 + 1.2) segment = candidate.slice(1);
        }
      }
    }
    if (segment?.length) graphSegments++;
    else { segment = densify(a, b); fallbackSegments++; }
    for (const point of segment) {
      total += hav(shape.at(-1), point);
      shape.push(point);
    }
    // 精確落到官方站點，避免站名與軌跡端點因 OSM snap 產生可見偏差。
    if (hav(shape.at(-1), b) > 0.002) { total += hav(shape.at(-1), b); shape.push(b); }
    stationD.push(total);
  }
  return {
    shape: shape.map(([a, b]) => [Number(a.toFixed(6)), Number(b.toFixed(6))]),
    stationD, shapeLen: total, fallbackSegments, graphSegments,
  };
}

function slug(text) {
  return cleanName(text).toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const inputDir = arg('--tfl-dir') || CACHE_DIR;
await ensureInputs(inputDir);
const seedFile = arg('--geometry-seed') || DATA_FILE;
const oldDoc = fs.existsSync(seedFile) ? JSON.parse(fs.readFileSync(seedFile, 'utf8')) : { lines: [] };
const graphs = new Map();
for (const base of LINE_IDS) graphs.set(base, graphFromOld(oldDoc.lines || [], base));

const lines = [];
const modeCounts = new Map();
for (const lineId of LINE_IDS) {
  const doc = JSON.parse(fs.readFileSync(path.join(inputDir, `${lineId}.json`), 'utf8'));
  if (doc.lineId !== lineId) throw new Error(`${lineId}: API lineId mismatch (${doc.lineId})`);
  const master = stationMaster(doc);
  const selected = selectRoutes(doc);
  for (const [n, { route }] of selected.entries()) {
    const parsed = parseRouteName(route.name);
    const stations = (route.naptanIds || []).map((id) => {
      const raw = master.get(id);
      if (!raw) throw new Error(`${lineId}: missing stop ${id} in ${route.name}`);
      return { code: id, name: cleanName(raw.name), lat: raw.lat, lon: raw.lon };
    });
    const isTram = doc.mode === 'tram';
    const viaPart = parsed.via ? `-${slug(parsed.via)}` : '';
    const directionPart = isTram ? `-dir${n + 1}` : '';
    const id = `${lineId}-${slug(parsed.from)}-${slug(parsed.to)}${viaPart}${directionPart}`;
    const [peakHeadwaySec, offpeakHeadwaySec] = SPECIAL_HEADWAYS[lineId] || MODE_HEADWAYS[doc.mode] || [900, 1200];
    const shaped = makeShape(stations, doc.mode === 'tube' ? graphs.get(lineId) : null);
    stations.forEach((st, i) => { st.d = Number(shaped.stationD[i].toFixed(4)); });
    lines.push({
      id, lineId, mode: doc.mode, name: `${doc.lineName} · ${cleanName(parsed.from)}–${cleanName(parsed.to)}${parsed.via ? ` via ${cleanName(parsed.via)}` : ''}`,
      color: COLORS[lineId], peakHeadwaySec, offpeakHeadwaySec, oneWay: isTram,
      officialRouteName: route.name.replaceAll('&harr;', '↔').replace(/\s+/g, ' ').trim(),
      stations, shape: shaped.shape, shapeLen: Number(shaped.shapeLen.toFixed(4)),
      geometry: doc.mode === 'tube' && shaped.graphSegments ? 'OSM-line-graph-with-TfL-stop-fallbacks' : 'TfL-stop-sequence',
      geometryGraphSegments: shaped.graphSegments, geometryFallbackSegments: shaped.fallbackSegments,
    });
    modeCounts.set(doc.mode, (modeCounts.get(doc.mode) || 0) + 1);
    console.log(`${id.padEnd(78)} ${String(stations.length).padStart(2)} stations  ${shaped.shapeLen.toFixed(1)}km  graph=${shaped.graphSegments} fallback=${shaped.fallbackSegments}`);
  }
}

const out = {
  system: 'TFL', data_date: SNAPSHOT.replaceAll('-', ''),
  source_notes: 'TfL Unified API Route/Sequence/all（2026-08-31 擷取）提供現行線別、端點、via、站序與站點座標；Underground 既有線形 graph 來自 OpenStreetMap route relations（© OpenStreetMap contributors，ODbL），其餘與缺段使用官方站點序列連線。收錄 Underground、Elizabeth line、DLR、Tram 與六條現行命名 London Overground；不含一般 National Rail。Powered by TfL Open Data. Contains OS data © Crown copyright and database rights.',
  coverage: {
    auditedAt: SNAPSHOT, officialLineBrands: LINE_IDS.length, visibleRouteVariants: lines.length,
    modes: Object.fromEntries([...modeCounts].sort()),
    excludes: ['National Rail', 'London Cable Car', 'river services'],
  },
  lines,
};
fs.writeFileSync(DATA_FILE, JSON.stringify(out));
console.log(`\nWROTE ${DATA_FILE}: ${LINE_IDS.length} brands / ${lines.length} route variants`);
console.log(Object.fromEntries([...modeCounts].sort()));
