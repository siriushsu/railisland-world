#!/usr/bin/env node
// 通用 GTFS → 軌島格式轉換器(可重用:挪威/未來紐約/東京都走這支)。
// 輸出兩檔,schema 分別同 tra.json(軌道底圖 lines[])與 tra_schedule_dense.json(逐車次班表 trains[]):
//   <out-prefix>.json                 { system, source_notes, lines:[{id,name,color,shape,shapeLen,stations:[{name,lat,lon,d}]}] }
//     (欄位比照 data/thsr_track.json ── 這是「sched 系統的軌道底圖」角色,不含 peakHeadwaySec/segs;
//      那兩個欄位只有 freq/headway 模式的 buildLineSchedule() 會讀,sched 模式走 assignSchedShapePathsFor()
//      只吃 shape+stations,thsr_track.json 沒有那兩欄也正常運作,故此處比照省略,不造假資料。)
//   <out-prefix>_schedule_dense.json  { system, date, source_notes, types:[{key,color}], trains:[{train,typeName,carName,color,stops:[...]}] }
//
// 記憶體安全:stop_times.txt / shapes.txt 全國合併檔可達 GB 級,一律用 `unzip -p` 串流 + readline
// 逐行過濾,絕不整檔載入。先用 routes.txt+trips.txt+calendar(_dates).txt 建「白名單」(哪些 trip_id /
// shape_id 要留),再各自對 stop_times.txt / shapes.txt 各掃一遍,只收白名單命中的列。
//
// 用法:
//   node scripts/gtfs2rail.mjs --gtfs <zip或目錄> --sys 挪威鐵道 --tz Europe/Oslo \
//     --route-types 2,100-117 --out-prefix data/norway \
//     [--date YYYYMMDD] [--agency-exclude SAM,SNT,VYS] [--agency-include A,B] [--rdp-eps 0.03]
//
// --date 省略時自動選「下週三」(從執行當下日期往後數到下一個週三,若今天已是週三則跳到下週)。
// --agency-exclude/--agency-include:比對 agency_id 冒號分隔的第一段(如 "SJN:Authority:SJN" → "SJN")。
//   全國多營運商聚合 feed(挪威 Entur、未來若處理紐約 MTA+NJT+LIRR 這類)常需要用這個排除跨境/不相關營運商。

import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { createReadStream } from 'node:fs';
import { spawn } from 'node:child_process';
import readline from 'node:readline';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// ── CLI 參數 ──
function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      const val = (i + 1 < argv.length && !argv[i + 1].startsWith('--')) ? argv[++i] : true;
      a[key] = val;
    }
  }
  return a;
}
const args = parseArgs(process.argv.slice(2));
for (const req of ['gtfs', 'sys', 'route-types', 'out-prefix']) {
  if (!args[req]) { console.error(`缺必填參數 --${req}`); process.exit(1); }
}
const GTFS_PATH = path.isAbsolute(args.gtfs) ? args.gtfs : path.join(ROOT, args.gtfs);
const SYS_NAME = args.sys;
const TZ = args.tz || 'UTC';
const OUT_PREFIX = path.isAbsolute(args['out-prefix']) ? args['out-prefix'] : path.join(ROOT, args['out-prefix']);
const RDP_EPS = args['rdp-eps'] ? Number(args['rdp-eps']) : 0.03; // km
// typeName 來源:'agency'(預設,挪威式──多路線共用同個 operator 品牌)｜'route'(單一營運商多路線各自
// 有自己的 route_short_name,如 NYC 地鐵 1/A/Q,用 agency 會全部併成同一個 typeName,故需可切換)。
const TYPENAME_MODE = args['typename-mode'] === 'route' ? 'route' : 'agency';
const agencyInclude = args['agency-include'] ? new Set(args['agency-include'].split(',').map(s => s.trim().toUpperCase())) : null;
const agencyExclude = args['agency-exclude'] ? new Set(args['agency-exclude'].split(',').map(s => s.trim().toUpperCase())) : null;

