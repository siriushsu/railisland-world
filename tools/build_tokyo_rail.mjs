#!/usr/bin/env node
// 東京都全境 JR 與私鐵建置器（Tokyo Metro、都營以外的 55 條營運路線）。
//
// 來源：OpenStreetMap route／route_master relations（ODbL），清單見 tools/tokyo_rail_specs.mjs。
// 每條路線：
//   1. 從 route_master 的成員裡挑一個營運變體：優先各站停車（名稱不含快速／急行／特急），
//      再取東京都內站數最多、軌道最長的那個。
//   2. 依成員順序把軌道 way 串成一條線形；接不上時改找最近的端點，並記錄最大接縫。
//   3. 停靠站取 relation 的 stop 成員；沒有 stop 成員（JR 埼京線只有軌道）時，改取軌道上
//      有站名的 railway=stop／public_transport=stop_position 節點。
//   4. 站序不照成員順序（OSM 常有錯位），改依車站投影到線形上的里程排序，同名合併。
//   5. 裁到東京都界：保留第一個到最後一個都內車站之間的區段（中間短暫出界的站一併保留）。
//   環狀線（山手線）比照新加坡環線：起點站在頭尾各出現一次，里程從 0 到全長。
//
// 輸出：data/tokyo.json（保留原本 16 個 Metro／都營路徑，附加這 55 條）、
//       i18n/tokyo_rail.json（日文站名 → OSM 英文站名，供 build_tokyo_i18n.mjs 使用）。
//
// 用法：NODE_USE_ENV_PROXY=1 node tools/build_tokyo_rail.mjs [--refresh] [--offline]

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TOKYO_RAIL_SPECS } from './tokyo_rail_specs.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = path.join(ROOT, '.cache/osm-tokyo-rail');
const DATA_FILE = path.join(ROOT, 'data/tokyo.json');
const NAMES_FILE = path.join(ROOT, 'i18n/tokyo_rail.json');
const TOKYO_BOUNDARY = 1543125;
const ORIGINAL_IDS = ['E', 'I', 'S', 'A', 'SA', 'NT', 'G', 'M', 'Mb', 'H', 'T', 'C', 'Y', 'Z', 'N', 'F'];
const REFRESH = process.argv.includes('--refresh');
const OFFLINE = process.argv.includes('--offline');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function osm(apiPath, file) {
  await mkdir(CACHE, { recursive: true });
  const cacheFile = path.join(CACHE, file);
  if (!REFRESH && existsSync(cacheFile)) return JSON.parse(await readFile(cacheFile, 'utf8'));
  if (OFFLINE) throw new Error(`離線模式缺少快取：${cacheFile}`);
  for (let attempt = 0; attempt < 5; attempt++) {
    const response = await fetch(`https://api.openstreetmap.org/api/0.6/${apiPath}`, {
      headers: { 'User-Agent': 'RailIslandWorld/1.0 (route data builder; github.com/siriushsu/railisland-world)' },
    });
    if (response.ok) {
      const text = await response.text();
      await writeFile(cacheFile, text);
      await sleep(250);
      return JSON.parse(text);
    }
    await sleep(2000 * (attempt + 1));
  }
  throw new Error(`OSM ${apiPath} 下載失敗`);
}

const rad = x => x * Math.PI / 180;
function haversine(a, b) {
  const dp = rad(b[0] - a[0]), dl = rad(b[1] - a[1]);
  const q = Math.sin(dp / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dl / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(q)));
}
const r6 = x => Math.round(x * 1e6) / 1e6;
const r4 = x => Math.round(x * 1e4) / 1e4;

