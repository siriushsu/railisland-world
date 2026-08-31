#!/usr/bin/env node
// 東京首發範圍建置器：保留既有 Toei 六線，補齊 Tokyo Metro 九線。
//
// 正確性分工：
// - 現行路線、站序、三語站名：Tokyo Metro 官方各線頁面（i18n/tokyo.json）。
// - 軌道線形與站點座標：OpenStreetMap route relations（ODbL）。
// - 班次：Tokyo Metro 不冒充官方時刻，另由 build_tokyo_schedule.mjs 合成班距。
//
// 丸ノ內線方南町支線獨立成 Mb；千代田線 C01–C20 由兩個 OSM relation 接合，
// 不把分岔/接續路徑壓成單一錯誤 chainage。
//
// 用法：
//   node tools/build_tokyo.mjs --overpass-main /path/tokyo-metro-osm.json \
//     --overpass-namboku /path/tokyo-metro-n-osm.json
// 或省略兩個參數，由 OSM API 逐一更新 .cache/osm-tokyo。

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_FILE = path.join(ROOT, 'data/tokyo.json');
const I18N_FILE = path.join(ROOT, 'i18n/tokyo.json');
const SOURCE_DATE = '2026-08-31';
const args = Object.fromEntries(process.argv.slice(2).reduce((rows, token, index, all) => {
  if (token.startsWith('--')) rows.push([token.slice(2), all[index + 1]]);
  return rows;
}, []));
const CACHE = path.resolve(args['cache-dir'] || path.join(ROOT, '.cache/osm-tokyo'));
const OFFLINE = process.argv.includes('--offline');
const REFRESH = process.argv.includes('--refresh');

const SPECS = [
  { id: 'G', slug: 'ginza', relationId: 8026074, codes: range('G', 1, 19), name: '銀座線', color: '#FF9500', peak: 120, offpeak: 240 },
  { id: 'M', slug: 'marunouchi', relationId: 443282, codes: range('M', 1, 25), name: '丸ノ内線', color: '#F62E36', peak: 120, offpeak: 240 },
  { id: 'Mb', slug: 'marunouchi', relationId: 8015930, codes: ['M06', 'm05', 'm04', 'm03'], name: '丸ノ内線 方南町支線', color: '#F62E36', peak: 240, offpeak: 360 },
  { id: 'H', slug: 'hibiya', relationId: 443272, codes: range('H', 1, 22), name: '日比谷線', color: '#B5B5AC', peak: 120, offpeak: 300 },
  { id: 'T', slug: 'tozai', relationId: 5371620, codes: range('T', 1, 23), name: '東西線', color: '#009BBF', peak: 150, offpeak: 300 },
  { id: 'C_main', slug: 'chiyoda', relationId: 443284, codes: range('C', 1, 19), name: '千代田線', color: '#00BB85', peak: 150, offpeak: 300 },
  { id: 'C_tail', slug: 'chiyoda', relationId: 2790323, codes: ['C20', 'C19'], name: '千代田線', color: '#00BB85', peak: 240, offpeak: 360 },
  { id: 'Y', slug: 'yurakucho', relationId: 443269, codes: range('Y', 1, 24), name: '有楽町線', color: '#C1A470', peak: 180, offpeak: 360 },
  { id: 'Z', slug: 'hanzomon', relationId: 443279, codes: range('Z', 1, 14), name: '半蔵門線', color: '#8F76D6', peak: 150, offpeak: 300 },
  { id: 'N', slug: 'namboku', relationId: 7730199, codes: range('N', 1, 19), name: '南北線', color: '#00AC9B', peak: 180, offpeak: 360 },
  { id: 'F', slug: 'fukutoshin', relationId: 5375678, codes: range('F', 1, 16), name: '副都心線', color: '#9C5E31', peak: 180, offpeak: 360 },
];

function range(prefix, from, to) {
  return Array.from({ length: to - from + 1 }, (_, index) => `${prefix}${String(from + index).padStart(2, '0')}`);
}
function haversine(a, b) {
  const r = x => x * Math.PI / 180;
  const p1 = r(a[0]), p2 = r(b[0]), dp = p2 - p1, dl = r(b[1] - a[1]);
  const q = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(q)));
}
function samePoint(a, b, thresholdKm = 0.08) { return haversine(a, b) <= thresholdKm; }

function officialRows(source, slug) {
  const locales = ['zh-TW', 'en', 'ja'];
  const maps = Object.fromEntries(locales.map(locale => [locale, new Map(source.lines[slug][locale].map(row => [row.code, row.name]))]));
  return { locales, maps };
}
function officialName(map, code) {
  return map.get(code) || map.get(`${code[0].toLowerCase()}${code.slice(1)}`);
}

