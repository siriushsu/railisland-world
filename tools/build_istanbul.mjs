#!/usr/bin/env node
// 伊斯坦堡 İBB 全市 GTFS 前置展開器──城市專用一次性腳本(cp1254 轉碼 + frequencies.csv 班距展開成逐車
// stop_times),輸出標準 GTFS .txt 目錄,供 tools/gtfs2rail.mjs(不支援 frequencies.txt、不做編碼轉換、
// 假設檔名為 .txt)原封不動消化。gtfs2rail.mjs 本身不修改,其他城市重跑結果不受影響。
//
// 動機:İBB 原始匯出的 .csv 是 Windows-1254(cp1254)編碼,且班次多以 frequencies.csv 的班距(headway)
// 表達(exact_times=0),而非逐車 stop_times;gtfs2rail.mjs 只認標準逐車 stop_times.txt。此腳本把兩者
// 併為「已展開的標準 GTFS」,對 gtfs2rail.mjs 零侵入。
//
// 只保留軌道路線(route_type∈{0,1,6,7}:電車 Tram/地鐵-Marmaray Metro-Rail/纜車 Cable car/纜索 Funicular),
// 排除公車(3)、渡輪(4)、小巴(9)、計程共乘(10)──此為 İBB feed 的路線類型慣例,非 GTFS 標準列舉值,
// 已用實際資料核對(route_short_name/agency 對照)。
//
// calendar.txt 效期延展:原始快照多數 service end_date 止於 2024-12-31(feed 為停止更新的舊快照)。
// 本站以「代表性星期三班表」呈現各城市而非即時時刻,故僅將 end_date 技術性延展至 2026-12-31 以命中
// --date 20260715,不改動 start_date 與星期位元(服務所屬星期幾不變、班距/班次型態不變)。
//
// 用法:node tools/build_istanbul.mjs [srcDir] [outDir]
//   接續:node tools/gtfs2rail.mjs --gtfs <outDir> --sys 伊斯坦堡軌道 --tz Europe/Istanbul \
//     --route-types 0,1,6,7 --out-prefix data/istanbul --date 20260715 --typename-mode route

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRATCH = '/private/tmp/claude-501/-Users-xuxiang-Code------/2cbdb064-06d3-4c63-90ae-6b17706bf3bc/scratchpad';
const SRC_DIR = process.argv[2] || path.join(SCRATCH, 'istanbul/gtfs_ibb');
const OUT_DIR = process.argv[3] || path.join(SCRATCH, 'istanbul/gtfs_norm');
mkdirSync(OUT_DIR, { recursive: true });

// ── cp1254 CSV 讀寫(全文字元機掃描,quote-aware,支援欄位內嵌逗號/換行,RFC4180 子集) ──
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
      continue;
    }
    if (c === '"') { inQ = true; continue; }
    if (c === ',') { row.push(field); field = ''; continue; }
    if (c === '\r') continue;
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
    field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}
