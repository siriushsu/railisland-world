#!/usr/bin/env node
// 倫敦官方時刻表建置器：用 TfL Unified API 的逐站時刻表（/Line/{id}/Timetable/{stop}?direction=）
// 重建平日逐班時刻，取代原本的合成班距。
//
// TfL 的逐站時刻表只列「從這一站發車」的班次，附帶每班到下游各站的分鐘數（stationIntervals）。
// 只查起點站會漏掉中途起駛的區間車，所以每條線、每個方向都依站序逐站查：
//   - 上游站查到的班次，已經能推算它經過下游各站的時間；
//   - 下游站查到的班次若在 ±1.5 分鐘內對得上某班已知列車、且下一站相同，就是同一班車；
//   - 對不上的就是在這一站起駛的新班次。
// 平日取「Monday - Thursday」，沒有就取「Monday - Friday」（TfL 部分線週五另有時刻）。
// 時刻精度是分鐘；同一分鐘的相鄰站往後推幾秒，維持時間單調。
//
// 每班再對回 data/london.json 的路徑 variant（同母線、依站碼順序包含這班全部停靠站的最短 variant），
// 站名與座標取 variant，列車沿既有線形跑。對不回任何 variant 的班次另外統計、不輸出。
//
// 用法：NODE_USE_ENV_PROXY=1 node tools/build_london_timetable.mjs [--refresh] [--offline]
// TfL 回應快取在 .cache/tfl-timetable。Powered by TfL Open Data。

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = path.join(ROOT, '.cache/tfl-timetable');
const TRACK_FILE = path.join(ROOT, 'data/london.json');
const SCHEDULE_FILE = path.join(ROOT, 'data/london_schedule_dense.json');
const SYNTHETIC_SOURCE = process.argv.includes('--synthetic-from') ? process.argv[process.argv.indexOf('--synthetic-from') + 1] : SCHEDULE_FILE;
const REFRESH = process.argv.includes('--refresh');
const OFFLINE = process.argv.includes('--offline');
const DIRECTIONS = ['outbound', 'inbound'];
const MATCH_MIN = 1.5;
const DWELL_SEC = 30;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function tfl(apiPath, file) {
  await mkdir(CACHE, { recursive: true });
  const cacheFile = path.join(CACHE, file);
  if (!REFRESH && existsSync(cacheFile)) {
    const text = await readFile(cacheFile, 'utf8');
    return text ? JSON.parse(text) : null;
  }
  if (OFFLINE) throw new Error(`離線模式缺少快取：${cacheFile}`);
  for (let attempt = 0; attempt < 6; attempt++) {
    const response = await fetch(`https://api.tfl.gov.uk/${apiPath}`, { headers: { 'User-Agent': 'RailIslandWorld/1.0 (timetable builder; github.com/siriushsu/railisland-world)' } });
    if (response.status === 404 || response.status === 400) { await writeFile(cacheFile, ''); await sleep(400); return null; }
    if (response.ok) {
      const text = await response.text();
      await writeFile(cacheFile, text);
      await sleep(400);
      return JSON.parse(text);
    }
    await sleep(response.status === 429 ? 15000 * (attempt + 1) : 3000 * (attempt + 1));
  }
  throw new Error(`TfL ${apiPath} 下載失敗`);
}

// 依各 orderedLineRoute 的相鄰關係排出「上游先」的站序（Kahn）；環或互相矛盾時取最早出現的站。
function stationOrder(routes) {
  const first = new Map(), next = new Map(), indeg = new Map();
  let k = 0;
  for (const ids of routes) for (let i = 0; i < ids.length; i++) {
    if (!first.has(ids[i])) first.set(ids[i], k++);
    if (!indeg.has(ids[i])) indeg.set(ids[i], 0);
    if (!next.has(ids[i])) next.set(ids[i], new Set());
    if (i + 1 < ids.length && !next.get(ids[i]).has(ids[i + 1])) {
      next.get(ids[i]).add(ids[i + 1]);
      indeg.set(ids[i + 1], (indeg.get(ids[i + 1]) || 0) + 1);
    }
  }
  const order = [], done = new Set();
  while (done.size < first.size) {
    let pick = [...first.keys()].filter(id => !done.has(id) && indeg.get(id) === 0).sort((a, b) => first.get(a) - first.get(b))[0];
    if (!pick) pick = [...first.keys()].filter(id => !done.has(id)).sort((a, b) => first.get(a) - first.get(b))[0];
    done.add(pick); order.push(pick);
    for (const n of next.get(pick)) indeg.set(n, indeg.get(n) - 1);
  }
  return order;
}

function weekdaySchedule(route) {
  const schedules = route.schedules || [];
  // 環線、漢默史密斯及城市線的平日班表分成「Wednesdays」「Thursdays」「Friday」，沒有 Monday 字樣
  for (const re of [/monday\s*-\s*thursday/i, /monday\s*-\s*friday/i, /wednesday/i, /tuesday/i, /thursday/i, /monday/i]) {
    const hit = schedules.find(s => re.test(s.name));
    if (hit) return hit;
  }
  return null;
}

