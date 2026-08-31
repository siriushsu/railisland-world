#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const track = JSON.parse(await readFile(path.join(ROOT, 'data/singapore.json'), 'utf8'));
const schedule = JSON.parse(await readFile(path.join(ROOT, 'data/singapore_schedule_dense.json'), 'utf8'));
const EXPECTED_IDS = ['NSL', 'EWL', 'EWL_CGA', 'NEL', 'CCL', 'CCL_DG', 'DTL', 'TEL', 'BPLRT', 'SKLRT_E', 'SKLRT_W', 'PGLRT_E', 'PGLRT_W'];
// 2026-08-31 逐線對照 LTA 現行系統圖與各路線官方頁。這是營運站序 gate，不收錄圖上標為
// under construction 的 TEL5 Bedok South、TE31/DT37 Sungei Bedok 等未營運站。
const EXPECTED_STATIONS = {
  NSL: 'Marina South Pier|Marina Bay|Raffles Place|City Hall|Dhoby Ghaut|Somerset|Orchard|Newton|Novena|Toa Payoh|Braddell|Bishan|Ang Mo Kio|Yio Chu Kang|Khatib|Yishun|Canberra|Sembawang|Admiralty|Woodlands|Marsiling|Kranji|Yew Tee|Choa Chu Kang|Bukit Gombak|Bukit Batok|Jurong East',
  EWL: 'Tuas Link|Tuas West Road|Tuas Crescent|Gul Circle|Joo Koon|Pioneer|Boon Lay|Lakeside|Chinese Garden|Jurong East|Clementi|Dover|Buona Vista|Commonwealth|Queenstown|Redhill|Tiong Bahru|Outram Park|Tanjong Pagar|Raffles Place|City Hall|Bugis|Lavender|Kallang|Aljunied|Paya Lebar|Eunos|Kembangan|Bedok|Tanah Merah|Simei|Tampines (EW2)|Pasir Ris',
  EWL_CGA: 'Tanah Merah|Expo|Changi Airport',
  NEL: 'HarbourFront|Outram Park|Chinatown|Clarke Quay|Dhoby Ghaut|Little India|Farrer Park|Boon Keng|Potong Pasir|Woodleigh|Serangoon|Kovan|Hougang|Buangkok|Sengkang|Punggol|Punggol Coast',
  CCL: 'Bayfront|Marina Bay|Prince Edward Road|Cantonment|Keppel|HarbourFront|Telok Blangah|Labrador Park|Pasir Panjang|Haw Par Villa|Kent Ridge|one-north|Buona Vista|Holland Village|Farrer Road|Botanic Gardens|Caldecott|Marymount|Bishan|Lorong Chuan|Serangoon|Bartley|Tai Seng|MacPherson|Paya Lebar|Dakota|Mountbatten|Stadium|Nicoll Highway|Promenade|Bayfront',
  CCL_DG: 'Dhoby Ghaut|Bras Basah|Esplanade|Promenade|Nicoll Highway|Stadium|Mountbatten|Dakota|Paya Lebar|MacPherson|Tai Seng|Bartley|Serangoon|Lorong Chuan|Bishan|Marymount|Caldecott|Botanic Gardens|Farrer Road|Holland Village|Buona Vista|one-north|Kent Ridge|Haw Par Villa|Pasir Panjang|Labrador Park|Telok Blangah|HarbourFront|Keppel|Cantonment|Prince Edward Road',
  DTL: 'Bukit Panjang|Cashew|Hillview|Hume|Beauty World|King Albert Park|Sixth Avenue|Tan Kah Kee|Botanic Gardens|Stevens|Newton|Little India|Rochor|Bugis|Promenade|Bayfront|Downtown|Telok Ayer|Chinatown|Fort Canning|Bencoolen|Jalan Besar|Bendemeer|Geylang Bahru|Mattar|MacPherson|Ubi|Kaki Bukit|Bedok North|Bedok Reservoir|Tampines West|Tampines (DT32)|Tampines East|Upper Changi|Expo',
  TEL: 'Woodlands North|Woodlands|Woodlands South|Springleaf|Lentor|Mayflower|Bright Hill|Upper Thomson|Caldecott|Stevens|Napier|Orchard Boulevard|Orchard|Great World|Havelock|Outram Park|Maxwell|Shenton Way|Marina Bay|Gardens by the Bay|Tanjong Rhu|Katong Park|Tanjong Katong|Marine Parade|Marine Terrace|Siglap|Bayshore',
  BPLRT: 'Choa Chu Kang|South View|Keat Hong|Teck Whye|Phoenix|Bukit Panjang|Senja|Jelapang|Segar|Fajar|Bangkit|Pending|Petir|Bukit Panjang|Phoenix|Teck Whye|Keat Hong|South View|Choa Chu Kang',
  SKLRT_E: 'Sengkang|Compassvale|Rumbia|Bakau|Kangkar|Ranggung|Sengkang',
  SKLRT_W: 'Sengkang|Renjong|Tongkang|Layar|Fernvale|Thanggam|Kupang|Farmway|Cheng Lim|Sengkang',
  PGLRT_E: 'Punggol|Damai|Oasis|Kadaloor|Riviera|Coral Edge|Meridian|Cove|Punggol',
  PGLRT_W: 'Punggol|Soo Teck|Sumang|Nibong|Samudera|Punggol Point|Teck Lee|Sam Kee|Punggol',
};
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
check(Object.keys(EXPECTED_STATIONS).length === EXPECTED_IDS.length, '逐線站序 gate 未涵蓋全部 line variant');
for (const id of EXPECTED_IDS) {
  const actual = byId.get(id)?.stations.map(station => station.name).join('|');
  check(actual === EXPECTED_STATIONS[id], `${id} 的現行營運站序與 2026-08-31 官方稽核基準不一致`);
}

const critical = [
  ['NEL', 'Punggol Coast'], ['DTL', 'Hume'], ['TEL', 'Bayshore'],
  ['CCL', 'Keppel'], ['CCL', 'Cantonment'], ['CCL', 'Prince Edward Road'],
  ['PGLRT_W', 'Teck Lee'],
];
for (const [id, station] of critical) check(byId.get(id)?.stations.some(item => item.name === station), `${id} 缺 ${station}`);
check(uniqueStations(['CCL', 'CCL_DG']).size === 33, `CCL 營運站應為 33，實得 ${uniqueStations(['CCL', 'CCL_DG']).size}`);
check(uniqueStations(['EWL', 'EWL_CGA']).size === 35, `EWL 含樟宜支線應為 35 站，實得 ${uniqueStations(['EWL', 'EWL_CGA']).size}`);
check(uniqueStations(['NSL']).size === 27, `NSL 應為 27 站，實得 ${uniqueStations(['NSL']).size}`);
check(uniqueStations(['NEL']).size === 17, `NEL 應為 17 站，實得 ${uniqueStations(['NEL']).size}`);
check(uniqueStations(['DTL']).size === 35, `DTL 應為 35 站，實得 ${uniqueStations(['DTL']).size}`);
check(uniqueStations(['TEL']).size === 27, `TEL 現行營運範圍應為 27 站，實得 ${uniqueStations(['TEL']).size}`);
for (const futureStation of ['Bedok South', 'Sungei Bedok']) check(!uniqueStations(EXPECTED_IDS).has(futureStation), `未營運站 ${futureStation} 不應出現在現行路網`);
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
console.log(`\n✓ 新加坡現行 6 MRT＋3 LRT 的 13 個營運 variant：逐線站序、分支、站數、雙向流動與幾何 gate 全數通過`);