function expandRouteTypes(spec) {
  const set = new Set();
  for (const tok of spec.split(',')) {
    const m = tok.trim().match(/^(\d+)(?:-(\d+))?$/);
    if (!m) continue;
    const lo = Number(m[1]), hi = m[2] ? Number(m[2]) : lo;
    for (let n = lo; n <= hi; n++) set.add(n);
  }
  return set;
}
const ROUTE_TYPES = expandRouteTypes(args['route-types']);

function nextWednesday(from) {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  let ahead = (3 /* Wed, Sun=0 */ - d.getUTCDay() + 7) % 7;
  if (ahead === 0) ahead = 7; // 今天已是週三 → 跳下週三
  d.setUTCDate(d.getUTCDate() + ahead);
  return d;
}
function ymd(d) {
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
}
const TARGET_DATE = args.date || ymd(nextWednesday(new Date()));
console.log(`目標服務日期:${TARGET_DATE}`);

// ── CSV 逐行解析(quote-aware,GTFS 標準 RFC4180 子集;不處理欄位內嵌換行) ──
function parseCSVLine(line) {
  const out = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
      else cur += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') { out.push(cur); cur = ''; }
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}

const isZip = GTFS_PATH.toLowerCase().endsWith('.zip');
if (!existsSync(GTFS_PATH)) { console.error(`找不到 --gtfs 路徑:${GTFS_PATH}`); process.exit(1); }

// 逐行串流某個 GTFS 內部檔案(zip 用 `unzip -p` 子行程,不整檔解壓落地;目錄則直接開檔)。
function streamLines(entryName) {
  if (isZip) {
    const child = spawn('unzip', ['-p', GTFS_PATH, entryName], { stdio: ['ignore', 'pipe', 'pipe'] });
    child.stderr.resume();
    return readline.createInterface({ input: child.stdout, crlfDelay: Infinity });
  }
  return readline.createInterface({ input: createReadStream(path.join(GTFS_PATH, entryName)), crlfDelay: Infinity });
}

// 逐列丟出 {header 對應的欄位名: 值} 物件(dict-style,類似 python csv.DictReader),串流不整檔載入。
async function* csvRows(entryName) {
  const rl = streamLines(entryName);
  let header = null;
  for await (const raw of rl) {
    const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
    if (!line) continue;
    const fields = parseCSVLine(line);
    if (!header) { header = fields; continue; }
    const row = {};
    for (let i = 0; i < header.length; i++) row[header[i]] = fields[i] ?? '';
    yield row;
  }
}

function agencyPrefix(agencyId) { return (agencyId || '').split(':')[0].toUpperCase(); }

