#!/usr/bin/env node
// 雪梨鐵道 track 補丁:gtfs2rail.mjs 的 bestShapeId 選代表 shape 用「當日 trip 次數」排序
// (同票數才比點數),在單日抽樣下,一條真正端到端的長途線(如 CCN 雪梨—Newcastle,165km)
// 可能被某個當天恰好多跑 1 班的短程 turn-back shape(如 34km 的 Wondabyne↔Woy Woy 區間)以
// 4 票 vs 3 票些微險勝,導致代表 shape 被腰斬——超出該 shape 範圍的真實站(Woy Woy/Gosford/
// Newcastle...)全部投影卡在 shape 端點(d=shapeLen),造成地圖上「瞬移」與離譜時速。
// 本腳本不改 gtfs2rail.mjs(唯讀),而是重跑一份「lines[] 專用」流程,把 bestShapeId 的排序鍵
// 從 (trip 次數, 點數) 換成 (原始地理長度) ——對「想要端到端完整路徑」這個既有設計意圖更穩健。
// trains[](schedule_dense)不受影響,原樣沿用 gtfs2rail.mjs 的輸出,本腳本只重算 data/sydney.json。
//
// 用法:node tools/build_sydney.mjs --gtfs <clean GTFS dir> --route-types 2,401,900 --date 20260715 \
//   --sydney-json data/sydney.json --rdp-eps 0.03

import { readFileSync, writeFileSync, existsSync, createReadStream } from 'node:fs';
import readline from 'node:readline';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

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
for (const req of ['gtfs', 'route-types', 'date', 'sydney-json']) {
  if (!args[req]) { console.error(`缺必填參數 --${req}`); process.exit(1); }
}
const GTFS_PATH = path.isAbsolute(args.gtfs) ? args.gtfs : path.join(ROOT, args.gtfs);
const TARGET_DATE = args.date;
const SYDNEY_JSON = path.isAbsolute(args['sydney-json']) ? args['sydney-json'] : path.join(ROOT, args['sydney-json']);
const RDP_EPS = args['rdp-eps'] ? Number(args['rdp-eps']) : 0.03;

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
function streamLines(entryName) {
  return readline.createInterface({ input: createReadStream(path.join(GTFS_PATH, entryName)), crlfDelay: Infinity });
}
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
  return matches;
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
const hmsToSec = t => { const p = t.split(':').map(Number); return p[0] * 3600 + p[1] * 60 + (p[2] || 0); };

// 1) routes.txt
const routes = new Map();
const candidateRouteIds = new Set();
for await (const r of csvRows('routes.txt')) {
  const type = Number(r.route_type);
  routes.set(r.route_id, { agencyId: r.agency_id, shortName: r.route_short_name, longName: r.route_long_name, type, color: r.route_color });
  if (!ROUTE_TYPES.has(type)) continue;
  candidateRouteIds.add(r.route_id);
}
console.log(`routes.txt: 候選路線 ${candidateRouteIds.size} 條`);