// ---- 東京都界（外框環） ----
function ringsFromBoundary(doc) {
  const ways = new Map(doc.elements.filter(e => e.type === 'way').map(e => [e.id, e]));
  const nodes = new Map(doc.elements.filter(e => e.type === 'node').map(e => [e.id, [e.lat, e.lon]]));
  const relation = doc.elements.find(e => e.type === 'relation' && e.id === TOKYO_BOUNDARY);
  const pending = relation.members.filter(m => m.type === 'way' && m.role === 'outer').map(m => ways.get(m.ref)?.nodes).filter(Boolean).map(list => [...list]);
  const rings = [];
  while (pending.length) {
    let ring = pending.shift();
    let grown = true;
    while (ring[0] !== ring.at(-1) && grown) {
      grown = false;
      for (let i = 0; i < pending.length; i++) {
        const w = pending[i];
        if (w[0] === ring.at(-1)) ring = ring.concat(w.slice(1));
        else if (w.at(-1) === ring.at(-1)) ring = ring.concat([...w].reverse().slice(1));
        else if (w.at(-1) === ring[0]) ring = w.concat(ring.slice(1));
        else if (w[0] === ring[0]) ring = [...w].reverse().concat(ring.slice(1));
        else continue;
        pending.splice(i, 1); grown = true; break;
      }
    }
    rings.push(ring.map(id => nodes.get(id)).filter(Boolean));
  }
  return rings;
}
function insideRing([lat, lon], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [yi, xi] = ring[i], [yj, xj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// ---- 線形 ----
function wayPoints(way, nodes) {
  return way.nodes.map(id => nodes.get(id)).filter(Boolean).map(n => [n.lat, n.lon]);
}
function chainWays(segments) {
  // 依成員順序串接；接不上（> 300 m）時從剩下的段裡找最近的端點接上。
  const remaining = segments.map(points => points.slice());
  const shape = remaining.shift();
  let maxGapKm = 0;
  while (remaining.length) {
    let best = null;
    const tryIndex = (index, ordered) => {
      const points = remaining[index];
      const options = [
        { gap: haversine(shape.at(-1), points[0]), at: 'end', rev: false },
        { gap: haversine(shape.at(-1), points.at(-1)), at: 'end', rev: true },
        { gap: haversine(shape[0], points.at(-1)), at: 'start', rev: false },
        { gap: haversine(shape[0], points[0]), at: 'start', rev: true },
      ];
      for (const option of options) if (!best || option.gap < best.gap - (ordered ? 0 : 1e-9)) best = { ...option, index };
    };
    tryIndex(0, true);
    if (best.gap > 0.3) for (let index = 1; index < remaining.length; index++) tryIndex(index, false);
    const points = remaining.splice(best.index, 1)[0];
    const seq = best.rev ? points.reverse() : points;
    maxGapKm = Math.max(maxGapKm, best.gap);
    if (best.at === 'end') shape.push(...(best.gap < 0.001 ? seq.slice(1) : seq));
    else shape.unshift(...(best.gap < 0.001 ? seq.slice(0, -1) : seq));
  }
  return { shape, maxGapKm };
}
function cumulative(shape) {
  const out = [0];
  for (let i = 1; i < shape.length; i++) out.push(out.at(-1) + haversine(shape[i - 1], shape[i]));
  return out;
}
function project(point, shape, cum) {
  const [lat, lon] = point, kx = 111.32 * Math.cos(rad(lat)), ky = 111.32;
  let best = null;
  for (let i = 0; i < shape.length - 1; i++) {
    const a = shape[i], b = shape[i + 1];
    const ax = (a[1] - lon) * kx, ay = (a[0] - lat) * ky, bx = (b[1] - lon) * kx, by = (b[0] - lat) * ky;
    const dx = bx - ax, dy = by - ay, den = dx * dx + dy * dy;
    const t = den ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / den)) : 0;
    const gap = Math.hypot(ax + dx * t, ay + dy * t);
    if (!best || gap < best.gap) best = { gap, d: cum[i] + (cum[i + 1] - cum[i]) * t, i, t };
  }
  return best;
}
function sliceShape(shape, cum, from, to) {
  const at = d => {
    let i = cum.findIndex((c, k) => k < cum.length - 1 && cum[k + 1] >= d);
    if (i < 0) i = cum.length - 2;
    const t = cum[i + 1] > cum[i] ? (d - cum[i]) / (cum[i + 1] - cum[i]) : 0;
    return [shape[i][0] + (shape[i + 1][0] - shape[i][0]) * t, shape[i][1] + (shape[i + 1][1] - shape[i][1]) * t];
  };
  const out = [at(from)];
  for (let k = 0; k < shape.length; k++) if (cum[k] > from && cum[k] < to) out.push(shape[k]);
  out.push(at(to));
  return out;
}

// ---- 站名 ----
function cleanName(name) {
  return String(name || '').replace(/\s*[（(][^）)]*(番線|ホーム|線)[）)]\s*$/, '').replace(/駅$/, '').replace(/^(JR|ＪＲ)\s*/, '').trim();
}
function englishName(tags) {
  return tags['name:en'] || tags['name:ja-Latn'] || tags['name:ja_rm'] || null;
}