// ── 幾何工具(沿用 build_thsr_schedule.mjs / despike_shapes.mjs 既有寫法) ──
const R = 6371, toR = Math.PI / 180;
function distKm(a, b) {
  const dx = (b[1] - a[1]) * Math.cos((a[0] + b[0]) / 2 * toR) * toR * R;
  const dy = (b[0] - a[0]) * toR * R;
  return Math.hypot(dx, dy);
}
function cumOf(pts) {
  const c = [0];
  for (let i = 1; i < pts.length; i++) c[i] = c[i - 1] + distKm(pts[i - 1], pts[i]);
  return c;
}
// 站點投影:回傳該站在 shape 上「所有」夠靠近的匹配點(通常只有 1 筆),而非只回全域最近點。
// 緣由:環狀+放射狀線(如大江戶線)代表 shape 是單一連續路徑,實體上同一站可能在路徑上出現兩次
// (環狀部起訖點=放射部銜接點,如都庁前)。若只登記全域最近點,另一次出現的里程會漏記,
// assignSchedShapePathsFor() 幫相鄰站配對時只能用同一個 d 值,造成該站前後兩段的里程差被算成
// 「整圈距離」而非實際短距離,列車在該站瞬移/超速。REVISIT_EPS_KM/REVISIT_MIN_SEP_KM 皆保守設定,
// 一般不自我重疊的線性路線只會回傳單一匹配,行為與舊版 project() 完全一致。
const REVISIT_EPS_KM = 0.05, REVISIT_MIN_SEP_KM = 0.5;
function projectAll(pt, pts, cum) {
  const cand = [];
  for (let j = 0; j < pts.length - 1; j++) {
    const ay = pts[j][0], ax = pts[j][1], by = pts[j + 1][0], bx = pts[j + 1][1];
    const k = Math.cos(ay * toR);
    const vx = (bx - ax) * k, vy = by - ay;
    const px = (pt[1] - ax) * k, py = pt[0] - ay;
    const L2 = vx * vx + vy * vy;
    const t = L2 > 0 ? Math.max(0, Math.min(1, (px * vx + py * vy) / L2)) : 0;
    const q = [ay + (by - ay) * t, ax + (bx - ax) * t];
    cand.push({ dist: distKm(pt, q), s: cum[j] + distKm(pts[j], q) });
  }
  let primary = cand[0];
  for (const c of cand) if (c.dist < primary.dist) primary = c;
  // 找出所有「幾乎就在站上」的候選點,依里程排序後把彼此相鄰(<MIN_SEP)的併成同一次出現,
  // 群內取距離最小者代表;群心與已收錄點(含全域最近點)仍在 MIN_SEP 內視為同一次出現,不重複收錄。
  const near = cand.filter(c => c.dist <= REVISIT_EPS_KM).sort((a, b) => a.s - b.s);
  const clusters = [];
  for (const c of near) {
    const last = clusters[clusters.length - 1];
    if (last && c.s - last.s < REVISIT_MIN_SEP_KM) { if (c.dist < last.dist) { last.dist = c.dist; last.s = c.s; } }
    else clusters.push({ s: c.s, dist: c.dist });
  }
  const matches = [primary];
  for (const cl of clusters) {
    if (matches.some(m => Math.abs(m.s - cl.s) < REVISIT_MIN_SEP_KM)) continue;
    matches.push(cl);
  }
  return matches; // [{s,dist}, ...],至少 1 筆,依發現順序(全域最近點在前)
}
function rdp(pts, epsKm) {
  if (pts.length < 3) return pts.slice();
  const perp = (p, a, b) => {
    const k = Math.cos(a[0] * toR);
    const ax = a[1] * k, ay = a[0], bx = b[1] * k, by = b[0], px = p[1] * k, py = p[0];
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
    if (L2 === 0) return distKm(p, a);
    const t = ((px - ax) * dx + (py - ay) * dy) / L2;
    const qx = ax + Math.max(0, Math.min(1, t)) * dx, qy = ay + Math.max(0, Math.min(1, t)) * dy;
    return Math.hypot((px - qx), (py - qy)) * toR * R;
  };
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [lo, hi] = stack.pop();
    let far = -1, fd = epsKm;
    for (let i = lo + 1; i < hi; i++) { const d = perp(pts[i], pts[lo], pts[hi]); if (d > fd) { fd = d; far = i; } }
    if (far > 0) { keep[far] = 1; stack.push([lo, far], [far, hi]); }
  }
  return pts.filter((_, i) => keep[i]);
}
const hmsToSec = t => { // "HH:MM:SS",GTFS 允許 HH>=24 表跨午夜,直接轉秒不 wrap(與 index.html 慣例一致)
  const p = t.split(':').map(Number);
  return p[0] * 3600 + p[1] * 60 + (p[2] || 0);
};

