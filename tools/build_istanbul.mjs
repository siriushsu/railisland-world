#!/usr/bin/env node
// 以 Metro İstanbul 現行各線頁與 OSM route relations 重建伊斯坦堡首發路網。
//
// 路線／站序真相：
//   - Metro İstanbul 官方各線頁：M1A–M9、T1/T3/T4/T5、F1/F4、TF1/TF2
//   - UAB/TCDD/IETT：M11、T2、T6、F2/F3、Marmaray、B2
// 幾何：OpenStreetMap route relations（© OpenStreetMap contributors，ODbL）。
//
// 下載官方頁與 Overpass `rel(...);out geom;` 結果後執行：
//   node tools/build_istanbul.mjs --official-dir /private/tmp/istanbul-official --osm-dir /private/tmp
//
// 這支腳本只重建 data/istanbul.json；示意班距由 tools/headway2sched.mjs 生成。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, 'data', 'istanbul.json');
const OLD = JSON.parse(fs.readFileSync(OUT, 'utf8'));
const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const OFFICIAL_DIR = arg('--official-dir', '/private/tmp/istanbul-official');
const OSM_DIR = arg('--osm-dir', '/private/tmp');

const OFFICIAL_IDS = ['M1A','M1B','M2','M3','M4','M5','M6','M7','M8','M9','T1','T3','T4','T5','F1','F4','TF1','TF2'];
const official = new Map();
for (const id of OFFICIAL_IDS) {
  const html = fs.readFileSync(path.join(OFFICIAL_DIR, `${id}.html`), 'utf8');
  const stationsMatch = html.match(/<h4 class="text-primary">Stations<\/h4>\s*([^<\r\n][\s\S]*?)\s*<input id="colorRGB"/);
  const colorMatch = html.match(/<input id="colorRGB"[^>]*value="([0-9]+),([0-9]+),([0-9]+)"/);
  if (!stationsMatch || !colorMatch) throw new Error(`${id}: cannot parse official station list/color`);
  const stations = stationsMatch[1].replace(/<[^>]+>/g, ' ').replace(/&[^;]+;/g, ' ').replace(/\s+/g, ' ').trim()
    .split(',').map((x) => x.trim()).filter(Boolean);
  const color = '#' + colorMatch.slice(1).map((x) => Number(x).toString(16).padStart(2, '0')).join('').toUpperCase();
  official.set(id, { stations, color });
}

const relationFiles = fs.readdirSync(OSM_DIR)
  .filter((name) => /^istanbul-geom-(?:a|b2|c|d|e|2396287|11344904|7719781)\.json$/.test(name));
const relations = new Map();
for (const name of relationFiles) {
  const doc = JSON.parse(fs.readFileSync(path.join(OSM_DIR, name), 'utf8'));
  for (const rel of doc.elements || []) if (rel.type === 'relation') relations.set(rel.id, rel);
}
const needRelations = [
  305496,4289712,11341406,7719796,4289797,2396287,11344904,7719781,
  15085833,11799409,14900216,4289800,15083964,2962729,301617,2409338,
  11344897,12174616,19587363,300961,301616,9476599,14738977,9987139,14039181,
];
for (const id of needRelations) if (!relations.has(id)) throw new Error(`missing OSM relation ${id}`);

const R = 6371;
const rad = (x) => x * Math.PI / 180;
function km(a, b) {
  const dlat = rad(b[0] - a[0]), dlon = rad(b[1] - a[1]);
  const q = Math.sin(dlat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dlon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(q)));
}
const point = (x) => Array.isArray(x)
  ? [Number(x[0].toFixed(7)), Number(x[1].toFixed(7))]
  : [Number(x.lat.toFixed(7)), Number(x.lon.toFixed(7))];
const stopsOf = (rel) => rel.members
  .filter((m) => m.type === 'node' && /^(?:stop|terminal)/.test(m.role || '') && Number.isFinite(m.lat) && Number.isFinite(m.lon))
  .map(point);