const track = JSON.parse(await readFile(TRACK_FILE, 'utf8'));
const previous = JSON.parse(await readFile(SYNTHETIC_SOURCE, 'utf8'));
const lineIds = [...new Set(track.lines.map(line => line.lineId))];
// 母線 → 顯示車種（沿用現有班表的折疊名與顏色，不另立新 key）
const typeOfLine = new Map();
for (const train of previous.trains) {
  const variant = track.lines.find(line => train.train.startsWith(line.id));
  if (variant && !typeOfLine.has(variant.lineId)) typeOfLine.set(variant.lineId, train.typeName);
}

const trips = [];
const stats = { requests: 0, stations: 0, journeys: 0, duplicates: 0, originating: 0, unmatched: 0, partial: 0 };
for (const lineId of lineIds) {
  for (const direction of DIRECTIONS) {
    const sequence = await tfl(`Line/${lineId}/Route/Sequence/${direction}`, `${lineId}.${direction}.sequence.json`);
    const routes = (sequence?.orderedLineRoutes || []).map(r => r.naptanIds).filter(ids => ids?.length > 1);
    if (!routes.length) continue;
    const order = stationOrder(routes);
    const passes = new Map(); // stopId → [{ t, nextStop }]
    const lineTrips = [];
    for (const stopId of order) {
      const doc = await tfl(`Line/${lineId}/Timetable/${stopId}?direction=${direction}`, `${lineId}.${direction}.${stopId}.json`);
      stats.stations++;
      for (const route of doc?.timetable?.routes || []) {
        const schedule = weekdaySchedule(route);
        if (!schedule) continue;
        const intervals = new Map(route.stationIntervals.map(si => [String(si.id), si.intervals]));
        for (const journey of schedule.knownJourneys) {
          stats.journeys++;
          const t0 = Number(journey.hour) * 60 + Number(journey.minute);
          const list = intervals.get(String(journey.intervalId));
          if (!list?.length) continue;
          const nextStop = list[0].stopId;
          const known = passes.get(stopId)?.some(p => Math.abs(p.t - t0) <= MATCH_MIN && p.nextStop === nextStop);
          if (known) { stats.duplicates++; continue; }
          // TfL 的站間時刻有時同一站連續出現兩次（到站、離站各一筆）：合併成一站，第二筆當離站時刻
          const stops = [];
          for (const x of [{ stopId, timeToArrival: 0 }, ...list]) {
            const t = t0 + Number(x.timeToArrival);
            if (stops.length && stops.at(-1).id === x.stopId) stops.at(-1).dep = t;
            else stops.push({ id: x.stopId, t });
          }
          for (let i = 0; i < stops.length; i++) {
            const key = stops[i].id;
            if (!passes.has(key)) passes.set(key, []);
            passes.get(key).push({ t: stops[i].t, nextStop: stops[i + 1]?.id || null });
          }
          lineTrips.push({ lineId, direction, stops });
          stats.originating++;
        }
      }
    }
    trips.push(...lineTrips);
    console.log(`${lineId.padEnd(17)} ${direction.padEnd(8)} ${String(order.length).padStart(3)} 站  ${String(lineTrips.length).padStart(5)} 班`);
  }
}