// ══════════════════════════════════════════════════════════════════
// 1) routes.txt:篩鐵路 route_type + agency include/exclude
// ══════════════════════════════════════════════════════════════════
const routes = new Map(); // routeId -> {agencyId, shortName, longName, type, color}
const candidateRouteIds = new Set();
for await (const r of csvRows('routes.txt')) {
  const type = Number(r.route_type);
  routes.set(r.route_id, {
    agencyId: r.agency_id, shortName: r.route_short_name, longName: r.route_long_name,
    type, color: r.route_color,
  });
  if (!ROUTE_TYPES.has(type)) continue;
  const ap = agencyPrefix(r.agency_id);
  if (agencyInclude && !agencyInclude.has(ap)) continue;
  if (agencyExclude && agencyExclude.has(ap)) continue;
  candidateRouteIds.add(r.route_id);
}
console.log(`routes.txt:候選鐵路路線 ${candidateRouteIds.size} 條(route_type∈{${[...ROUTE_TYPES].join(',')}}${agencyExclude ? `,排除 agency ${[...agencyExclude].join('/')}` : ''}${agencyInclude ? `,僅含 agency ${[...agencyInclude].join('/')}` : ''})`);

// ══════════════════════════════════════════════════════════════════
// 2) agency.txt(顯示名稱,供 typeName 用)
// ══════════════════════════════════════════════════════════════════
const agencyName = new Map();
if (existsSync(isZip ? GTFS_PATH : path.join(GTFS_PATH, 'agency.txt')) || isZip) {
  try {
    for await (const r of csvRows('agency.txt')) agencyName.set(r.agency_id, r.agency_name);
  } catch { /* agency.txt 非必要,查無就靠 route id 頂替 */ }
}

// ══════════════════════════════════════════════════════════════════
// 3) calendar.txt + calendar_dates.txt → 目標日期有效的 service_id
// ══════════════════════════════════════════════════════════════════
const calendar = new Map(); // serviceId -> {bits[0..6]=Mon..Sun, start, end}
for await (const r of csvRows('calendar.txt')) {
  calendar.set(r.service_id, {
    bits: [r.monday, r.tuesday, r.wednesday, r.thursday, r.friday, r.saturday, r.sunday].map(Number),
    start: r.start_date, end: r.end_date,
  });
}
const exceptions = new Map(); // serviceId -> 1(加開)|2(取消),僅目標日期
for await (const r of csvRows('calendar_dates.txt')) {
  if (r.date !== TARGET_DATE) continue;
  exceptions.set(r.service_id, Number(r.exception_type));
}
const targetWeekdayIdx = (() => { // Mon=0..Sun=6,對齊 calendar.txt 欄位順序
  const y = +TARGET_DATE.slice(0, 4), m = +TARGET_DATE.slice(4, 6), d = +TARGET_DATE.slice(6, 8);
  const jsDay = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // Sun=0..Sat=6
  return (jsDay + 6) % 7;
})();
function serviceActive(serviceId) {
  const ex = exceptions.get(serviceId);
  if (ex === 1) return true;
  if (ex === 2) return false;
  const c = calendar.get(serviceId);
  if (!c) return false;
  if (TARGET_DATE < c.start || TARGET_DATE > c.end) return false;
  return c.bits[targetWeekdayIdx] === 1;
}
console.log(`calendar_dates.txt:目標日期例外 ${exceptions.size} 筆`);

// ══════════════════════════════════════════════════════════════════
// 4) trips.txt → 篩「候選路線 ∩ 目標日期有效」的 trip 白名單
// ══════════════════════════════════════════════════════════════════
const trips = new Map(); // tripId -> {routeId, shapeId, directionId, headsign}
const routeShapeCount = new Map(); // routeId -> Map(shapeId -> count)
let tripsScanned = 0;
for await (const r of csvRows('trips.txt')) {
  tripsScanned++;
  if (!candidateRouteIds.has(r.route_id)) continue;
  if (!serviceActive(r.service_id)) continue;
  trips.set(r.trip_id, { routeId: r.route_id, shapeId: r.shape_id, directionId: r.direction_id, headsign: r.trip_headsign });
  if (r.shape_id) {
    if (!routeShapeCount.has(r.route_id)) routeShapeCount.set(r.route_id, new Map());
    const m = routeShapeCount.get(r.route_id);
    m.set(r.shape_id, (m.get(r.shape_id) || 0) + 1);
  }
}
console.log(`trips.txt:掃了 ${tripsScanned} 筆,白名單 trip ${trips.size} 筆(路線候選∩目標日期有效)`);
if (trips.size === 0) { console.error('白名單為空,中止(檢查 --route-types / --date / agency 篩選是否正確)'); process.exit(1); }

