#!/usr/bin/env node
// Rebuild Singapore CCL6 + the three LRT systems from current OSM route
// relations. The official in-scope network is fixed by LTA; OSM supplies the
// physical geometry and ordered stop positions under ODbL.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_FILE = path.join(ROOT, 'data/singapore.json');
const argValue = flag => {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : null;
};
const CACHE = path.resolve(argValue('--cache-dir') || path.join(ROOT, '.cache/osm-singapore'));
const REFRESH = process.argv.includes('--refresh');
const OFFLINE = process.argv.includes('--offline');
const SOURCE_DATE = '2026-08-31';
const COLOR = { CCL: '#fa9e0d', LRT: '#748477' };

const SPECS = [
  {
    relationId: 2076291, id: 'CCL', name: '環線主環 Circle Line Loop', color: COLOR.CCL,
    peakHeadwaySec: 120, offpeakHeadwaySec: 330, closeLoop: true,
  },
  {
    relationId: 7981669, id: 'CCL_DG', name: '環線多美歌支線 Circle Line Dhoby Ghaut–Prince Edward Road', color: COLOR.CCL,
    peakHeadwaySec: 240, offpeakHeadwaySec: 360,
  },
  {
    relationId: 1159434, id: 'BPLRT', name: '武吉班讓輕軌 Bukit Panjang LRT', color: COLOR.LRT,
    peakHeadwaySec: 180, offpeakHeadwaySec: 300,
  },
  {
    relationId: 2312985, id: 'SKLRT_E', name: '盛港輕軌東環 Sengkang LRT East Loop', color: COLOR.LRT,
    peakHeadwaySec: 240, offpeakHeadwaySec: 480,
  },
  {
    relationId: 1146941, id: 'SKLRT_W', name: '盛港輕軌西環 Sengkang LRT West Loop', color: COLOR.LRT,
    peakHeadwaySec: 240, offpeakHeadwaySec: 480,
  },
  {
    relationId: 1146942, id: 'PGLRT_E', name: '榜鵝輕軌東環 Punggol LRT East Loop', color: COLOR.LRT,
    peakHeadwaySec: 240, offpeakHeadwaySec: 480,
  },
  {
    relationId: 2312984, id: 'PGLRT_W', name: '榜鵝輕軌西環 Punggol LRT West Loop', color: COLOR.LRT,
    peakHeadwaySec: 240, offpeakHeadwaySec: 480,
  },
];

function haversine(a, b) {
  const rad = value => value * Math.PI / 180;
  const p1 = rad(a[0]), p2 = rad(b[0]);
  const dp = p2 - p1, dl = rad(b[1] - a[1]);
  const q = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(q)));
}

function normalizedStationName(name) {
  return String(name || '')
    .replace(/\s+-\s+(?:East|West) Loop Clockwise$/i, '')
    .trim();
}

function rotateClosedShape(shape, station, reverse = false) {
  let open = shape.slice(0, -1);
  if (reverse) open = [...open].reverse();
  let nearest = 0, gap = Infinity;
  for (let i = 0; i < open.length; i++) {
    const d = haversine(open[i], [station.lat, station.lon]);
    if (d < gap) { gap = d; nearest = i; }
  }
  const rotated = [...open.slice(nearest), ...open.slice(0, nearest)];
  rotated.push(rotated[0]);
  return rotated;
}