function networkShape(ids, stationCoords) {
  const graph = new Map();
  const key = (p) => `${p[0].toFixed(7)},${p[1].toFixed(7)}`;
  const ensure = (p) => {
    const k = key(p);
    if (!graph.has(k)) graph.set(k, { p, edges: new Map() });
    return k;
  };
  for (const id of ids) for (const member of relations.get(id).members) {
    if (member.type !== 'way' || !member.geometry || /^platform/.test(member.role || '')) continue;
    const pts = member.geometry.map(point);
    for (let i = 1; i < pts.length; i++) {
      const a = ensure(pts[i - 1]), b = ensure(pts[i]), w = km(pts[i - 1], pts[i]);
      graph.get(a).edges.set(b, Math.min(w, graph.get(a).edges.get(b) ?? Infinity));
      graph.get(b).edges.set(a, Math.min(w, graph.get(b).edges.get(a) ?? Infinity));
    }
  }
  const nodes = [...graph.entries()];
  const snap = (p) => nodes.reduce((best, item) => {
    const d = km(p, item[1].p);
    return !best || d < best.d ? { k: item[0], d } : best;
  }, null).k;
  const shortest = (start, goal) => {
    const dist = new Map([[start, 0]]), prev = new Map(), heap = [[0, start]];
    const push = (item) => {
      heap.push(item);
      let i = heap.length - 1;
      while (i) {
        const p = Math.floor((i - 1) / 2);
        if (heap[p][0] <= heap[i][0]) break;
        [heap[p], heap[i]] = [heap[i], heap[p]]; i = p;
      }
    };
    const pop = () => {
      const top = heap[0], last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        for (let i = 0;;) {
          let n = i, a = i * 2 + 1, b = a + 1;
          if (a < heap.length && heap[a][0] < heap[n][0]) n = a;
          if (b < heap.length && heap[b][0] < heap[n][0]) n = b;
          if (n === i) break;
          [heap[n], heap[i]] = [heap[i], heap[n]]; i = n;
        }
      }
      return top;
    };
    while (heap.length) {
      const [d, at] = pop();
      if (d !== dist.get(at)) continue;
      if (at === goal) break;
      for (const [to, w] of graph.get(at).edges) {
        const nd = d + w;
        if (nd >= (dist.get(to) ?? Infinity)) continue;
        dist.set(to, nd); prev.set(to, at); push([nd, to]);
      }
    }
    if (!dist.has(goal)) throw new Error(`OSM graph disconnected: ${start} -> ${goal}`);
    const out = [];
    for (let at = goal;; at = prev.get(at)) {
      out.push(graph.get(at).p);
      if (at === start) break;
    }
    return out.reverse();
  };
  const snapped = stationCoords.map(snap), out = [];
  for (let i = 1; i < snapped.length; i++) {
    let part = shortest(snapped[i - 1], snapped[i]);
    if (out.length && key(out.at(-1)) === key(part[0])) part = part.slice(1);
    out.push(...part);
  }
  return out;
}
function cumulative(shape) {
  const d = [0];
  for (let i = 1; i < shape.length; i++) d.push(d[i - 1] + km(shape[i - 1], shape[i]));
  return d;
}
function projectDistance(shape, cum, station, minD = -Infinity) {
  const latScale = 111.32, lonScale = 111.32 * Math.cos(rad(station[0]));
  let best = null;
  for (let i = 0; i < shape.length - 1; i++) {
    const a = shape[i], b = shape[i + 1];
    const vx = (b[1] - a[1]) * lonScale, vy = (b[0] - a[0]) * latScale;
    const wx = (station[1] - a[1]) * lonScale, wy = (station[0] - a[0]) * latScale;
    const vv = vx * vx + vy * vy;
    const t = vv ? Math.max(0, Math.min(1, (wx * vx + wy * vy) / vv)) : 0;
    const d = cum[i] + (cum[i + 1] - cum[i]) * t;
    if (d + 1e-6 < minD) continue;
    const dx = wx - vx * t, dy = wy - vy * t, dist2 = dx * dx + dy * dy;
    if (!best || dist2 < best.dist2) best = { d, dist2 };
  }
  return best?.d;
}
function orient(shape, first) {
  return km(first, shape.at(-1)) < km(first, shape[0]) ? [...shape].reverse() : shape;
}
function lineFrom({ id, lineId = id, mode, names, coords, shape, color, oneWay = false, headway, serviceNote }) {
  if (names.length !== coords.length) throw new Error(`${id}: ${names.length} names != ${coords.length} coordinates`);
  shape = orient(shape, coords[0]);
  const cum = cumulative(shape), shapeLen = cum.at(-1);
  let prev = -1;
  const stations = names.map((name, i) => {
    let d;
    if (oneWay && i === names.length - 1 && name === names[0]) d = shapeLen;
    else d = projectDistance(shape, cum, coords[i], prev < 0 ? -Infinity : prev + 0.001);
    if (!Number.isFinite(d)) d = i ? prev + Math.max(0.001, (shapeLen - prev) / (names.length - i)) : 0;
    prev = d;
    return { name, lat: coords[i][0], lon: coords[i][1], d: Number(d.toFixed(4)) };
  });
  const [peakHeadwaySec, offpeakHeadwaySec] = headway;
  return {
    id, lineId, mode, name: `${id} · ${names[0]}–${names.at(-1)}`,
    color, peakHeadwaySec, offpeakHeadwaySec, oneWay, serviceNote,
    stations, shape, shapeLen: Number(shapeLen.toFixed(4)),
  };
}
function officialLine(id, relId, mode, options = {}) {
  const spec = official.get(id), rel = relations.get(relId);
  let names = options.names || spec.stations;
  let coords = options.coords || stopsOf(rel);
  if (id === 'T1' || id === 'T4') {
    const old = OLD.lines.find((x) => x.id === id);
    coords = old.stations.map((s) => [s.lat, s.lon]);
    if (km(coords[0], stopsOf(rel)[0]) > km(coords.at(-1), stopsOf(rel)[0])) coords.reverse();
  }
  return lineFrom({ id, mode, names, coords, shape: networkShape([relId], coords), color: spec.color, ...options });
}