const neededShapeIds = new Set([...trips.values()].map(t => t.shapeId).filter(Boolean));
const neededTripIds = new Set(trips.keys());

// ══════════════════════════════════════════════════════════════════
// 5) shapes.txt(可能數 GB)→ 只收白名單 shape_id,串流過濾
// ══════════════════════════════════════════════════════════════════
const shapeRaw = new Map(); // shapeId -> [{seq,lat,lon}]
{
  let scanned = 0;
  for await (const r of csvRows('shapes.txt')) {
    scanned++;
    if (!neededShapeIds.has(r.shape_id)) continue;
    if (!shapeRaw.has(r.shape_id)) shapeRaw.set(r.shape_id, []);
    shapeRaw.get(r.shape_id).push({ seq: Number(r.shape_pt_sequence), lat: Number(r.shape_pt_lat), lon: Number(r.shape_pt_lon) });
  }
  console.log(`shapes.txt:掃了 ${scanned} 筆,命中 shape_id ${shapeRaw.size}/${neededShapeIds.size}`);
}
for (const pts of shapeRaw.values()) pts.sort((a, b) => a.seq - b.seq);

// ══════════════════════════════════════════════════════════════════
// 6) stop_times.txt(可能數百 MB~GB)→ 只收白名單 trip_id,串流過濾
// ══════════════════════════════════════════════════════════════════
const stopTimesByTrip = new Map(); // tripId -> [{stopId,arr,dep,seq,pickup,dropoff}]
{
  let scanned = 0, missingTime = 0;
  for await (const r of csvRows('stop_times.txt')) {
    scanned++;
    if (!neededTripIds.has(r.trip_id)) continue;
    if (!r.arrival_time || !r.departure_time) { missingTime++; continue; }
    if (!stopTimesByTrip.has(r.trip_id)) stopTimesByTrip.set(r.trip_id, []);
    stopTimesByTrip.get(r.trip_id).push({
      stopId: r.stop_id, arr: hmsToSec(r.arrival_time), dep: hmsToSec(r.departure_time),
      seq: Number(r.stop_sequence), pickup: r.pickup_type, dropoff: r.drop_off_type,
    });
  }
  console.log(`stop_times.txt:掃了 ${scanned} 筆,命中 trip ${stopTimesByTrip.size}/${neededTripIds.size}(缺時刻略過 ${missingTime} 列)`);
}
for (const arr of stopTimesByTrip.values()) arr.sort((a, b) => a.seq - b.seq);

// ══════════════════════════════════════════════════════════════════
// 7) stops.txt → stopId -> {name, lat, lon}
// ══════════════════════════════════════════════════════════════════
const stops = new Map();
for await (const r of csvRows('stops.txt')) {
  stops.set(r.stop_id, { name: r.stop_name, lat: Number(r.stop_lat), lon: Number(r.stop_lon) });
}
console.log(`stops.txt:${stops.size} 站`);

// ══════════════════════════════════════════════════════════════════
// 8) 組 trains[](schedule_dense)
// ══════════════════════════════════════════════════════════════════
const AGENCY_FALLBACK_COLOR = { FLT: '#C8102E', SJV: '#4B7BEC', SNT: '#8E44AD' };
const DEFAULT_COLOR = '#2E6FB0';
function colorOf(route) {
  if (route.color) return `#${route.color.replace(/^#/, '')}`;
  return AGENCY_FALLBACK_COLOR[agencyPrefix(route.agencyId)] || DEFAULT_COLOR;
}
function typeNameOf(route) {
  if (TYPENAME_MODE === 'route') return route.shortName || route.routeId;
  return agencyName.get(route.agencyId) || agencyPrefix(route.agencyId) || route.routeId;
}