const SERVICE_PENALTY = /快速|急行|特急|準急|通勤|ライナー|Express|Rapid/i;

async function buildLine(spec, rings) {
  const master = (await osm(`relation/${spec.master}.json`, `${spec.master}.json`)).elements[0];
  // spec.variant：手動指定營運變體（自動挑選會選錯時，例如武藏野線的東京直通變體）
  const routeIds = spec.variant ? [spec.variant]
    : master.tags.type === 'route' && master.tags.route !== 'railway' ? [master.id]
    : master.members.filter(m => m.type === 'relation').map(m => m.ref);
  const variants = [];
  for (const rid of routeIds) {
    const doc = await osm(`relation/${rid}/full.json`, `${rid}.full.json`);
    const relation = doc.elements.find(e => e.type === 'relation' && e.id === rid);
    if (!relation) continue;
    const nodes = new Map(doc.elements.filter(e => e.type === 'node').map(e => [e.id, e]));
    const ways = new Map(doc.elements.filter(e => e.type === 'way').map(e => [e.id, e]));
    const trackWays = relation.members.filter(m => m.type === 'way' && !/platform/.test(m.role)).map(m => ways.get(m.ref)).filter(w => w?.nodes?.length > 1);
    if (!trackWays.length) continue;
    const { shape, maxGapKm } = chainWays(trackWays.map(w => wayPoints(w, nodes)).filter(p => p.length > 1));
    let stops = relation.members.filter(m => m.type === 'node' && /^stop/.test(m.role)).map(m => nodes.get(m.ref)).filter(n => n?.tags?.name);
    let stopSource = 'relation-stops';
    if (!stops.length) {
      const onTrack = new Set(trackWays.flatMap(w => w.nodes));
      stops = [...onTrack].map(id => nodes.get(id)).filter(n => n?.tags?.name && (n.tags.railway === 'stop' || n.tags.public_transport === 'stop_position'));
      stopSource = 'track-stop-positions';
    }
    variants.push({ rid, relation, shape, maxGapKm, stops, stopSource, penalty: SERVICE_PENALTY.test(relation.tags.name || '') ? 1 : 0 });
  }
  if (!variants.length) throw new Error(`${spec.id} 找不到可用的營運變體`);

  const evaluate = variant => {
    const cum = cumulative(variant.shape);
    const byName = new Map();
    for (const node of variant.stops) {
      const name = cleanName(node.tags.name);
      if (!name) continue;
      const hit = project([node.lat, node.lon], variant.shape, cum);
      if (!hit || hit.gap > 0.4) continue;
      const prev = byName.get(name);
      if (!prev) byName.set(name, { name, lat: node.lat, lon: node.lon, d: hit.d, en: englishName(node.tags), gap: hit.gap });
      else if (!prev.en && englishName(node.tags)) prev.en = englishName(node.tags);
    }
    let stations = [...byName.values()].sort((a, b) => a.d - b.d);
    // spec.only：只取指定車站之間的區段（例如東武押上支線只有押上～曳舟）
    if (spec.only) stations = stations.filter(s => spec.only.includes(s.name));
    for (const station of stations) station.inside = rings.some(ring => insideRing([station.lat, station.lon], ring));
    const firstIn = stations.findIndex(s => s.inside), lastIn = stations.length - 1 - [...stations].reverse().findIndex(s => s.inside);
    stations = firstIn < 0 ? [] : stations.slice(firstIn, lastIn + 1);
    return { variant, cum, stations, insideCount: stations.filter(s => s.inside).length };
  };
  const scored = variants.map(evaluate).sort((a, b) =>
    a.variant.penalty - b.variant.penalty || b.insideCount - a.insideCount || (b.cum.at(-1) - a.cum.at(-1)));
  const pick = scored[0];
  if (pick.stations.length < 2) throw new Error(`${spec.id} 東京都內少於兩站`);
  const { variant, cum } = pick;
  let stations = pick.stations;
  let shape, shapeLen;
  if (spec.loop) {
    // 環狀線：取全環，起點站在頭尾各出現一次（同新加坡環線）。
    shape = variant.shape;
    shapeLen = cum.at(-1);
    const start = stations[0];
    stations = stations.map(s => ({ ...s, d: s.d - start.d < -1e-6 ? s.d - start.d + shapeLen : s.d - start.d }));
    const shift = start.d;
    const pivot = project([start.lat, start.lon], shape, cum);
    shape = [...sliceShape(shape, cum, shift, shapeLen), ...sliceShape(shape, cum, 0, shift).slice(1)];
    shapeLen = cumulative(shape).at(-1);
    stations.sort((a, b) => a.d - b.d);
    stations.push({ ...stations[0], d: shapeLen });
    void pivot;
  } else {
    const from = stations[0].d, to = stations.at(-1).d;
    shape = sliceShape(variant.shape, cum, from, to);
    shapeLen = to - from;
    stations = stations.map(s => ({ ...s, d: s.d - from }));
  }
  const outside = stations.filter(s => !s.inside).map(s => s.name);
  return {
    line: {
      id: spec.id, name: spec.names[2], color: spec.color, operator: spec.operator,
      peakHeadwaySec: spec.peak, offpeakHeadwaySec: spec.offpeak, cruiseKmh: spec.kmh,
      headway_estimated: true, motionModel: 'synthetic-headway',
      osmRelationIds: [spec.master, variant.rid], osmRelationTimestamp: variant.relation.timestamp || null,
      stations: stations.map(s => ({ name: s.name, lat: r6(s.lat), lon: r6(s.lon), d: r4(s.d) })),
      shape: shape.map(([lat, lon]) => [r6(lat), r6(lon)]),
      shapeLen: r4(shapeLen),
    },
    english: stations.filter(s => s.en).map(s => [s.name, s.en]),
    report: {
      id: spec.id, variant: variant.rid, variantName: variant.relation.tags.name, stopSource: variant.stopSource,
      stations: stations.length, outside, maxGapKm: +variant.maxGapKm.toFixed(3),
      maxSnapKm: +Math.max(...stations.map(s => s.gap || 0)).toFixed(3),
      first: stations[0].name, last: stations.at(-1).name,
    },
  };
}