const lines = [];
const metroHeadway = [480, 720], tramHeadway = [600, 900], funicularHeadway = [120, 180], cableHeadway = [300, 600];
lines.push(officialLine('M1A', 305496, 'metro', { headway: metroHeadway }));
lines.push(officialLine('M1B', 4289712, 'metro', { headway: metroHeadway }));
const m2Main = official.get('M2').stations.filter((name) => name !== 'Seyrantepe');
lines.push(officialLine('M2', 11341406, 'metro', { names: m2Main, headway: metroHeadway }));
{ const coords = stopsOf(relations.get(7719796)); lines.push(lineFrom({ id: 'M2A', lineId: 'M2', mode: 'metro', names: ['Sanayi Mahallesi','Seyrantepe'], coords, shape: networkShape([7719796], coords), color: official.get('M2').color, headway: [600, 900] })); }
lines.push(officialLine('M3', 4289797, 'metro', { headway: metroHeadway }));
lines.push(officialLine('M4', 2396287, 'metro', { headway: metroHeadway }));
lines.push(officialLine('M5', 11344904, 'metro', { headway: metroHeadway }));
lines.push(officialLine('M6', 7719781, 'metro', { headway: [360, 600] }));
const m7a = stopsOf(relations.get(15085833)), m7b = stopsOf(relations.get(11799409));
{ const coords = [...m7a, ...m7b.slice(1)]; lines.push(lineFrom({ id: 'M7', mode: 'metro', names: official.get('M7').stations, coords, shape: networkShape([15085833,11799409], coords), color: official.get('M7').color, headway: metroHeadway })); }
lines.push(officialLine('M8', 14900216, 'metro', { headway: metroHeadway }));
lines.push(officialLine('M9', 4289800, 'metro', { headway: metroHeadway }));
const m11Names = ['Gayrettepe','Kağıthane','Üniversite-Hasdal','Kemerburgaz','Göktürk','İhsaniye','İstanbul Havalimanı','Kargo Terminali','Taşoluk','Arnavutköy Hastane','İbn Haldun Üniversitesi','Kayaşehir','Olimpiyatköy','Halkalı Stadı','Halkalı'];
{ const coords = stopsOf(relations.get(15083964)); lines.push(lineFrom({ id: 'M11', mode: 'metro', names: m11Names, coords, shape: networkShape([15083964], coords), color: '#6B2C91', headway: [900, 1200] })); }

lines.push(officialLine('T1', 2962729, 'tram', { headway: tramHeadway }));
{ const coords = stopsOf(relations.get(301617)); lines.push(lineFrom({ id: 'T2', mode: 'tram', names: ['Taksim Meydan','Hüseyin Ağa Camii','Galatasaray Lisesi','Odakule','Beyoğlu Tünel'], coords, shape: networkShape([301617], coords), color: '#D71920', headway: [900, 1200] })); }
const t3Names = [...official.get('T3').stations, official.get('T3').stations[0]];
const t3Coords = stopsOf(relations.get(2409338));
{ const coords = [...t3Coords, t3Coords[0]]; lines.push(lineFrom({ id: 'T3', mode: 'tram', names: t3Names, coords, shape: networkShape([2409338], coords), color: official.get('T3').color, oneWay: true, headway: [900, 1200] })); }
lines.push(officialLine('T4', 11344897, 'tram', { headway: tramHeadway }));
lines.push(officialLine('T5', 12174616, 'tram', { headway: tramHeadway }));
{ const coords = stopsOf(relations.get(19587363)); lines.push(lineFrom({ id: 'T6', mode: 'tram', names: ['Sirkeci','Cankurtaran','Kumkapı','Yenikapı','Cerrahpaşa','Kocamustafapaşa','Yedikule','Kazlıçeşme'], coords, shape: networkShape([19587363], coords), color: '#8A6D3B', headway: [900, 1200] })); }