const trains = [];
const usedTrainCodes = new Set();
const routeStopIds = new Map(); // routeId -> Set(stopId),供軌道底圖站點彙整
let skippedNoStops = 0, skippedTooShort = 0;

for (const [tripId, trip] of trips) {
  const sts = stopTimesByTrip.get(tripId);
  if (!sts || sts.length === 0) { skippedNoStops++; continue; }
  if (sts.length < 2) { skippedTooShort++; continue; }
  const route = routes.get(trip.routeId);
  const color = colorOf(route);
  const typeName = typeNameOf(route);

  if (!routeStopIds.has(trip.routeId)) routeStopIds.set(trip.routeId, new Set());
  const stopIdSet = routeStopIds.get(trip.routeId);

  let order = 0;
  const stopsOut = [];
  let ok = true;
  for (const st of sts) {
    const info = stops.get(st.stopId);
    if (!info) { ok = false; break; }
    stopIdSet.add(st.stopId);
    const passThrough = st.pickup === '1' && st.dropoff === '1';
    if (!passThrough) order++;
    stopsOut.push({
      name: info.name, lat: +info.lat.toFixed(6), lon: +info.lon.toFixed(6),
      order: passThrough ? null : order, arrSec: st.arr, depSec: st.dep, stop: !passThrough,
    });
  }
  if (!ok) { skippedNoStops++; continue; }

  const hhmm = String(Math.floor((sts[0].dep % 86400) / 3600)).padStart(2, '0') +
    String(Math.floor((sts[0].dep % 3600) / 60)).padStart(2, '0');
  const base = `${route.shortName || route.routeId}-${hhmm}`;
  let code = base, n = 1;
  while (usedTrainCodes.has(code)) code = `${base}${String.fromCharCode(96 + (++n))}`; // -a, -b...
  usedTrainCodes.add(code);

  trains.push({ train: code, typeName, carName: typeName, color, stops: stopsOut });
}
console.log(`trains[] 組出 ${trains.length} 車次(略過:缺站資料 ${skippedNoStops}、少於 2 停靠 ${skippedTooShort})`);

const types = [];
const seenTypes = new Set();
for (const t of trains) {
  if (seenTypes.has(t.typeName)) continue;
  seenTypes.add(t.typeName);
  types.push({ key: t.typeName, color: t.color });
}

const scheduleDenseOut = {
  system: SYS_NAME,
  date: TARGET_DATE,
  source_notes: `來源:Entur 全國 GTFS 聚合檔(NLOD 授權,含 shapes.txt);${GTFS_PATH.split('/').pop()};` +
    `篩選 route_type∈{${[...ROUTE_TYPES].join(',')}}${agencyExclude ? `,排除 agency ${[...agencyExclude].join('/')}` : ''};` +
    `目標服務日期 ${TARGET_DATE}(時區 ${TZ});時刻為 GTFS 原始 HH:MM:SS 直接轉秒(跨午夜 HH>=24 不 wrap,與現有 tra_schedule_dense.json 慣例一致)`,
  types,
  trains,
};
writeFileSync(`${OUT_PREFIX}_schedule_dense.json`, JSON.stringify(scheduleDenseOut));