async function fetchRelationDocument(relationId) {
  await mkdir(CACHE, { recursive: true });
  const cacheFile = path.join(CACHE, `${relationId}.json`);
  if (!REFRESH && existsSync(cacheFile)) return JSON.parse(await readFile(cacheFile, 'utf8'));
  if (OFFLINE) throw new Error(`離線模式缺少 relation ${relationId} 快取：${cacheFile}`);
  const url = `https://api.openstreetmap.org/api/0.6/relation/${relationId}/full.json`;
  const response = await fetch(url, { headers: { 'User-Agent': 'RailIslandWorld/1.0 (route data builder)' } });
  if (!response.ok) throw new Error(`OSM relation ${relationId} 下載失敗：HTTP ${response.status}`);
  const text = await response.text();
  await writeFile(cacheFile, text);
  return JSON.parse(text);
}

async function documentsByRelation() {
  const docs = new Map();
  if (args['overpass-main']) {
    const main = JSON.parse(await readFile(path.resolve(args['overpass-main']), 'utf8'));
    for (const spec of SPECS.filter(spec => spec.id !== 'N')) docs.set(spec.relationId, main);
  }
  if (args['overpass-namboku']) docs.set(7730199, JSON.parse(await readFile(path.resolve(args['overpass-namboku']), 'utf8')));
  for (const spec of SPECS) if (!docs.has(spec.relationId)) docs.set(spec.relationId, await fetchRelationDocument(spec.relationId));
  return docs;
}

function pointsForWay(member, byKey) {
  if (member.geometry?.length) return member.geometry.map(point => [point.lat, point.lon]);
  const way = byKey.get(`way/${member.ref}`);
  if (way?.geometry?.length) return way.geometry.map(point => [point.lat, point.lon]);
  if (way?.nodes?.length) return way.nodes.map(nodeId => {
    const node = byKey.get(`node/${nodeId}`);
    if (!node || !Number.isFinite(node.lat) || !Number.isFinite(node.lon)) throw new Error(`way ${member.ref} 的 node ${nodeId} 缺座標`);
    return [node.lat, node.lon];
  });
  throw new Error(`way ${member.ref} 缺幾何`);
}

function shapeFromRelation(relation, byKey, spec) {
  const wayMembers = relation.members.filter(member => member.type === 'way' && !member.role);
  if (!wayMembers.length) throw new Error(`${spec.id} relation 沒有軌道 ways`);
  const shape = [];
  let maxJoinGapKm = 0;
  for (const member of wayMembers) {
    let points = pointsForWay(member, byKey);
    if (!shape.length) { shape.push(...points); continue; }
    const frontGap = haversine(shape.at(-1), points[0]);
    const backGap = haversine(shape.at(-1), points.at(-1));
    if (backGap < frontGap) points = [...points].reverse();
    const joinGap = Math.min(frontGap, backGap);
    maxJoinGapKm = Math.max(maxJoinGapKm, joinGap);
    if (joinGap > 0.25) throw new Error(`${spec.id} way ${member.ref} 與前段相距 ${Math.round(joinGap * 1000)}m`);
    shape.push(...(samePoint(shape.at(-1), points[0]) ? points.slice(1) : points));
  }
  return { shape, maxJoinGapKm };
}

function projectOrderedStations(shape, inputStations) {
  const cumulative = [0];
  for (let i = 1; i < shape.length; i++) cumulative.push(cumulative.at(-1) + haversine(shape[i - 1], shape[i]));
  const stations = inputStations.map(station => ({ ...station }));
  let previousD = 0, maxSnapKm = 0;
  for (const station of stations) {
    const latScale = 111.32, lonScale = 111.32 * Math.cos(station.lat * Math.PI / 180);
    let best = null;
    for (let i = 0; i < shape.length - 1; i++) {
      const a = shape[i], b = shape[i + 1];
      const ax = (a[1] - station.lon) * lonScale, ay = (a[0] - station.lat) * latScale;
      const bx = (b[1] - station.lon) * lonScale, by = (b[0] - station.lat) * latScale;
      const dx = bx - ax, dy = by - ay, denom = dx * dx + dy * dy;
      const t = denom ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / denom)) : 0;
      const gap = Math.hypot(ax + dx * t, ay + dy * t);
      const d = cumulative[i] + (cumulative[i + 1] - cumulative[i]) * t;
      if (d + 0.01 < previousD) continue;
      if (!best || gap < best.gap) best = { gap, d };
    }
    if (!best || best.gap > 0.25) throw new Error(`${station.code} ${station.name} 離線形 ${Math.round((best?.gap || 0) * 1000)}m`);
    station.d = Math.round(best.d * 10000) / 10000;
    previousD = station.d;
    maxSnapKm = Math.max(maxSnapKm, best.gap);
    delete station.code;
  }
  return { stations, shapeLen: cumulative.at(-1), maxSnapKm };
}