lines.push(officialLine('F1', 300961, 'funicular', { headway: funicularHeadway }));
{ const coords = stopsOf(relations.get(301616)); lines.push(lineFrom({ id: 'F2', mode: 'funicular', names: ['Karaköy','Beyoğlu'], coords, shape: networkShape([301616], coords), color: '#7C7358', headway: funicularHeadway })); }
{ const coords = stopsOf(relations.get(9476599)); lines.push(lineFrom({ id: 'F3', mode: 'funicular', names: ['Seyrantepe','Vadistanbul'], coords, shape: networkShape([9476599], coords), color: '#7C7358', headway: funicularHeadway })); }
lines.push(officialLine('F4', 14738977, 'funicular', { headway: funicularHeadway }));

for (const id of ['TF1','TF2']) {
  const old = OLD.lines.find((x) => x.id === id), spec = official.get(id);
  lines.push(lineFrom({ id, mode: 'cable', names: spec.stations, coords: old.stations.map((s) => [s.lat,s.lon]), shape: old.shape, color: spec.color, headway: cableHeadway }));
}

const marmarayRel = relations.get(9987139);
const marmarayNames = ['Halkalı','Mustafa Kemal','Küçükçekmece','Florya','Florya Akvaryum','Yeşilköy','Yeşilyurt','Ataköy','Bakırköy','Yenimahalle','Zeytinburnu','Kazlıçeşme','Yenikapı','Sirkeci','Üsküdar','Ayrılıkçeşmesi','Söğütlüçeşme','Feneryolu','Göztepe','Erenköy','Suadiye','Bostancı','Küçükyalı','İdealtepe','Sürayya Plajı','Maltepe','Cevizli','Atalar','Başak','Kartal','Yunus','Pendik','Kaynarca','Tersane','Güzelyalı','Aydıntepe','İçmeler','Tuzla','Çayırova','Fatih','Osmangazi','Darıca','Gebze'];
{ const coords = stopsOf(marmarayRel); lines.push(lineFrom({ id: 'Marmaray', lineId: 'B1', mode: 'suburban', names: marmarayNames, coords, shape: networkShape([9987139], coords), color: '#5A5F5C', headway: [600,900] })); }
{ const coords = stopsOf(relations.get(14039181)); lines.push(lineFrom({ id: 'B2', mode: 'suburban', names: ['Halkalı','Ispartakule','Bahçeşehir'], coords, shape: networkShape([14039181], coords), color: '#8A7664', headway: [900,1200] })); }

const modes = Object.fromEntries([...new Set(lines.map((line) => line.mode))].map((mode) => [mode, lines.filter((line) => line.mode === mode).length]));
const doc = {
  system: 'İSTANBUL RAIL',
  data_date: '20260831',
  source_notes: '2026-08-31 現行路網稽核：Metro İstanbul 官方各線頁提供 M1A–M9、T1/T3/T4/T5、F1/F4、TF1/TF2 站序與線色；UAB/TCDD/IETT 官方資料補 M11、T2、T6、F2/F3、Marmaray 與 Halkalı–Bahçeşehir。細部線形採 OpenStreetMap route relations（© OpenStreetMap contributors，ODbL）。排除 Metrobus、渡輪與尚未通車的 T7；所有列車均為明示模擬合成班距，不是官方逐班時刻或即時位置，臨時停駛與改點不另行建模。',
  coverage: {
    auditedAt: '2026-08-31', visibleRoutePaths: lines.length, modes,
    includes: ['Metro','tram','funicular','Marmaray','Halkalı–Bahçeşehir suburban rail'],
    supplementary: ['TF1','TF2'], excludes: ['Metrobus','ferries','unopened T7'],
  },
  lines,
};
fs.writeFileSync(OUT, JSON.stringify(doc));
console.log(`WROTE ${OUT}`);
console.log(`  ${lines.length} paths: ${Object.entries(modes).map(([k,v]) => `${k} ${v}`).join(', ')}`);
console.log(`  ${new Set(lines.flatMap((line) => line.stations.map((s) => s.name))).size} unique station names`);