// ══════════════════════════════════════════════════════════════════
// 9) 組 lines[](軌道底圖,schema 同 data/thsr_track.json)
// ══════════════════════════════════════════════════════════════════
const usedLineIds = new Set();
const lines = [];
let totalShapePts = 0;
for (const [routeId, stopIdSet] of routeStopIds) {
  const route = routes.get(routeId);
  const shapeCounts = routeShapeCount.get(routeId);
  if (!shapeCounts) continue;
  // 代表 shape:該路線出現次數最多的 shape_id,同票數取點數較多者(較完整的端到端路徑)
  let bestShapeId = null, bestScore = [-1, -1];
  for (const [sid, cnt] of shapeCounts) {
    const pts = shapeRaw.get(sid);
    if (!pts || pts.length < 2) continue;
    const score = [cnt, pts.length];
    if (score[0] > bestScore[0] || (score[0] === bestScore[0] && score[1] > bestScore[1])) { bestScore = score; bestShapeId = sid; }
  }
  if (!bestShapeId) continue;
  const rawPts = shapeRaw.get(bestShapeId).map(p => [p.lat, p.lon]);
  const simplified = rdp(rawPts, RDP_EPS);
  const cum = cumOf(simplified);
  totalShapePts += simplified.length;

  const stationList = [];
  for (const stopId of stopIdSet) {
    const info = stops.get(stopId);
    if (!info) continue;
    for (const pr of projectAll([info.lat, info.lon], simplified, cum)) {
      stationList.push({ name: info.name, lat: +info.lat.toFixed(6), lon: +info.lon.toFixed(6), d: +pr.s.toFixed(4) });
    }
  }
  // 同名站(不同月台/quay,或環狀+放射線同站在 shape 上的多次出現)去重:
  // 同名且里程相近(<REVISIT_MIN_SEP_KM)視為同一次出現,取最先出現者;里程差夠遠則是
  // 真實的另一次出現(如都庁前),兩筆都保留,供 assignSchedShapePathsFor() 依相鄰站選最小落差配對。
  const seenD = new Map(); // name -> [d,...]
  const dedup = stationList.filter(s => {
    const ds = seenD.get(s.name);
    if (ds && ds.some(d => Math.abs(d - s.d) < REVISIT_MIN_SEP_KM)) return false;
    if (ds) ds.push(s.d); else seenD.set(s.name, [s.d]);
    return true;
  });
  dedup.sort((a, b) => a.d - b.d);

  let id = (route.shortName || routeId).replace(/[^A-Za-z0-9_-]/g, '');
  if (!id) id = routeId.replace(/[^A-Za-z0-9_-]/g, '');
  if (usedLineIds.has(id)) id = `${id}-${agencyPrefix(route.agencyId).replace(/[^A-Za-z0-9_-]/g, '')}`;
  // 同 agency 仍撞名(如 NYC 三條 shuttle route_id GS/FS/H 的 route_short_name 都叫 "S")→ 補 route_id;
  // 仍撞就數字保底(理論上不會走到,純防呆)。
  if (usedLineIds.has(id)) id = `${id}-${routeId.replace(/[^A-Za-z0-9_-]/g, '')}`;
  let dedupN = 2;
  while (usedLineIds.has(id)) id = `${id}-${dedupN++}`;
  usedLineIds.add(id);

  lines.push({
    id,
    name: route.longName || `${typeNameOf(route)} ${route.shortName || ''}`.trim(),
    color: colorOf(route),
    shape: simplified.map(p => [+p[0].toFixed(6), +p[1].toFixed(6)]),
    shapeLen: +cum[cum.length - 1].toFixed(4),
    stations: dedup,
  });
}
lines.sort((a, b) => b.shapeLen - a.shapeLen);

const trackOut = {
  system: SYS_NAME,
  source_notes: `來源:Entur 全國 GTFS 聚合檔 shapes.txt(NLOD 授權)與 stops.txt;` +
    `每路線取最常用 shape_id 代表線型,Douglas-Peucker 簡化(eps=${RDP_EPS}km);站點依投影弧長(km)排序`,
  lines,
};
writeFileSync(`${OUT_PREFIX}.json`, JSON.stringify(trackOut));

console.log(`data 輸出:${lines.length} 條線,共 ${lines.reduce((a, l) => a + l.stations.length, 0)} 站(含重複),shape 點共 ${totalShapePts}`);
console.log(`寫出 ${OUT_PREFIX}_schedule_dense.json(${trains.length} 車次)與 ${OUT_PREFIX}.json(${lines.length} 線)`);
console.log('done');
