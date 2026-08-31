#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [track, schedule] = await Promise.all([
  readFile(path.join(ROOT, 'data/nyc.json'), 'utf8').then(JSON.parse),
  readFile(path.join(ROOT, 'data/nyc_schedule_dense.json'), 'utf8').then(JSON.parse),
]);
const EXPECTED = {
  '1': [38, 'South Ferry', 'Van Cortlandt Park-242 St'], '2': [61, 'Flatbush Av-Brooklyn College', 'Wakefield-241 St'],
  '3': [34, 'New Lots Av', 'Harlem-148 St'], '4_Utica': [42, 'Crown Hts-Utica Av', 'Woodlawn'],
  '4_NewLots': [54, 'New Lots Av', 'Woodlawn'], '5_BowlingGreen': [25, 'Bowling Green', 'Eastchester-Dyre Av'],
  '5_Flatbush': [36, 'Flatbush Av-Brooklyn College', 'Eastchester-Dyre Av'], '5_Nereid': [33, 'Flatbush Av-Brooklyn College', 'Nereid Av'],
  '6': [38, 'Brooklyn Bridge-City Hall', 'Pelham Bay Park'], '6X': [29, 'Brooklyn Bridge-City Hall', 'Pelham Bay Park'],
  '7': [22, '34 St-Hudson Yards', 'Flushing-Main St'], '7X': [18, '34 St-Hudson Yards', 'Flushing-Main St'],
  A_FarRockaway: [59, 'Far Rockaway-Mott Av', 'Inwood-207 St'], A_Lefferts: [52, 'Ozone Park-Lefferts Blvd', 'Inwood-207 St'],
  A_RockawayPark: [35, 'Rockaway Park-Beach 116 St', 'Inwood-207 St'], B: [37, 'Brighton Beach', 'Bedford Park Blvd'],
  C: [40, 'Euclid Av', '168 St'], D: [41, 'Coney Island-Stillwell Av', 'Norwood-205 St'],
  E: [32, 'World Trade Center', 'Jamaica Center-Parsons/Archer'], F_53: [45, 'Coney Island-Stillwell Av', 'Jamaica-179 St'],
  F_63: [55, 'Coney Island-Stillwell Av', 'Jamaica-179 St'], FX: [39, 'Coney Island-Stillwell Av', 'Jamaica-179 St'],
  G: [21, 'Church Av', 'Court Sq'], S_Franklin: [4, 'Prospect Park', 'Franklin Av'],
  S_42St: [2, 'Grand Central-42 St', 'Times Sq-42 St'], S_Rockaway: [5, 'Rockaway Park-Beach 116 St', 'Broad Channel'],
  J: [30, 'Broad St', 'Jamaica Center-Parsons/Archer'], L: [24, 'Canarsie-Rockaway Pkwy', '8 Av'],
  M: [36, 'Middle Village-Metropolitan Av', 'Forest Hills-71 Av'], N_Bridge: [39, 'Coney Island-Stillwell Av', 'Astoria-Ditmars Blvd'],
  N_Tunnel: [45, 'Coney Island-Stillwell Av', 'Astoria-Ditmars Blvd'], Q: [34, 'Coney Island-Stillwell Av', '96 St'],
  R: [45, 'Bay Ridge-95 St', 'Forest Hills-71 Av'], SIR: [21, 'Tottenville', 'St George'],
  W: [23, 'Whitehall St-South Ferry', 'Astoria-Ditmars Blvd'], Z: [21, 'Broad St', 'Jamaica Center-Parsons/Archer'],
};
let failures = 0;
function check(ok, message) { if (!ok) { failures++; console.error(`✗ ${message}`); } }
check(track.lines.length === Object.keys(EXPECTED).length, `variant 數 ${track.lines.length}≠${Object.keys(EXPECTED).length}`);
check(schedule.date === '20260831', `服務日 ${schedule.date}≠20260831`);
check(/MTA New York City Transit/.test(schedule.source_notes) && !/Entur/.test(schedule.source_notes), '班表來源必須是 MTA，且不得殘留 Entur');
check(schedule.trains.length > 8000, `官方班次異常偏少：${schedule.trains.length}`);
for (const [id, [count, from, to]] of Object.entries(EXPECTED)) {
  const line = track.lines.find(row => row.id === id);
  check(Boolean(line), `缺 ${id}`);
  if (!line) continue;
  check(line.stations.length === count, `${id} 站數 ${line.stations.length}≠${count}`);
  check(line.officialEndpoints?.includes(from) && line.officialEndpoints?.includes(to), `${id} 官方端點不符`);
  check(line.shape.length >= 2 && line.shapeLen > 0, `${id} 缺官方 shape`);
  check(line.stations.every((station, index) => index === 0 || station.d >= line.stations[index - 1].d), `${id} 里程未單調排序`);
}
const sir = track.lines.find(line => line.id === 'SIR');
check(sir?.stations.map(station => station.name).includes('Arthur Kill'), 'SIR 缺 Arthur Kill');
check(track.lines.find(line => line.id === 'F_53')?.stations.some(station => station.name === 'Queens Plaza'), 'F_53 未走 53 St corridor');
check(track.lines.find(line => line.id === 'F_63')?.stations.some(station => station.name === '21 St-Queensbridge'), 'F_63 未走 63 St corridor');
check(!track.lines.find(line => line.id === 'N_Bridge')?.stations.some(station => station.name === 'Whitehall St-South Ferry'), 'N_Bridge 誤走 Montague Tunnel');
check(track.lines.find(line => line.id === 'N_Tunnel')?.stations.some(station => station.name === 'Whitehall St-South Ferry'), 'N_Tunnel 缺 Montague Tunnel');
for (const typeName of ['1','2','3','4','5','6','6X','7','7X','A','B','C','D','E','F','FX','G','S','J','L','M','N','Q','R','SIR','W','Z']) {
  const trains = schedule.trains.filter(train => train.typeName === typeName);
  check(trains.length > 0, `班表缺 ${typeName}`);
  check(trains.some(train => train.stops.at(-1)?.lat > train.stops[0]?.lat) && trains.some(train => train.stops.at(-1)?.lat < train.stops[0]?.lat), `${typeName} 缺雙向流動案例`);
}
if (failures) { console.error(`\n紐約路線驗證失敗：${failures} 項`); process.exit(1); }
console.log(`✓ 紐約 29 個 MTA service、${track.lines.length} 個 route variants、SIR 21 站、官方班表 ${schedule.trains.length} 班及雙向流動全數通過`);