function lineFromRelation(document, spec, source) {
  const byKey = new Map(document.elements.map(element => [`${element.type}/${element.id}`, element]));
  const relation = byKey.get(`relation/${spec.relationId}`);
  if (!relation) throw new Error(`relation ${spec.relationId} 不在回應中`);
  const stopMembers = relation.members.filter(member => member.type === 'node' && member.role.startsWith('stop'));
  if (stopMembers.length !== spec.codes.length) throw new Error(`${spec.id} OSM ${stopMembers.length} 站，官方站序 ${spec.codes.length} 站`);
  const names = officialRows(source, spec.slug);
  const stations = stopMembers.map((member, index) => {
    const node = byKey.get(`node/${member.ref}`);
    const code = spec.codes[index];
    if (!node || !Number.isFinite(node.lat) || !Number.isFinite(node.lon)) throw new Error(`${spec.id} stop ${member.ref} 缺座標`);
    const name = officialName(names.maps.ja, code);
    if (!name || !officialName(names.maps.en, code) || !officialName(names.maps['zh-TW'], code)) throw new Error(`${spec.id} ${code} 三語官方站名不完整`);
    return { code, name, lat: node.lat, lon: node.lon };
  });
  const { shape, maxJoinGapKm } = shapeFromRelation(relation, byKey, spec);
  const projected = projectOrderedStations(shape, stations);
  return {
    id: spec.id, name: spec.name, color: spec.color,
    peakHeadwaySec: spec.peak, offpeakHeadwaySec: spec.offpeak,
    headway_estimated: true, motionModel: 'synthetic-headway',
    osmRelationIds: [spec.relationId], osmRelationTimestamp: relation.timestamp || null,
    stations: projected.stations,
    shape: shape.map(([lat, lon]) => [Math.round(lat * 1e6) / 1e6, Math.round(lon * 1e6) / 1e6]),
    shapeLen: Math.round(projected.shapeLen * 10000) / 10000,
    _maxSnapKm: projected.maxSnapKm, _maxJoinGapKm: maxJoinGapKm,
  };
}

function joinChiyoda(main, tail) {
  const reverseTailShape = [...tail.shape].reverse();
  const shape = [...main.shape, ...(samePoint(main.shape.at(-1), reverseTailShape[0]) ? reverseTailShape.slice(1) : reverseTailShape)];
  const tailStations = [...tail.stations].reverse();
  const stations = [...main.stations.map(station => ({ ...station })), ...tailStations.slice(1).map(station => ({ ...station }))];
  const projected = projectOrderedStations(shape, stations);
  return {
    ...main, id: 'C', name: '千代田線', osmRelationIds: [...main.osmRelationIds, ...tail.osmRelationIds],
    stations: projected.stations, shape,
    shapeLen: Math.round(projected.shapeLen * 10000) / 10000,
    _maxSnapKm: projected.maxSnapKm,
  };
}

const [original, source, docs] = await Promise.all([
  readFile(DATA_FILE, 'utf8').then(JSON.parse),
  readFile(I18N_FILE, 'utf8').then(JSON.parse),
  documentsByRelation(),
]);
const raw = new Map();
for (const spec of SPECS) raw.set(spec.id, lineFromRelation(docs.get(spec.relationId), spec, source));
const metro = ['G', 'M', 'Mb', 'H', 'T', 'Y', 'Z', 'N', 'F'].map(id => raw.get(id));
metro.splice(5, 0, joinChiyoda(raw.get('C_main'), raw.get('C_tail')));
for (const line of metro) {
  console.log(`${line.id.padEnd(3)} ${String(line.stations.length).padStart(2)} 站　${String(line.shape.length).padStart(4)} shape 點　${line.shapeLen.toFixed(2)}km　貼軌 ${Math.round(line._maxSnapKm * 1000)}m　接縫 ${Math.round(line._maxJoinGapKm * 1000)}m`);
  delete line._maxSnapKm; delete line._maxJoinGapKm;
}
const toei = original.lines.filter(line => ['A', 'I', 'S', 'E', 'SA', 'NT'].includes(line.id));
if (toei.length !== 6) throw new Error(`既有 Toei 應為 6 線，實際 ${toei.length}`);
const output = {
  ...original,
  system: '東京都營交通＋東京メトロ',
  data_date: SOURCE_DATE.replaceAll('-', ''),
  official_network_checked_at: SOURCE_DATE,
  source_notes: `現行營運範圍於 ${SOURCE_DATE} 依 Tokyo Metro 與東京都交通局官方路線頁查證：Tokyo Metro 9 線＋都營地下鐵 4 線＋日暮里・舎人ライナー＋東京さくらトラム。Tokyo Metro 站序及三語站名取官方各線頁；軌道幾何與站點座標採 OpenStreetMap route relations（© OpenStreetMap contributors，ODbL）。丸ノ內線方南町支線獨立建成 Mb，千代田線 C01–C20 由兩個 relation 順序接合。Toei 六線沿用東京都交通局官方 GTFS-JP 站序與既有線形。Tokyo Metro 班次為合成班距，只供流動示意，不是即時位置或官方逐班時刻。`,
  shape_source: 'Tokyo Metro: OSM route relations; Toei: existing official-stop geometry snapshot',
  lines: [...toei, ...metro],
};
await writeFile(DATA_FILE, JSON.stringify(output));
console.log(`✓ 已寫入 ${DATA_FILE}：${output.lines.length} 個營運 variant，Tokyo Metro 9 線完整（丸ノ內線 2 variants）`);