// 對回路徑 variant：同母線、依站碼順序（正向或反向）包含全部停靠站的最短 variant。
const variantsByLine = new Map();
for (const line of track.lines) {
  if (!variantsByLine.has(line.lineId)) variantsByLine.set(line.lineId, []);
  variantsByLine.get(line.lineId).push(line);
}
function containsInOrder(codes, ids) {
  let k = 0;
  for (const code of codes) if (code === ids[k]) k++;
  return k === ids.length;
}
const trains = [], counters = new Map(), unmatchedByLine = {}, unmatchedSamples = {};
const r5 = x => Math.round(x * 1e5) / 1e5;
for (const trip of trips) {
  const ids = trip.stops.map(s => s.id);
  let best = null;
  for (const variant of variantsByLine.get(trip.lineId) || []) {
    const codes = variant.stations.map(s => s.code);
    for (const reversed of variant.oneWay ? [false] : [false, true]) { // 單向環（Tram）不可反向對應
      const seq = reversed ? [...codes].reverse() : codes;
      if (containsInOrder(seq, ids) && (!best || variant.stations.length < best.variant.stations.length)) best = { variant, reversed };
    }
  }
  if (!best) {
    // 包不住全部停靠站（TfL 某些班次經過 variant 沒有的站）：取能覆蓋最多連續停靠站的 variant，只留那一段
    let alt = null;
    for (const variant of variantsByLine.get(trip.lineId) || []) {
      const codes = new Set(variant.stations.map(s => s.code));
      let run = 0, bestRun = null, start = 0;
      ids.forEach((id, i) => { if (codes.has(id)) { if (!run) start = i; run++; if (!bestRun || run > bestRun.n) bestRun = { n: run, from: start, to: i }; } else run = 0; });
      if (bestRun && bestRun.n >= 2 && (!alt || bestRun.n > alt.run.n)) alt = { variant, run: bestRun };
    }
    if (!alt) { stats.unmatched++; unmatchedByLine[trip.lineId] = (unmatchedByLine[trip.lineId] || 0) + 1; if ((unmatchedSamples[trip.lineId] ||= []).length < 3) unmatchedSamples[trip.lineId].push(ids); continue; }
    const kept = trip.stops.slice(alt.run.from, alt.run.to + 1), keptIds = kept.map(s => s.id), codes = alt.variant.stations.map(s => s.code);
    const reversed = !containsInOrder(codes, keptIds);
    if (reversed && (alt.variant.oneWay || !containsInOrder([...codes].reverse(), keptIds))) { stats.unmatched++; unmatchedByLine[trip.lineId] = (unmatchedByLine[trip.lineId] || 0) + 1; if ((unmatchedSamples[trip.lineId] ||= []).length < 3) unmatchedSamples[trip.lineId].push(ids); continue; }
    trip.stops = kept;
    best = { variant: alt.variant, reversed };
    stats.partial++;
  }
  const byCode = new Map(best.variant.stations.map(s => [s.code, s]));
  const stops = [];
  for (let i = 0; i < trip.stops.length; i++) {
    const station = byCode.get(trip.stops[i].id);
    let arrSec = Math.round(trip.stops[i].t * 60);
    if (stops.length) arrSec = Math.max(arrSec, stops.at(-1).depSec + 20);
    const last = i === trip.stops.length - 1;
    const nextSec = last ? null : Math.round(trip.stops[i + 1].t * 60);
    const listedDep = Number.isFinite(trip.stops[i].dep) ? Math.round(trip.stops[i].dep * 60) : arrSec + DWELL_SEC;
    const depSec = last ? arrSec : Math.max(arrSec, Math.min(listedDep, nextSec - 20));
    stops.push({ name: station.name, lat: r5(station.lat), lon: r5(station.lon), arrSec, depSec });
  }
  const key = best.variant.id + (best.reversed ? '↑' : '↓');
  counters.set(key, (counters.get(key) || 0) + 1);
  trains.push({
    train: `${key}${String(counters.get(key)).padStart(3, '0')}`,
    typeName: typeOfLine.get(trip.lineId) || trip.lineId,
    carName: best.variant.name,
    color: best.variant.color,
    stops,
  });
}
// TfL 的逐站時刻 API 對國鐵站（910G 站碼）回 404：Elizabeth line 與六條 London Overground 拿不到官方時刻，
// 沿用原本的合成班距班次，並標 estimated。
const realLines = new Set(trips.map(trip => trip.lineId));
const syntheticLines = lineIds.filter(id => !realLines.has(id));
const variantLine = new Map(track.lines.map(line => [line.id, line.lineId]));
const carried = previous.trains.filter(train => {
  const variant = track.lines.find(line => train.train.startsWith(line.id));
  return variant && syntheticLines.includes(variantLine.get(variant.id));
}).map(train => ({ ...train, estimated: true }));
trains.push(...carried);
stats.syntheticLines = syntheticLines;
stats.syntheticTrains = carried.length;
trains.sort((a, b) => a.stops[0].depSec - b.stops[0].depSec);
const output = {
  system: 'TFL',
  date: '20261001',
  source_notes: 'Powered by TfL Open Data。逐班時刻取自 TfL Unified API 逐站時刻表（/Line/{id}/Timetable，2026-10-01 擷取）的平日班表（Monday–Thursday，無則 Monday–Friday）：依站序逐站查詢，上游已知班次經過的時刻 ±1.5 分鐘內視為同一班，其餘為該站起駛的班次；時刻精度為分鐘。路線、端點、via 與站點座標同 2026-08-31 TfL 現行資料；Underground 細部線形沿用 OSM route relations（© OpenStreetMap contributors，ODbL）。Elizabeth line 與六條 London Overground（Liberty、Lioness、Mildmay、Suffragette、Weaver、Windrush）在 TfL 逐站時刻 API 沒有資料，沿用 peak/offpeak 合成班距（班次標 estimated）。官方部分是表定時刻，不是即時位置，不反映臨時停駛、延誤或施工。',
  types: previous.types,
  trains,
};
await writeFile(SCHEDULE_FILE, JSON.stringify(output));
await writeFile(path.join(CACHE, 'build-report.json'), JSON.stringify({ stats, unmatchedByLine, unmatchedSamples, perVariant: Object.fromEntries(counters) }, null, 1));
console.log(`  合成班距沿用：${syntheticLines.join('、')}（${carried.length} 班）`);
console.log(`✓ 倫敦班表：${trains.length} 班，其中官方平日時刻 ${trains.length - carried.length} 班（逐站查 ${stats.stations} 次；起駛 ${stats.originating}、重複 ${stats.duplicates}、對不回 variant ${stats.unmatched}、只取部分 ${stats.partial}）`);
