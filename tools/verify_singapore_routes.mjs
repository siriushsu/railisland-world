#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const track = JSON.parse(await readFile(path.join(ROOT, 'data/singapore.json'), 'utf8'));
const schedule = JSON.parse(await readFile(path.join(ROOT, 'data/singapore_schedule_dense.json'), 'utf8'));
const EXPECTED_IDS = ['NSL', 'EWL', 'EWL_CGA', 'NEL', 'CCL', 'CCL_DG', 'DTL', 'TEL', 'BPLRT', 'SKLRT_E', 'SKLRT_W', 'PGLRT_E', 'PGLRT_W'];
const byId = new Map(track.lines.map(line => [line.id, line]));
let failures = 0;

function check(ok, message) {
  if (ok) return;
  failures++;
  console.error(`✗ ${message}`);
}
function haversine(a, b) {
  const rad = value => value * Math.PI / 180;
  const p1 = rad(a[0]), p2 = rad(b[0]);
  const dp = p2 - p1, dl = rad(b[1] - a[1]);
  const q = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(q)));
}
function uniqueStations(ids) {
  return new Set(ids.flatMap(id => byId.get(id).stations.map(station => station.name)));
}

check(track.official_network_checked_at === '2026-08-31', '官方路網查證日未寫入');
check(track.source_notes.includes('2026-07-12') && track.source_notes.includes('只供流動示意'), '來源說明未同時交代 CCL6 與合成班距');
check(track.lines.length === EXPECTED_IDS.length, `line variant 數 ${track.lines.length}≠${EXPECTED_IDS.length}`);
check(EXPECTED_IDS.every(id => byId.has(id)), '缺少必要 line id');
check(!byId.has('CCL_CE'), '舊 CCL_CE 分支仍殘留');

const critical = [
  ['NEL', 'Punggol Coast'], ['DTL', 'Hume'], ['TEL', 'Bayshore'],
  ['CCL', 'Keppel'], ['CCL', 'Cantonment'], ['CCL', 'Prince Edward Road'],
  ['PGLRT_W', 'Teck Lee'],
];
for (const [id, station] of critical) check(byId.get(id)?.stations.some(item => item.name === station), `${id} 缺 ${station}`);
check(uniqueStations(['CCL', 'CCL_DG']).size === 33, `CCL 營運站應為 33，實得 ${uniqueStations(['CCL', 'CCL_DG']).size}`);
check(uniqueStations(['BPLRT']).size === 13, `BPLRT 營運站應為 13，實得 ${uniqueStations(['BPLRT']).size}`);
check(uniqueStations(['SKLRT_E', 'SKLRT_W']).size === 14, `Sengkang LRT 營運站應為 14，實得 ${uniqueStations(['SKLRT_E', 'SKLRT_W']).size}`);
check(uniqueStations(['PGLRT_E', 'PGLRT_W']).size === 15, `Punggol LRT 含 Punggol 中心站應為 15，實得 ${uniqueStations(['PGLRT_E', 'PGLRT_W']).size}`);

for (const line of track.lines) {
  check(Array.isArray(line.shape) && line.shape.length >= 2, `${line.id} 缺 shape`);
  check(Array.isArray(line.stations) && line.stations.length >= 2, `${line.id} 缺 stations`);
  const ds = line.stations.map(station => station.d);
  check(ds.every((d, i) => Number.isFinite(d) && (!i || d >= ds[i - 1] - 1e-6)), `${line.id} 站點里程非遞增`);
  check(ds[0] >= -1e-6 && ds.at(-1) <= line.shapeLen + 0.02, `${line.id} 站點里程超出 shape`);
  const maxJump = Math.max(...line.shape.slice(1).map((point, i) => haversine(line.shape[i], point)));
  // 地下長直線／跨海段的 OSM way 可能只有端點；1.2km 仍足以抓出跨區跳接，
  // 不把缺少中間控制點誤判成斷線。
  check(maxJump < 1.2, `${line.id} shape 相鄰點跳距 ${maxJump.toFixed(3)} km`);
  if (line.stations[0].name === line.stations.at(-1).name) {
    check(haversine(line.shape[0], line.shape.at(-1)) < 0.05, `${line.id} 站序為環線但 shape 未閉合`);
  }

  const trains = schedule.trains.filter(train => train.carName === line.name);
  const down = trains.find(train => train.train.startsWith(`${line.id}↓`));
  const up = trains.find(train => train.train.startsWith(`${line.id}↑`));
  check(Boolean(down && up), `${line.id} 沒有雙向動畫班次`);
  if (down) check(down.stops.map(stop => stop.name).join('|') === line.stations.map(station => station.name).join('|'), `${line.id} ↓ 站序與路線不一致`);
  if (up) check(up.stops.map(stop => stop.name).join('|') === [...line.stations].reverse().map(station => station.name).join('|'), `${line.id} ↑ 站序與路線不一致`);
  const noon = trains.filter(train => train.stops[0].depSec <= 43200 && train.stops.at(-1).arrSec >= 43200).length;
  check(noon > 0, `${line.id} 中午沒有流動列車`);
  console.log(`✓ ${line.id.padEnd(8)} ${String(line.stations.length).padStart(2)} 站　${trains.length} 班　中午 ${noon} 班`);
}

if (failures) {
  console.error(`\n新加坡路線驗證失敗：${failures} 項`);
  process.exit(1);
}
console.log(`\n✓ 新加坡 13 個營運 variant：CCL 33 站、三套 LRT、雙向流動與幾何基本 gate 全數通過`);