// 2) calendar
const calendar = new Map();
for await (const r of csvRows('calendar.txt')) {
  calendar.set(r.service_id, { bits: [r.monday, r.tuesday, r.wednesday, r.thursday, r.friday, r.saturday, r.sunday].map(Number), start: r.start_date, end: r.end_date });
}
const exceptions = new Map();
for await (const r of csvRows('calendar_dates.txt')) {
  if (r.date !== TARGET_DATE) continue;
  exceptions.set(r.service_id, Number(r.exception_type));
}
const targetWeekdayIdx = (() => {
  const y = +TARGET_DATE.slice(0, 4), m = +TARGET_DATE.slice(4, 6), d = +TARGET_DATE.slice(6, 8);
  const jsDay = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
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

// 3) trips.txt -> 白名單(同 gtfs2rail.mjs),並記錄每 route 首次出現順序(供 id 分配順序比對)
const trips = new Map();
const routeShapeCount = new Map();
const routeFirstSeenOrder = [];
const seenRoute = new Set();
for await (const r of csvRows('trips.txt')) {
  if (!candidateRouteIds.has(r.route_id)) continue;
  if (!serviceActive(r.service_id)) continue;
  trips.set(r.trip_id, { routeId: r.route_id, shapeId: r.shape_id });
  if (!seenRoute.has(r.route_id)) { seenRoute.add(r.route_id); routeFirstSeenOrder.push(r.route_id); }
  if (r.shape_id) {
    if (!routeShapeCount.has(r.route_id)) routeShapeCount.set(r.route_id, new Map());
    const m = routeShapeCount.get(r.route_id);
    m.set(r.shape_id, (m.get(r.shape_id) || 0) + 1);
  }
}
console.log(`trips.txt: 白名單 ${trips.size} 筆,涉及 ${routeFirstSeenOrder.length} 條路線`);
const neededShapeIds = new Set([...trips.values()].map(t => t.shapeId).filter(Boolean));
const neededTripIds = new Set(trips.keys());

// 4) shapes.txt -> 只收白名單 shape_id
const shapeRaw = new Map();
for await (const r of csvRows('shapes.txt')) {
  if (!neededShapeIds.has(r.shape_id)) continue;
  if (!shapeRaw.has(r.shape_id)) shapeRaw.set(r.shape_id, []);
  shapeRaw.get(r.shape_id).push({ seq: Number(r.shape_pt_sequence), lat: Number(r.shape_pt_lat), lon: Number(r.shape_pt_lon) });
}
for (const pts of shapeRaw.values()) pts.sort((a, b) => a.seq - b.seq);
console.log(`shapes.txt: 命中 shape_id ${shapeRaw.size}/${neededShapeIds.size}`);
// 各 shape 的原始地理長度(修補用排序鍵)
const shapeRawLenKm = new Map();
for (const [sid, pts] of shapeRaw) {
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += distKm([pts[i - 1].lat, pts[i - 1].lon], [pts[i].lat, pts[i].lon]);
  shapeRawLenKm.set(sid, len);
}

// 5) stop_times.txt -> 只收白名單 trip_id,建 routeStopIds
const routeStopIds = new Map();
{
  let scanned = 0;
  for await (const r of csvRows('stop_times.txt')) {
    scanned++;
    const trip = trips.get(r.trip_id);
    if (!trip) continue;
    if (!routeStopIds.has(trip.routeId)) routeStopIds.set(trip.routeId, new Set());
    routeStopIds.get(trip.routeId).add(r.stop_id);
  }
  console.log(`stop_times.txt: 掃了 ${scanned} 筆`);
}

// 6) stops.txt
const stops = new Map();
for await (const r of csvRows('stops.txt')) {
  stops.set(r.stop_id, { name: r.stop_name, lat: Number(r.stop_lat), lon: Number(r.stop_lon) });
}
console.log(`stops.txt: ${stops.size} 站`);

// 7) 組 lines[](修補版:bestShapeId 依「原始地理長度」擇優,而非 trip 次數)
const AGENCY_FALLBACK_COLOR = { FLT: '#C8102E', SJV: '#4B7BEC', SNT: '#8E44AD' };
const DEFAULT_COLOR = '#2E6FB0';
function colorOf(route) {
  if (route.color) return `#${route.color.replace(/^#/, '')}`;
  return AGENCY_FALLBACK_COLOR[agencyPrefix(route.agencyId)] || DEFAULT_COLOR;
}
function typeNameOf(route) { return routes.get === undefined ? '' : (route.agencyId || route.routeId); }

const usedLineIds = new Set();
const lines = [];
const patchedLog = [];
const dropLog = [];
for (const routeId of routeFirstSeenOrder) {
  const stopIdSet = routeStopIds.get(routeId);
  if (!stopIdSet) continue;
  const route = routes.get(routeId);
  const shapeCounts = routeShapeCount.get(routeId);
  if (!shapeCounts) continue;

  // 舊版標準(trip 次數優先,同票比點數)—— 供對照 log
  let oldBest = null, oldScore = [-1, -1];
  for (const [sid, cnt] of shapeCounts) {
    const pts = shapeRaw.get(sid);
    if (!pts || pts.length < 2) continue;
    const score = [cnt, pts.length];
    if (score[0] > oldScore[0] || (score[0] === oldScore[0] && score[1] > oldScore[1])) { oldScore = score; oldBest = sid; }
  }
  // 新版標準:原始地理長度優先(同長度比 trip 次數)—— 端到端完整路徑優先於單日抽樣次數
  let bestShapeId = null, bestScore = [-1, -1];
  for (const [sid, cnt] of shapeCounts) {
    const pts = shapeRaw.get(sid);
    if (!pts || pts.length < 2) continue;
    const len = shapeRawLenKm.get(sid) || 0;
    const score = [len, cnt];
    if (score[0] > bestScore[0] || (score[0] === bestScore[0] && score[1] > bestScore[1])) { bestScore = score; bestShapeId = sid; }
  }
  if (!bestShapeId) continue;
  if (bestShapeId !== oldBest) {
    patchedLog.push({ routeId, shortName: route.shortName, oldBest, oldLenKm: +(shapeRawLenKm.get(oldBest) || 0).toFixed(2), newBest: bestShapeId, newLenKm: +bestScore[0].toFixed(2) });
  }

  const rawPts = shapeRaw.get(bestShapeId).map(p => [p.lat, p.lon]);
  const simplified = rdp(rawPts, RDP_EPS);
  const cum = cumOf(simplified);

  // 站點須真的貼著這條代表 shape(perpKm < PERP_MAX_KM)才收錄:route 底下的 trip 可能走不同實體
  // 分支(如 CCN 有些班次繞北岸線過海港大橋經 Wynyard,有些走 Strathfield 直達),沒被選中的分支
  // 站若不篩掉,會被 projectAll 硬投影到 shape 端點(全部疊在同一個 d),使該站與相鄰站的計算距離
  // 變 0——assignSchedShapePathsFor()「取最小 gap」會讓這個假 0km 蓋掉真正該線(如 T1 北岸線)算出
  // 的正確非零距離,導致班表算出的位置在該站瞬間靜止/瞬移。門檻 0.3km 取自 index.html 自己
  // assignSchedShapePathsFor() 的補充式投影同一門檻(perpKm>=0.3 即不收);量測(見
  // scratchpad/sydney/check_dist.mjs)顯示真正在 shape 上的站 <0.08km,不同分支的站全部 >1.1km,
  // 中間有乾淨的落差,無誤刪風險。
  const PERP_MAX_KM = 0.3;
  const stationList = [];
  let droppedOffBranch = 0;
  for (const stopId of stopIdSet) {
    const info = stops.get(stopId);
    if (!info) continue;
    for (const pr of projectAll([info.lat, info.lon], simplified, cum)) {
      if (pr.dist >= PERP_MAX_KM) { droppedOffBranch++; continue; }
      stationList.push({ name: info.name, lat: +info.lat.toFixed(6), lon: +info.lon.toFixed(6), d: +pr.s.toFixed(4) });
    }
  }
  if (droppedOffBranch) dropLog.push({ routeId, shortName: route.shortName, droppedOffBranch });
  const seenD = new Map();
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
  if (usedLineIds.has(id)) id = `${id}-${routeId.replace(/[^A-Za-z0-9_-]/g, '')}`;
  let dedupN = 2;
  while (usedLineIds.has(id)) id = `${id}-${dedupN++}`;
  usedLineIds.add(id);

  lines.push({
    id, routeId,
    name: route.longName || `${route.shortName || ''}`.trim(),
    color: colorOf(route),
    shape: simplified.map(p => [+p[0].toFixed(6), +p[1].toFixed(6)]),
    shapeLen: +cum[cum.length - 1].toFixed(4),
    stations: dedup,
  });
}
lines.sort((a, b) => b.shapeLen - a.shapeLen);

console.log(`\n重選 bestShapeId 有變動的路線(${patchedLog.length} 條):`);
for (const p of patchedLog) console.log(`  ${p.shortName} (${p.routeId}): 舊 ${p.oldBest} ${p.oldLenKm}km -> 新 ${p.newBest} ${p.newLenKm}km`);

console.log(`\n因不在代表 shape 上(perpKm>=${0.3})而剔除離群站的路線(${dropLog.length} 條):`);
for (const p of dropLog) console.log(`  ${p.shortName} (${p.routeId}): 剔除 ${p.droppedOffBranch} 筆(不同分支的站)`);

// 8) 讀回現有 data/sydney.json,依 routeId 對應(用 id 生成順序比對,失敗則退回用 name+color+站名交集比對)取代 shape/shapeLen/stations
const existing = JSON.parse(readFileSync(SYDNEY_JSON, 'utf8'));
const newById = new Map(lines.map(l => [l.id, l]));
let matched = 0, unmatched = [];
for (const ol of existing.lines) {
  const nl = newById.get(ol.id);
  if (!nl) { unmatched.push(ol.id); continue; }
  ol.shape = nl.shape;
  ol.shapeLen = nl.shapeLen;
  ol.stations = nl.stations;
  matched++;
}
console.log(`\nid 比對:${matched}/${existing.lines.length} 條線成功比對(unmatched: ${unmatched.join(',') || '無'})`);
if (unmatched.length) { console.error('有未比對上的線,中止寫檔,避免資料錯位。'); process.exit(1); }

// gtfs2rail.mjs 的 source_notes 是挪威 Entur/NLOD 專用的寫死字串(該工具原設計只服務過挪威),
// 直接套用在雪梨資料上是錯誤的授權標示(雪梨來源是 TfNSW,CC BY 4.0,不是 Entur/NLOD)——
// 這裡整段換成雪梨正確來源與授權文字,不是附加而是取代。
const SYDNEY_SOURCE_NOTES = '來源:Transport for NSW (TfNSW) Open Data Hub GTFS Static 完整時刻表 ' +
  '(https://opendata.transport.nsw.gov.au/dataset/timetables-complete-gtfs ,檔名 full_greater_sydney_gtfs_static_0.zip);' +
  '授權 Creative Commons Attribution 4.0(CC BY 4.0,https://creativecommons.org/licenses/by/4.0/legalcode ),' +
  '標註義務:「Transport for NSW is attributed as the source」(逐字引用自 https://opendata.transport.nsw.gov.au/datalicence );' +
  '下載快照日 2026-07-11;風險:UI 顯示需登入,但直接對 resource 檔案 URL 匿名 GET 可下載成功(HTTP 200),' +
  '此為觀察到的現況、非官方書面保證的公開 API,若未來收緊,備援為使用者自行免費註冊取 API key;' +
  '篩選 route_type∈{2,401,900}(Sydney/NSW/Intercity Trains、Sydney Metro、Light Rail;已排除 204/205/106/714 等' +
  'NSW TrainLink 長途客運巴士與鐵路代替巴士);每路線代表 shape 依當日白名單 trip 中「原始地理長度最長」者擇優' +
  '(而非單純以當日 trip 次數多寡,修正單日抽樣下端到端長途線被短程 turn-back shape 以些微票數險勝、截斷代表路徑的問題,' +
  '如 CCN 雪梨—Newcastle 線);站點須落在代表 shape 上(垂直距離<0.3km)才收錄,不同實體分支(如 CCN 部分班次繞經北岸線過' +
  '海港大橋)的站點若不在代表 shape 上則剔除,避免被強制投影到 shape 端點造成地圖瞬移/零距離假象。';
existing.source_notes = SYDNEY_SOURCE_NOTES;
writeFileSync(SYDNEY_JSON, JSON.stringify(existing));
console.log(`寫回 ${SYDNEY_JSON}`);

// schedule_dense.json 的 source_notes 同樣是 gtfs2rail.mjs 寫死的 Entur/NLOD 字串,一併修正。
const SCHED_JSON = SYDNEY_JSON.replace(/\.json$/, '_schedule_dense.json');
if (existsSync(SCHED_JSON)) {
  const sched = JSON.parse(readFileSync(SCHED_JSON, 'utf8'));
  sched.source_notes = '來源:Transport for NSW (TfNSW) Open Data Hub GTFS Static 完整時刻表 ' +
    '(https://opendata.transport.nsw.gov.au/dataset/timetables-complete-gtfs ,檔名 full_greater_sydney_gtfs_static_0.zip);' +
    '授權 Creative Commons Attribution 4.0(CC BY 4.0,https://creativecommons.org/licenses/by/4.0/legalcode ),' +
    '標註義務:「Transport for NSW is attributed as the source」(逐字引用自 https://opendata.transport.nsw.gov.au/datalicence );' +
    '下載快照日 2026-07-11;風險:UI 顯示需登入,但直接對 resource 檔案 URL 匿名 GET 可下載成功(HTTP 200),' +
    '此為觀察到的現況、非官方書面保證的公開 API,若未來收緊,備援為使用者自行免費註冊取 API key;' +
    `篩選 route_type∈{2,401,900};目標服務日期 ${TARGET_DATE}(時區 Australia/Sydney);` +
    '時刻為 GTFS 原始 HH:MM:SS 直接轉秒(跨午夜 HH>=24 不 wrap,與現有 tra_schedule_dense.json 慣例一致)';
  writeFileSync(SCHED_JSON, JSON.stringify(sched));
  console.log(`寫回 ${SCHED_JSON}(僅更新 source_notes,trains[] 不動)`);
}