function projectOrderedStations(shape, inputStations) {
  const cumulative = [0];
  for (let i = 1; i < shape.length; i++) cumulative.push(cumulative.at(-1) + haversine(shape[i - 1], shape[i]));
  const stations = inputStations.map(station => ({ ...station }));
  let previousD = 0, maxSnapKm = 0, snapTotalKm = 0;
  for (const station of stations) {
    const latScale = 111.32;
    const lonScale = 111.32 * Math.cos(station.lat * Math.PI / 180);
    let best = null;
    for (let i = 0; i < shape.length - 1; i++) {
      const a = shape[i], b = shape[i + 1];
      const ax = (a[1] - station.lon) * lonScale, ay = (a[0] - station.lat) * latScale;
      const bx = (b[1] - station.lon) * lonScale, by = (b[0] - station.lat) * latScale;
      const dx = bx - ax, dy = by - ay;
      const denom = dx * dx + dy * dy;
      const t = denom ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / denom)) : 0;
      const x = ax + dx * t, y = ay + dy * t;
      const gap = Math.hypot(x, y);
      const d = cumulative[i] + (cumulative[i + 1] - cumulative[i]) * t;
      if (d + 0.01 < previousD) continue;
      if (!best || gap < best.gap) best = { gap, d };
    }
    if (!best || best.gap > 0.25) return null;
    station.d = Math.round(best.d * 10000) / 10000;
    previousD = station.d;
    maxSnapKm = Math.max(maxSnapKm, best.gap);
    snapTotalKm += best.gap;
  }
  return { shape, stations, shapeLen: cumulative.at(-1), maxSnapKm, snapTotalKm };
}

async function relationDocument(relationId) {
  await mkdir(CACHE, { recursive: true });
  const cacheFile = path.join(CACHE, `${relationId}.json`);
  if (!REFRESH && existsSync(cacheFile)) return JSON.parse(await readFile(cacheFile, 'utf8'));
  if (OFFLINE) throw new Error(`離線模式缺少 relation ${relationId} 快取：${cacheFile}`);
  const url = `https://api.openstreetmap.org/api/0.6/relation/${relationId}/full.json`;
  const response = await fetch(url, { headers: { 'User-Agent': 'RailIslandWorld/1.0 (route data builder)' } });
  if (!response.ok) throw new Error(`OSM relation ${relationId} 下載失敗：HTTP ${response.status}`);
  const text = await response.text();
  const data = JSON.parse(text);
  await writeFile(cacheFile, text);
  return data;
}

function relationGeometry(document, spec) {
  const byKey = new Map(document.elements.map(element => [`${element.type}/${element.id}`, element]));
  const relation = byKey.get(`relation/${spec.relationId}`);
  if (!relation) throw new Error(`relation ${spec.relationId} 不在 OSM 回應中`);
  const stopMembers = relation.members.filter(member => member.type === 'node' && member.role.startsWith('stop'));
  const stations = stopMembers.map(member => {
    const node = byKey.get(`node/${member.ref}`);
    if (!node || !Number.isFinite(node.lat) || !Number.isFinite(node.lon)) {
      throw new Error(`${spec.id} 站點 node ${member.ref} 缺座標`);
    }
    return { name: normalizedStationName(node.tags?.name), lat: node.lat, lon: node.lon };
  });
  if (stations.length < 2 || stations.some(station => !station.name)) {
    throw new Error(`${spec.id} 的有序 stop 成員不完整`);
  }

  const wayMembers = relation.members.filter(member => member.type === 'way');
  const shapeNodeIds = [];
  for (const member of wayMembers) {
    const way = byKey.get(`way/${member.ref}`);
    if (!way?.nodes?.length) throw new Error(`${spec.id} way ${member.ref} 缺 nodes`);
    let ids = [...way.nodes];
    if (member.role === 'backward') ids.reverse();
    if (shapeNodeIds.length && ids[0] !== shapeNodeIds.at(-1)) {
      if (ids.at(-1) === shapeNodeIds.at(-1)) ids.reverse();
      else throw new Error(`${spec.id} relation way ${member.ref} 與前段不連續`);
    }
    shapeNodeIds.push(...(shapeNodeIds.length ? ids.slice(1) : ids));
  }
  let shape = shapeNodeIds.map(nodeId => {
    const node = byKey.get(`node/${nodeId}`);
    if (!node || !Number.isFinite(node.lat) || !Number.isFinite(node.lon)) {
      throw new Error(`${spec.id} shape node ${nodeId} 缺座標`);
    }
    return [node.lat, node.lon];
  });
  if (shape.length < 2) throw new Error(`${spec.id} shape 為空`);
  if (spec.closeLoop && normalizedStationName(stations[0].name) !== normalizedStationName(stations.at(-1).name)) {
    stations.push({ ...stations[0] });
  }

  const isLoop = haversine(shape[0], shape.at(-1)) <= 0.05 &&
    (spec.closeLoop || normalizedStationName(stations[0].name) === normalizedStationName(stations.at(-1).name));
  if (spec.closeLoop && !isLoop) {
    throw new Error(`${spec.id} 標為環線但 relation shape 未閉合`);
  }
  const candidates = isLoop
    ? [rotateClosedShape(shape, stations[0]), rotateClosedShape(shape, stations[0], true)]
    : [shape];
  const projected = candidates.map(candidate => projectOrderedStations(candidate, stations)).filter(Boolean)
    .sort((a, b) => a.snapTotalKm - b.snapTotalKm)[0];
  if (!projected) throw new Error(`${spec.id} 有站點無法依序貼合 relation shape`);
  shape = projected.shape;
  const projectedStations = projected.stations;
  const shapeLen = projected.shapeLen;
  const relationTimestamp = relation.timestamp || null;
  return {
    id: spec.id,
    name: spec.name,
    color: spec.color,
    peakHeadwaySec: spec.peakHeadwaySec,
    offpeakHeadwaySec: spec.offpeakHeadwaySec,
    headway_estimated: true,
    motionModel: 'synthetic-headway',
    osmRelationId: spec.relationId,
    osmRelationTimestamp: relationTimestamp,
    stations: projectedStations,
    shape: shape.map(([lat, lon]) => [Math.round(lat * 1e6) / 1e6, Math.round(lon * 1e6) / 1e6]),
    shapeLen: Math.round(shapeLen * 10000) / 10000,
    _maxSnapKm: projected.maxSnapKm,
  };
}

