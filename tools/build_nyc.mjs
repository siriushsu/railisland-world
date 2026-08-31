#!/usr/bin/env node
// MTA regular static GTFS 的路線主圖建置器。
//
// gtfs2rail.mjs 會忠實輸出當日全部班次，但「每個 route 只取一個最常見 shape」不適合
// 紐約：A／4／5 等線有營運分支，F／N 也有兩條真實走廊。這支腳本把 MTA 官方 route
// 說明中的正常營運端點拆成 route variants；Y 字網不壓成一條線，臨時施工短線也不會
// 取代主圖。班次仍由同一份官方 GTFS 產生，動畫端會依相鄰站自動貼到正確 variant。
//
// 用法：
//   node tools/gtfs2rail.mjs --gtfs /path/gtfs_subway.zip --sys "New York City Transit" \
//     --tz America/New_York --route-types 1,2 --typename-mode route --date 20260831 \
//     --rdp-eps 0.01 --source-name "MTA New York City Transit regular static GTFS" \
//     --source-url "https://rrgtfsfeeds.s3.amazonaws.com/gtfs_subway.zip" \
//     --source-license "MTA Developer Resources Terms" --out-prefix data/nyc
//   node tools/build_nyc.mjs --gtfs /path/gtfs_subway.zip

import { createReadStream } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import readline from 'node:readline';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).reduce((rows, token, i, all) => {
  if (token.startsWith('--')) rows.push([token.slice(2), all[i + 1]]);
  return rows;
}, []));
if (!args.gtfs) throw new Error('缺 --gtfs <MTA regular static GTFS zip 或解壓目錄>');
const GTFS = path.resolve(args.gtfs);
const IS_ZIP = GTFS.toLowerCase().endsWith('.zip');

function streamLines(name) {
  if (!IS_ZIP) return readline.createInterface({ input: createReadStream(path.join(GTFS, name)), crlfDelay: Infinity });
  const child = spawn('unzip', ['-p', GTFS, name], { stdio: ['ignore', 'pipe', 'inherit'] });
  return readline.createInterface({ input: child.stdout, crlfDelay: Infinity });
}
function parseCSVLine(line) {
  const values = [];
  let value = '', quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { value += '"'; i++; }
      else if (ch === '"') quoted = false;
      else value += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { values.push(value); value = ''; }
    else value += ch;
  }
  values.push(value);
  return values;
}
async function* csvRows(name) {
  let header;
  for await (const raw of streamLines(name)) {
    const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
    if (!line) continue;
    const values = parseCSVLine(line);
    if (!header) { header = values; continue; }
    yield Object.fromEntries(header.map((key, index) => [key, values[index] ?? '']));
  }
}