function rowsToObjects(rows, fileLabel) {
  const header = rows[0];
  const out = [];
  let malformed = 0;
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r.length === 1 && r[0] === '') continue;
    // 少數來源列整行被誤包成單一引號欄位(如 routes.csv route_id=7431 該列),欄位數對不上表頭;
    // 直接跳過,避免其餘欄位以 ''(空字串)頂替時被 Number('')===0 誤判成合法列舉值(如 route_type)。
    if (r.length !== header.length) { malformed++; continue; }
    const obj = {};
    for (let j = 0; j < header.length; j++) obj[header[j]] = r[j] ?? '';
    out.push(obj);
  }
  if (malformed) console.warn(`  ${fileLabel}: 跳過 ${malformed} 筆欄位數不符表頭的異常列`);
  return out;
}
function readCSV(name) {
  const buf = readFileSync(path.join(SRC_DIR, name));
  const text = new TextDecoder('windows-1254').decode(buf);
  return rowsToObjects(parseCSV(text), name);
}
function csvEscape(v) {
  v = v == null ? '' : String(v);
  if (/[",\n\r]/.test(v)) return '"' + v.replace(/"/g, '""') + '"';
  return v;
}
function writeCSV(name, header, rows) {
  const lines = [header.join(',')];
  for (const r of rows) lines.push(header.map(h => csvEscape(r[h])).join(','));
  writeFileSync(path.join(OUT_DIR, name), lines.join('\r\n') + '\r\n', 'utf8');
}
const hmsToSec = t => {
  const p = t.split(':').map(Number);
  return p[0] * 3600 + p[1] * 60 + (p[2] || 0);
};
const secToHms = s => {
  s = Math.round(s);
  const hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
};

// ══════════════════════════════════════════════════════════════════
// 1) routes.txt:只留軌道 route_type,補官方線色(Wikipedia Module:Adjacent_stations/Istanbul_Metro
//    與 en.wikipedia.org/wiki/Marmaray 之 rail line 樣板色,curl 直接讀取原始 wikitext 核對;
//    TF1/TF2 纜車查無官方色票,以區辨色暫代,已於 source_notes 註明)
// ══════════════════════════════════════════════════════════════════
const RAIL_TYPES = new Set([0, 1, 6, 7]);
const COLOR_MAP = { // route_short_name -> hex(不含#)
  M1A: 'EE2229', M1B: 'EE2229', M2: '059A4D', M2A: '059A4D', M3: '0CA6DF', M3A: '0CA6DF',
  M4: 'E81E77', M5: '683166', M6: 'C9AA79', M7: 'F490B3', M8: '487ABF', M9: 'FCD10D',
  Marmaray: '5A5F5C', Marmaray1: '5A5F5C', Marmaray2: '5A5F5C',
  T1: '004b86', T3: '99562f', T4: 'ff7e42',
  F1: '7A745A', F2: '7A745A', F3: '7A745A',
  TF1: '3AA6A0', TF2: '3AA6A0', // 無官方色票,區辨色暫代
};
const routesAll = readCSV('routes.csv');
const railRoutes = routesAll.filter(r => RAIL_TYPES.has(Number(r.route_type)));
for (const r of railRoutes) {
  const c = COLOR_MAP[r.route_short_name];
  if (c) r.route_color = c;
}
console.log(`routes: 軌道路線 ${railRoutes.length} 條(route_type∈{0,1,6,7})`);
const railRouteIds = new Set(railRoutes.map(r => r.route_id));
writeCSV('routes.txt', ['route_id', 'agency_id', 'route_short_name', 'route_long_name', 'route_desc', 'route_type', 'route_url', 'route_color', 'route_text_color'], railRoutes);

// ── agency.txt:passthrough(僅轉碼) ──
const agencyAll = readCSV('agency.csv');
writeCSV('agency.txt', ['agency_id', 'agency_name', 'agency_url', 'agency_timezone', 'agency_lang', 'agency_phone', 'agency_fare_url', 'agency_email'], agencyAll);

// ══════════════════════════════════════════════════════════════════
// 2) calendar.txt:end_date < 20260715 者延展至 20261231(星期位元/start_date 不變)
// ══════════════════════════════════════════════════════════════════
const calendarAll = readCSV('calendar.csv');
let extended = 0;
for (const c of calendarAll) {
  if (c.end_date < '20260715') { c.end_date = '20261231'; extended++; }
}
console.log(`calendar: ${calendarAll.length} 筆服務日曆,延展 end_date ${extended} 筆(原始快照效期止於 2024 年)`);
writeCSV('calendar.txt', ['service_id', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'start_date', 'end_date'], calendarAll);
writeCSV('calendar_dates.txt', ['service_id', 'date', 'exception_type'], []); // 原始 feed 無此檔,補空表頭避免 gtfs2rail.mjs 開檔失敗

// ══════════════════════════════════════════════════════════════════
// 3) trips.txt / stop_times.txt / frequencies.txt → 展開 frequencies 為逐車 trip
// ══════════════════════════════════════════════════════════════════
const tripsAll = readCSV('trips.csv');
const railTrips = tripsAll.filter(t => railRouteIds.has(t.route_id));
const railTripIds = new Set(railTrips.map(t => t.trip_id));
console.log(`trips: 軌道 trip ${railTrips.length} 筆(全 feed ${tripsAll.length} 筆)`);

const freqAll = readCSV('frequencies.csv');
const freqRail = freqAll.filter(f => railTripIds.has(f.trip_id));
const freqByTrip = new Map(); // tripId -> [freq rows]
for (const f of freqRail) {
  if (!freqByTrip.has(f.trip_id)) freqByTrip.set(f.trip_id, []);
  freqByTrip.get(f.trip_id).push(f);
}
console.log(`frequencies: 軌道班距列 ${freqRail.length} 筆,涵蓋 trip(樣板)${freqByTrip.size} 個`);

const stopTimesAllRaw = readCSV('stop_times.csv');
const stByTrip = new Map(); // tripId -> [{...}] (依 stop_sequence 排序)
for (const st of stopTimesAllRaw) {
  if (!railTripIds.has(st.trip_id)) continue;
  if (!stByTrip.has(st.trip_id)) stByTrip.set(st.trip_id, []);
  stByTrip.get(st.trip_id).push(st);
}
for (const arr of stByTrip.values()) arr.sort((a, b) => Number(a.stop_sequence) - Number(b.stop_sequence));
console.log(`stop_times: 軌道列 ${[...stByTrip.values()].reduce((a, v) => a + v.length, 0)} 筆(trip ${stByTrip.size} 個)`);

// ── 站間零/負秒行駛時間修補(只修真正的 Δt≤0 缺陷,不動任何正常正時距的段) ──────
// İBB 原始快照本身有缺陷:少數 trip 尾段連續站的 arrival_time 直接複製上一站的 departure_time
// (實測 M7 兩個方向樣板 trip 3166571/3166570,Mecidiyeköy→Fulya→Yıldız 三站間隔皆 0 秒,
// 但實際站距各約 0.9~1.1km,不可能瞬移)。此為來源資料本身的錯,不是本腳本展開造成。
// 只在 Δt≤0 時,用「站間距÷30km/h」補一個保守的最低行駛時間,之後同 trip 後續站依同一累積
// 位移一起順延(維持原有 dwell 與相對站距不變);Δt>0 的正常段(哪怕只有 20~30 秒)完全不動,
// 避免誤傷市區密集站距的合理短程時間。
const stopsAll = readCSV('stops.csv'); // 也供最末 stops.txt passthrough 沿用,避免重複讀檔
const stopLatLon = new Map(stopsAll.map(s => [s.stop_id, { lat: Number(s.stop_lat), lon: Number(s.stop_lon) }]));
const toRad = Math.PI / 180, EARTH_R_KM = 6371;
function haversineKm(a, b) {
  const dLat = (b.lat - a.lat) * toRad, dLon = (b.lon - a.lon) * toRad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toRad) * Math.cos(b.lat * toRad) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_R_KM * Math.asin(Math.sqrt(h));
}
const IMPUTE_KMH = 30; // 僅用於「補值」的保守速度假設,不是全域最低速限
let repairedGaps = 0;
const repairedTrips = new Set();
for (const [tripId, sts] of stByTrip) {
  let shift = 0;
  for (let i = 1; i < sts.length; i++) {
    const prev = sts[i - 1], cur = sts[i]; // prev.departure_time 已在前一輪迭代套用過累積 shift(原地寫回)
    const gap = hmsToSec(cur.arrival_time) - hmsToSec(prev.departure_time);
    if (gap <= 0) {
      const a = stopLatLon.get(prev.stop_id), b = stopLatLon.get(cur.stop_id);
      const distKm = (a && b) ? haversineKm(a, b) : 0;
      const minGapSec = Math.max(10, Math.ceil(distKm / IMPUTE_KMH * 3600));
      shift += minGapSec - gap;
      repairedGaps++;
      repairedTrips.add(tripId);
    }
    if (shift > 0) {
      const dwell = hmsToSec(cur.departure_time) - hmsToSec(cur.arrival_time);
      const newArr = hmsToSec(cur.arrival_time) + shift;
      cur.arrival_time = secToHms(newArr);
      cur.departure_time = secToHms(newArr + dwell);
    }
  }
}
if (repairedGaps) console.log(`stop_times 修補:${repairedGaps} 段 Δt≤0 站距補上最低行駛時間(涉及 ${repairedTrips.size} 個 trip,含樣板)`);

const finalTrips = [];
const finalStopTimes = [];
let negOffsetCount = 0, expandedTripCount = 0;

// 非樣板 trip(無 frequencies 項目)原樣保留
for (const t of railTrips) {
  if (freqByTrip.has(t.trip_id)) continue;
  finalTrips.push(t);
  const sts = stByTrip.get(t.trip_id) || [];
  for (const st of sts) finalStopTimes.push(st);
}

// 樣板 trip → 依 frequencies 展開成逐車(樣板本身不輸出,依 GTFS 慣例它只是時距/站序模板)
for (const [tripId, freqRows] of freqByTrip) {
  const template = tripsAll.find(t => t.trip_id === tripId); // 用全量 trips 找(樣板本身也在 railTrips 內)
  const sts = stByTrip.get(tripId);
  if (!template || !sts || sts.length === 0) { console.warn(`  跳過樣板 trip ${tripId}:缺 trips/stop_times`); continue; }
  const baseDep = hmsToSec(sts[0].departure_time);
  for (const fr of freqRows) {
    const startSec = hmsToSec(fr.start_time), endSec = hmsToSec(fr.end_time);
    const headway = Number(fr.headway_secs);
    for (let s = startSec; s < endSec; s += headway) {
      const offset = s - baseDep;
      const newTripId = `${tripId}_F${expandedTripCount++}`;
      finalTrips.push({ ...template, trip_id: newTripId });
      for (const st of sts) {
        const arr = hmsToSec(st.arrival_time) + offset;
        const dep = hmsToSec(st.departure_time) + offset;
        if (arr < 0 || dep < 0) negOffsetCount++;
        finalStopTimes.push({ ...st, trip_id: newTripId, arrival_time: secToHms(arr), departure_time: secToHms(dep) });
      }
    }
  }
}
console.log(`frequencies 展開:合成 ${expandedTripCount} 個逐車 trip(負時刻異常 ${negOffsetCount} 筆)`);
console.log(`trips.txt 最終 ${finalTrips.length} 筆,stop_times.txt 最終 ${finalStopTimes.length} 筆`);

writeCSV('trips.txt', ['route_id', 'service_id', 'trip_id', 'trip_headsign', 'trip_short_name', 'direction_id', 'block_id', 'shape_id', 'wheelchair_accessible', 'bikes_allowed'], finalTrips);
writeCSV('stop_times.txt', ['trip_id', 'arrival_time', 'departure_time', 'stop_id', 'stop_sequence', 'stop_headsign', 'pickup_type', 'drop_off_type', 'shape_dist_traveled', 'timepoint'], finalStopTimes);

// ══════════════════════════════════════════════════════════════════
// 4) shapes.txt:只留最終 trips 用到的 shape_id
// ══════════════════════════════════════════════════════════════════
const neededShapeIds = new Set(finalTrips.map(t => t.shape_id).filter(Boolean));
const shapesAllRaw = readCSV('shapes.csv');
const shapesRail = shapesAllRaw.filter(s => neededShapeIds.has(s.shape_id));
console.log(`shapes: 保留 ${shapesRail.length} 點(shape_id ${neededShapeIds.size} 個,全 feed ${shapesAllRaw.length} 點)`);
writeCSV('shapes.txt', ['shape_id', 'shape_pt_lat', 'shape_pt_lon', 'shape_pt_sequence', 'shape_dist_traveled'], shapesRail);

// ── stops.txt:passthrough(僅轉碼,gtfs2rail.mjs 本就整檔載入不篩選) ──
writeCSV('stops.txt', ['stop_id', 'stop_code', 'stop_name', 'stop_desc', 'stop_lat', 'stop_lon', 'zone_id', 'stop_url', 'location_type', 'parent_station', 'stop_timezone', 'wheelchair_boarding'], stopsAll);
console.log(`stops: ${stopsAll.length} 筆(passthrough)`);

console.log(`\n已輸出標準 GTFS(UTF-8)到 ${OUT_DIR}`);
console.log('done');