const original = JSON.parse(await readFile(DATA_FILE, 'utf8'));
const rebuilt = [];
for (const spec of SPECS) rebuilt.push(relationGeometry(await relationDocument(spec.relationId), spec));
const rebuiltById = new Map(rebuilt.map(line => [line.id, line]));
const originalById = new Map(original.lines.map(line => [line.id, line]));
const order = ['NSL', 'EWL', 'EWL_CGA', 'NEL', 'CCL', 'CCL_DG', 'DTL', 'TEL', 'BPLRT', 'SKLRT_E', 'SKLRT_W', 'PGLRT_E', 'PGLRT_W'];
const lines = order.map(id => rebuiltById.get(id) || originalById.get(id));
if (lines.some(line => !line)) throw new Error('新加坡輸出順序含不存在的 line id');

for (const line of rebuilt) {
  console.log(`${line.id.padEnd(8)} ${String(line.stations.length).padStart(2)} 站　${line.shape.length} shape 點　${line.shapeLen.toFixed(2)} km　最大貼軌 ${Math.round(line._maxSnapKm * 1000)} m`);
  delete line._maxSnapKm;
}

const relationList = SPECS.map(spec => spec.relationId).join(', ');
const output = {
  ...original,
  data_date: SOURCE_DATE.replaceAll('-', ''),
  official_network_checked_at: SOURCE_DATE,
  source_notes: `現行營運範圍依 LTA MRT/LRT Map（${SOURCE_DATE} 查證）：6 套 MRT＋Bukit Panjang、Sengkang、Punggol 3 套 LRT，Circle Line 6 已於 2026-07-12 通車。軌道幾何與有序站點採 OpenStreetMap route relations ${relationList}（© OpenStreetMap contributors，ODbL）；既有 MRT 幾何沿用 2026-07-11 OSM 路網。班次為 tools/headway2sched.mjs 合成班距，只供流動示意，不是即時位置或官方逐班時刻。`,
  shape_source: 'OSM route relations for CCL6/LRT; existing MRT OSM railway ways',
  lines,
};
await writeFile(DATA_FILE, JSON.stringify(output));
console.log(`✓ 已寫入 ${DATA_FILE}：${lines.length} 個營運 variant`);