const VARIANTS = [
  ['1', '1', 'South Ferry', 'Van Cortlandt Park-242 St', '1 Broadway–7 Avenue Local'],
  ['2', '2', 'Flatbush Av-Brooklyn College', 'Wakefield-241 St', '2 7 Avenue Express'],
  ['3', '3', 'New Lots Av', 'Harlem-148 St', '3 7 Avenue Express'],
  ['4_Utica', '4', 'Crown Hts-Utica Av', 'Woodlawn', '4 Lexington Avenue Express · Utica'],
  ['4_NewLots', '4', 'New Lots Av', 'Woodlawn', '4 Lexington Avenue Express · New Lots'],
  ['5_BowlingGreen', '5', 'Bowling Green', 'Eastchester-Dyre Av', '5 Lexington Avenue Express · Bowling Green'],
  ['5_Flatbush', '5', 'Flatbush Av-Brooklyn College', 'Eastchester-Dyre Av', '5 Lexington Avenue Express · Flatbush'],
  ['5_Nereid', '5', 'Flatbush Av-Brooklyn College', 'Nereid Av', '5 Lexington Avenue Express · Nereid'],
  ['6', '6', 'Brooklyn Bridge-City Hall', 'Pelham Bay Park', '6 Lexington Avenue Local'],
  ['6X', '6X', 'Brooklyn Bridge-City Hall', 'Pelham Bay Park', '6 Express'],
  ['7', '7', '34 St-Hudson Yards', 'Flushing-Main St', '7 Flushing Local'],
  ['7X', '7X', '34 St-Hudson Yards', 'Flushing-Main St', '7 Express'],
  ['A_FarRockaway', 'A', 'Far Rockaway-Mott Av', 'Inwood-207 St', 'A 8 Avenue Express · Far Rockaway'],
  ['A_Lefferts', 'A', 'Ozone Park-Lefferts Blvd', 'Inwood-207 St', 'A 8 Avenue Express · Lefferts'],
  ['A_RockawayPark', 'A', 'Rockaway Park-Beach 116 St', 'Inwood-207 St', 'A 8 Avenue Express · Rockaway Park'],
  ['B', 'B', 'Brighton Beach', 'Bedford Park Blvd', 'B 6 Avenue Express'],
  ['C', 'C', 'Euclid Av', '168 St', 'C 8 Avenue Local'],
  ['D', 'D', 'Coney Island-Stillwell Av', 'Norwood-205 St', 'D 6 Avenue Express'],
  ['E', 'E', 'World Trade Center', 'Jamaica Center-Parsons/Archer', 'E 8 Avenue Local'],
  ['F_53', 'F', 'Coney Island-Stillwell Av', 'Jamaica-179 St', 'F Queens Boulevard Express · 53 St', ['Queens Plaza'], ['21 St-Queensbridge']],
  ['F_63', 'F', 'Coney Island-Stillwell Av', 'Jamaica-179 St', 'F Queens Boulevard Express · 63 St', ['21 St-Queensbridge']],
  ['FX', 'FX', 'Coney Island-Stillwell Av', 'Jamaica-179 St', 'FX Brooklyn F Express'],
  ['G', 'G', 'Church Av', 'Court Sq', 'G Brooklyn–Queens Crosstown'],
  ['S_Franklin', 'FS', 'Prospect Park', 'Franklin Av', 'S Franklin Avenue Shuttle'],
  ['S_42St', 'GS', 'Grand Central-42 St', 'Times Sq-42 St', 'S 42 Street Shuttle'],
  ['S_Rockaway', 'H', 'Rockaway Park-Beach 116 St', 'Broad Channel', 'S Rockaway Park Shuttle'],
  ['J', 'J', 'Broad St', 'Jamaica Center-Parsons/Archer', 'J Nassau Street Local'],
  ['L', 'L', 'Canarsie-Rockaway Pkwy', '8 Av', 'L 14 Street–Canarsie Local'],
  ['M', 'M', 'Middle Village-Metropolitan Av', 'Forest Hills-71 Av', 'M Queens Boulevard / 6 Avenue Local'],
  ['N_Bridge', 'N', 'Coney Island-Stillwell Av', 'Astoria-Ditmars Blvd', 'N Broadway Express · Manhattan Bridge', [], ['Whitehall St-South Ferry']],
  ['N_Tunnel', 'N', 'Coney Island-Stillwell Av', 'Astoria-Ditmars Blvd', 'N Broadway Local · Montague Tunnel', ['Whitehall St-South Ferry']],
  ['Q', 'Q', 'Coney Island-Stillwell Av', '96 St', 'Q Broadway Express'],
  ['R', 'R', 'Bay Ridge-95 St', 'Forest Hills-71 Av', 'R Broadway Local'],
  ['SIR', 'SI', 'Tottenville', 'St George', 'Staten Island Railway'],
  ['W', 'W', 'Whitehall St-South Ferry', 'Astoria-Ditmars Blvd', 'W Broadway Local'],
  ['Z', 'Z', 'Broad St', 'Jamaica Center-Parsons/Archer', 'Z Nassau Street Express'],
].map(([id, route, from, to, name, via = [], avoid = []]) => ({ id, route, from, to, name, via, avoid }));

const routes = new Map();
for await (const row of csvRows('routes.txt')) routes.set(row.route_id, row);
const stops = new Map();
for await (const row of csvRows('stops.txt')) stops.set(row.stop_id, row);
const trips = new Map();
for await (const row of csvRows('trips.txt')) trips.set(row.trip_id, { ...row, stopIds: [] });
for await (const row of csvRows('stop_times.txt')) {
  const trip = trips.get(row.trip_id);
  if (trip) trip.stopIds.push([Number(row.stop_sequence), row.stop_id]);
}
for (const trip of trips.values()) trip.stopIds.sort((a, b) => a[0] - b[0]);

function namesOf(trip) { return trip.stopIds.map(([, id]) => stops.get(id)?.stop_name).filter(Boolean); }
function matches(spec, names) {
  if (!names.length) return false;
  const endpoints = (names[0] === spec.from && names.at(-1) === spec.to) || (names[0] === spec.to && names.at(-1) === spec.from);
  return endpoints && spec.via.every(name => names.includes(name)) && spec.avoid.every(name => !names.includes(name));
}
const selected = new Map();
for (const spec of VARIANTS) {
  const candidates = [...trips.values()].filter(trip => trip.route_id === spec.route).map(trip => ({ trip, names: namesOf(trip) })).filter(row => matches(spec, row.names));
  candidates.sort((a, b) => b.names.length - a.names.length || a.trip.trip_id.localeCompare(b.trip.trip_id));
  if (!candidates.length) throw new Error(`${spec.id} 找不到 ${spec.from} ↔ ${spec.to} 的官方 trip`);
  selected.set(spec.id, candidates[0]);
}
const shapeIds = new Set([...selected.values()].map(row => row.trip.shape_id));
const rawShapes = new Map();
for await (const row of csvRows('shapes.txt')) {
  if (!shapeIds.has(row.shape_id)) continue;
  if (!rawShapes.has(row.shape_id)) rawShapes.set(row.shape_id, []);
  rawShapes.get(row.shape_id).push([Number(row.shape_pt_sequence), Number(row.shape_pt_lat), Number(row.shape_pt_lon)]);
}
for (const points of rawShapes.values()) points.sort((a, b) => a[0] - b[0]);