const boundary = await osm(`relation/${TOKYO_BOUNDARY}/full.json`, 'tokyo-boundary.full.json');
const rings = ringsFromBoundary(boundary);
const original = JSON.parse(await readFile(DATA_FILE, 'utf8'));
const kept = original.lines.filter(line => ORIGINAL_IDS.includes(line.id));
if (kept.length !== ORIGINAL_IDS.length) throw new Error(`原本 16 個 Metro／都營路徑不齊：${kept.length}`);
const built = [], english = new Map(), reports = [];
for (const spec of TOKYO_RAIL_SPECS) {
  const result = await buildLine(spec, rings);
  built.push(result.line);
  for (const [ja, en] of result.english) if (!english.has(ja)) english.set(ja, en);
  reports.push(result.report);
  const r = result.report;
  console.log(`${r.id.padEnd(4)} ${String(r.stations).padStart(3)} 站 ${r.first} → ${r.last}  接縫 ${Math.round(r.maxGapKm * 1000)}m 站距線形 ${Math.round(r.maxSnapKm * 1000)}m${r.outside.length ? '  都外：' + r.outside.join('、') : ''}${r.stopSource !== 'relation-stops' ? '  [' + r.stopSource + ']' : ''}`);
}
const output = {
  ...original,
  source_notes: '都營 6 線與 Tokyo Metro 9 線見原說明；JR 東日本、東急、小田急、京王、西武、東武、京成、北總、京急、筑波快線、東京單軌、百合海鷗號、臨海線、多摩單軌共 55 條路線的線形與站點採 OpenStreetMap route relations（© OpenStreetMap contributors，ODbL），2026-10-01 擷取，裁到東京都界。',
  official_network_checked_at: '2026-10-01',
  lines: [...kept, ...built],
};
await writeFile(DATA_FILE, JSON.stringify(output));
await writeFile(NAMES_FILE, JSON.stringify({ source: 'OpenStreetMap name:en（© OpenStreetMap contributors，ODbL），2026-10-01', stations: Object.fromEntries([...english].sort(([a], [b]) => a.localeCompare(b, 'ja'))) }, null, 1) + '\n');
await writeFile(path.join(CACHE, 'build-report.json'), JSON.stringify(reports, null, 1));
console.log(`✓ 東京路網：原 16 個路徑＋JR／私鐵 ${built.length} 條＝${output.lines.length}；英文站名 ${english.size} 個`);