const EARTH_KM = 6371;
function distKm(a, b) {
  const y = (b[0] - a[0]) * Math.PI / 180 * EARTH_KM;
  const x = (b[1] - a[1]) * Math.PI / 180 * EARTH_KM * Math.cos((a[0] + b[0]) * Math.PI / 360);
  return Math.hypot(x, y);
}
function cumulative(shape) {
  const out = [0];
  for (let i = 1; i < shape.length; i++) out.push(out[i - 1] + distKm(shape[i - 1], shape[i]));
  return out;
}
function project(point, shape, cum) {
  let best = { d: 0, gap: Infinity };
  for (let i = 0; i < shape.length - 1; i++) {
    const latScale = Math.cos(point[0] * Math.PI / 180);
    const ax = (shape[i][1] - point[1]) * latScale, ay = shape[i][0] - point[0];
    const bx = (shape[i + 1][1] - point[1]) * latScale, by = shape[i + 1][0] - point[0];
    const vx = bx - ax, vy = by - ay, length2 = vx * vx + vy * vy;
    const t = length2 ? Math.max(0, Math.min(1, -(ax * vx + ay * vy) / length2)) : 0;
    const q = [shape[i][0] + (shape[i + 1][0] - shape[i][0]) * t, shape[i][1] + (shape[i + 1][1] - shape[i][1]) * t];
    const gap = distKm(point, q);
    if (gap < best.gap) best = { d: cum[i] + distKm(shape[i], q), gap };
  }
  return best;
}

const lines = VARIANTS.map(spec => {
  const { trip, names } = selected.get(spec.id);
  const route = routes.get(spec.route);
  const shape = rawShapes.get(trip.shape_id).map(([, lat, lon]) => [lat, lon]);
  const cum = cumulative(shape);
  const stationRows = trip.stopIds.map(([, stopId], index) => {
    const stop = stops.get(stopId);
    const point = [Number(stop.stop_lat), Number(stop.stop_lon)];
    const pr = project(point, shape, cum);
    if (pr.gap > 0.12) throw new Error(`${spec.id} ${names[index]} 離官方 shape ${(pr.gap * 1000).toFixed(1)}m`);
    return { name: names[index], lat: +point[0].toFixed(6), lon: +point[1].toFixed(6), d: +pr.d.toFixed(4) };
  });
  stationRows.sort((a, b) => a.d - b.d);
  const dedup = stationRows.filter((station, index) => index === 0 || station.name !== stationRows[index - 1].name || Math.abs(station.d - stationRows[index - 1].d) > 0.1);
  return {
    id: spec.id,
    name: spec.name,
    color: `#${route.route_color || '2E6FB0'}`,
    shape: shape.map(([lat, lon]) => [+lat.toFixed(6), +lon.toFixed(6)]),
    shapeLen: +cum.at(-1).toFixed(4),
    stations: dedup,
    gtfsRouteId: spec.route,
    gtfsShapeId: trip.shape_id,
    officialEndpoints: [spec.from, spec.to],
  };
});

const output = {
  system: 'New York City Transit',
  data_date: '20260831',
  source_notes: '路線、站序、站點、線形與班次均取 MTA New York City Transit regular static GTFS（feed_version 20260826-X-long-term-supplement-trip-ids；服務日 2026-08-31）。Subway 正常營運範圍另與 MTA 2025-08 官方大型路線圖逐線複核；Staten Island Railway 21 站另與 MTA 官方時刻表複核。A／4／5 等分支及 F／N 的不同走廊分開建成 route variants，未把 Y 字網壓成單一路徑。畫面為官方靜態時刻表推演，不是即時位置。',
  shape_source: 'MTA regular static GTFS shapes.txt',
  lines,
};
await writeFile(path.join(ROOT, 'data/nyc.json'), JSON.stringify(output));
console.log(`✓ 紐約主圖：${lines.length} 個 route variants，${new Set(lines.flatMap(line => line.stations.map(station => station.name))).size} 個唯一站名`);
for (const line of lines) console.log(`${line.id.padEnd(17)} ${String(line.stations.length).padStart(2)} 站  ${line.officialEndpoints.join(' ↔ ')}`);
