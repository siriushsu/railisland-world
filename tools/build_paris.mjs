#!/usr/bin/env node
// 巴黎資料後製:gtfs2rail.mjs 產出 data/paris.json / data/paris_schedule_dense.json 之後,
// 就地(in-place)套用兩項後製:
//
// (1) 巴黎專屬篩選 ── agencyPrefix() 對 IDFM:71(RER)/IDFM:1046(Transilien)/IDFM:93(TER)
//     三者前綴皆為 "IDFM",既有工具的 --agency-exclude 對此無效,故用 route_short_name 後製
//     排除 TER(10 條線延伸出大巴黎大區外)；電車依量級門檻砍最小 6 條支線。
//
// (2) 代表 shape 重選 ── gtfs2rail.mjs 對每線挑「目標日期最常見(trip 數最多)的 shape_id」,
//     但巴黎 RER/Transilien 分支極多,「最常見」常是尖峰折返的短程支線變體,不含穿越市中心的
//     共用主幹段(如 RER C 最常見 shape 只到 Invalides 就斷了,完全不含 Musée d'Orsay/
//     Pont de l'Alma/Champ de Mars 這段沿塞納河左岸的招牌路段 ── 經站點 d 值全部退化為
//     shape 端點證實,詳見 gate 報告)。改採「目標日期候選 shape 中實際里程最長者」(而非
//     trip 數最多者)── 因為多分支線的所有分支必經同一段共用主幹,選最長的單一 trip pattern
//     可最大化涵蓋主幹+至少一條分支,不會不含市中心段。此步驟重新derive每條線的 shape/
//     shapeLen/stations,不改動既有 trains[](schedule_dense 的班表資料不受 shape 選取影響)。
//
// 用法:先跑 gtfs2rail.mjs 產生 data/paris.json + data/paris_schedule_dense.json,
// 再跑本腳本原地覆寫同兩檔(需原始 GTFS zip 路徑,因 shape 重選需重新掃 trips.txt/shapes.txt):
//   node tools/gtfs2rail.mjs --gtfs <zip> --sys 巴黎軌道 --tz Europe/Paris \
//     --route-types 0,1,2 --out-prefix data/paris --date 20260715 --typename-mode route
//   node tools/build_paris.mjs --gtfs <zip>

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createReadStream } from 'node:fs';
import { spawn } from 'node:child_process';
import readline from 'node:readline';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const TRACK_PATH = path.join(ROOT, 'data/paris.json');
const SCHED_PATH = path.join(ROOT, 'data/paris_schedule_dense.json');
const TARGET_DATE = '20260715';

const argv = process.argv.slice(2);
const gtfsIdx = argv.indexOf('--gtfs');
const GTFS_PATH = gtfsIdx >= 0 ? argv[gtfsIdx + 1] : null;
if (!GTFS_PATH || !existsSync(GTFS_PATH)) {
  console.error('缺 --gtfs <zip 路徑>(shape 重選步驟需要重新掃描原始 GTFS)');
  process.exit(1);
}
const isZip = GTFS_PATH.toLowerCase().endsWith('.zip');

// ── 沿用 gtfs2rail.mjs 的 CSV 串流讀取(逐字複製,因該檔唯讀不可 import) ──
function parseCSVLine(line) {
  const out = []; let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) { if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false; } else cur += c; }
    else { if (c === '"') inQ = true; else if (c === ',') { out.push(cur); cur = ''; } else cur += c; }
  }
  out.push(cur);
  return out;
}
function streamLines(entryName) {
  if (isZip) {
    const child = spawn('unzip', ['-p', GTFS_PATH, entryName], { stdio: ['ignore', 'pipe', 'pipe'] });
    child.stderr.resume();
    return readline.createInterface({ input: child.stdout, crlfDelay: Infinity });
  }
  return readline.createInterface({ input: createReadStream(path.join(GTFS_PATH, entryName)), crlfDelay: Infinity });
}
async function* csvRows(entryName) {
  const rl = streamLines(entryName);
  let header = null;
  for await (const raw of rl) {
    if (!raw) continue;
    const cols = parseCSVLine(raw);
    if (!header) { header = cols; continue; }
    const row = {};
    header.forEach((h, i) => row[h] = cols[i] ?? '');
    yield row;
  }
}

// ── 沿用 gtfs2rail.mjs 的幾何工具(逐字複製,確保與既有 shape/station 產出邏輯一致) ──
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

// ══════════════════════════════════════════════════════════════════
// 步驟 1:排除 TER + 電車支線砍量(對已產出的兩檔套用)
// ══════════════════════════════════════════════════════════════════
// TER:route_short_name 統一為 "TER",10 條線延伸出大巴黎大區到 Normandie/
// Bourgogne-Franche-Comté/Centre-Val de Loire/Hauts-de-France/Grand-Est,非「巴黎」系統範圍;
// RER/Transilien/TER 三 agency_id 前綴皆為 "IDFM" 無法用 --agency-exclude 區分,已改用
// route_short_name 後製排除。
//
// 電車支線:目標日期 route_type 0,1,2 扣除 TER 後共 20,783 車次,超過 20,000 量級門檻(超出
// 3.8%)。優先序:地鐵(10,942)全保、RER(2,051)全保、Transilien(2,082)全保 ── 三者合計
// 15,075,尚有餘裕;優先序未提及的電車(5,708)列為最後順位,砍最小的 6 條支線
// (T14/T13/T12/T7/T10/T9,合計 1,067 車次)湊足門檻,其餘 11 條主力電車線保留。
// 砍後總量 19,716 車次,在 20,000 門檻內。
const EXCLUDE_TYPENAMES = new Set(['TER', 'T14', 'T13', 'T12', 'T7', 'T10', 'T9']);

const track = JSON.parse(readFileSync(TRACK_PATH, 'utf8'));
const sched = JSON.parse(readFileSync(SCHED_PATH, 'utf8'));

const beforeLines = track.lines.length;
track.lines = track.lines.filter(l => !(l.id.startsWith('TER') || EXCLUDE_TYPENAMES.has(l.id)));
console.log(`paris.json:${beforeLines} → ${track.lines.length} 條線(排除 TER 10 條 + 電車 6 條支線)`);

const beforeTrains = sched.trains.length;
sched.trains = sched.trains.filter(t => !EXCLUDE_TYPENAMES.has(t.typeName));
const seenTypes = new Set();
sched.types = [];
for (const t of sched.trains) {
  if (seenTypes.has(t.typeName)) continue;
  seenTypes.add(t.typeName);
  sched.types.push({ key: t.typeName, color: t.color });
}
console.log(`paris_schedule_dense.json:${beforeTrains} → ${sched.trains.length} 車次(排除 TER + 電車 6 條支線)`);

// ══════════════════════════════════════════════════════════════════
// 步驟 2:代表 shape 重選(最長里程而非最常見 trip)
// ══════════════════════════════════════════════════════════════════
console.log('\n=== 重新掃描 GTFS 選 shape(最長里程優先) ===');

// 2a) routes.txt → sanitized shortName(比照 gtfs2rail.mjs id 清理規則)→ route_id
function sanitize(s) { return (s || '').replace(/[^A-Za-z0-9_-]/g, ''); }
const keepIds = new Set(track.lines.map(l => l.id));
const shortNameToRouteId = new Map();
for await (const r of csvRows('routes.txt')) {
  const t = Number(r.route_type);
  if (t !== 0 && t !== 1 && t !== 2) continue;
  const id = sanitize(r.route_short_name) || sanitize(r.route_id);
  if (keepIds.has(id) && !shortNameToRouteId.has(id)) shortNameToRouteId.set(id, r.route_id);
}
const missingRouteId = [...keepIds].filter(id => !shortNameToRouteId.has(id));
if (missingRouteId.length) console.log('警告:找不到 route_id 對應(將維持 gtfs2rail.mjs 原 shape):', missingRouteId.join(','));
const routeIdToLineId = new Map();
for (const [lineId, routeId] of shortNameToRouteId) routeIdToLineId.set(routeId, lineId);
const wantedRouteIds = new Set(shortNameToRouteId.values());

// 2b) calendar.txt + calendar_dates.txt → 目標日期有效 service_id(邏輯同 gtfs2rail.mjs)
const calendar = new Map();
for await (const r of csvRows('calendar.txt')) {
  calendar.set(r.service_id, {
    bits: [r.monday, r.tuesday, r.wednesday, r.thursday, r.friday, r.saturday, r.sunday].map(Number),
    start: r.start_date, end: r.end_date,
  });
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

// 2c) trips.txt → 每個目標路線的候選 shape_id 集合(僅目標日期有效班次)
const routeShapeTripCount = new Map(); // routeId -> Map(shapeId -> tripCount)
let tripsScanned = 0;
for await (const r of csvRows('trips.txt')) {
  tripsScanned++;
  if (!wantedRouteIds.has(r.route_id)) continue;
  if (!r.shape_id) continue;
  if (!serviceActive(r.service_id)) continue;
  if (!routeShapeTripCount.has(r.route_id)) routeShapeTripCount.set(r.route_id, new Map());
  const m = routeShapeTripCount.get(r.route_id);
  m.set(r.shape_id, (m.get(r.shape_id) || 0) + 1);
}
console.log(`trips.txt:掃了 ${tripsScanned} 筆,${routeShapeTripCount.size}/${wantedRouteIds.size} 條線有候選 shape`);

// 2d) shapes.txt → 只收候選 shape_id 的原始點
const neededShapeIds = new Set();
for (const m of routeShapeTripCount.values()) for (const sid of m.keys()) neededShapeIds.add(sid);
const shapeRaw = new Map();
let shapesScanned = 0;
for await (const r of csvRows('shapes.txt')) {
  shapesScanned++;
  if (!neededShapeIds.has(r.shape_id)) continue;
  if (!shapeRaw.has(r.shape_id)) shapeRaw.set(r.shape_id, []);
  shapeRaw.get(r.shape_id).push({ seq: Number(r.shape_pt_sequence), lat: Number(r.shape_pt_lat), lon: Number(r.shape_pt_lon) });
}
console.log(`shapes.txt:掃了 ${shapesScanned} 筆,命中 shape_id ${shapeRaw.size}/${neededShapeIds.size}`);
for (const pts of shapeRaw.values()) pts.sort((a, b) => a.seq - b.seq);

// 2e) 每線挑「涵蓋度最佳」的候選 shape:對每個候選 shape,把該線全部真實站點投影上去,
// 算有多少站落在「非端點夾死」的區間(d 不在 0 或 shapeLen 的 0.05km 內),取這個數字
// 最大者(分支多的線,單一 trip pattern 無法涵蓋所有分支,但可挑一條讓最多真實站點落在
// 路徑「中段」而非全部夾在起點/終點的候選;同分再比里程長、再比 trip 數)。
// 先前試過「只比里程最長」,結果 RER C 選到一條 61km 但仍讓西/北向分支(Alma/Champ de
// Mars/Kennedy/Neuilly/Gennevilliers 等)全部夾死在起點的 shape,涵蓋度並未真正最佳化,
// 故改直接以涵蓋度本身當排序依據。
const RDP_EPS = 0.03;
const byLineId = new Map(track.lines.map(l => [l.id, l]));
const CLAMP_EPS_KM = 0.05;
let replaced = 0, keptOriginal = 0;
for (const [routeId, shapeCounts] of routeShapeTripCount) {
  const lineId = routeIdToLineId.get(routeId);
  const line = byLineId.get(lineId);
  if (!line) continue;

  // 站點來源:改用 schedule_dense 已篩好的該線 trains(名稱+座標皆已由 gtfs2rail.mjs
  // 正確解析,不需重掃 stop_times.txt),依站名彙整唯一座標。
  const uniqStops = new Map(); // name -> {lat,lon}
  for (const t of sched.trains) {
    if (t.typeName !== lineId) continue;
    for (const s of t.stops) if (!uniqStops.has(s.name)) uniqStops.set(s.name, { lat: s.lat, lon: s.lon });
  }

  let best = null; // {shapeId, lenKm, tripCount, pts, simplified, cum, coverage}
  for (const [sid, cnt] of shapeCounts) {
    const raw = shapeRaw.get(sid);
    if (!raw || raw.length < 2) continue;
    const pts = raw.map(p => [p.lat, p.lon]);
    const lenKm = cumOf(pts)[pts.length - 1];
    const simplified = rdp(pts, RDP_EPS);
    const cum = cumOf(simplified);
    let coverage = 0;
    for (const { lat, lon } of uniqStops.values()) {
      const pr = projectAll([lat, lon], simplified, cum)[0]; // 全域最近點即可,只為算涵蓋度
      // 站點離 shape 太遠(垂直距離 >=0.3km)代表它根本不在這條路徑的實體範圍內,不能算「涵蓋」
      // (先前漏了這個距離門檻,導致算出的涵蓋度把「離很遠但恰好落在中段」的站也誤計為已涵蓋,
      // 實測 RER C 因此選到一條僅 27km 卻「涵蓋」45/58 站的錯誤候選 ── 加上此門檻後同一批候選
      // 正確地只剩 18/58,見 tools/build_paris.mjs 開發過程 scratchpad 驗證記錄)。
      if (pr && pr.dist < 0.3 && pr.s > CLAMP_EPS_KM && pr.s < lenKm - CLAMP_EPS_KM) coverage++;
    }
    if (!best || coverage > best.coverage ||
      (coverage === best.coverage && lenKm > best.lenKm) ||
      (coverage === best.coverage && lenKm === best.lenKm && cnt > best.tripCount)) {
      best = { shapeId: sid, lenKm, tripCount: cnt, pts, simplified, cum, coverage };
    }
  }
  if (!best) { keptOriginal++; continue; }
  const currentCoverage = line.stations.filter(s => s.d > CLAMP_EPS_KM && s.d < line.shapeLen - CLAMP_EPS_KM).length;
  // 只有涵蓋度真的更好,或涵蓋度打平但明顯更長時才替換,避免無意義抖動
  if (best.coverage < currentCoverage || (best.coverage === currentCoverage && best.lenKm <= line.shapeLen + 0.05)) {
    keptOriginal++; continue;
  }

  const simplified = best.simplified, cum = best.cum;
  const stationList = [];
  for (const [name, { lat, lon }] of uniqStops) {
    for (const pr of projectAll([lat, lon], simplified, cum)) {
      stationList.push({ name, lat: +lat.toFixed(6), lon: +lon.toFixed(6), d: +pr.s.toFixed(4) });
    }
  }
  const seenD = new Map();
  const dedup = stationList.filter(s => {
    const ds = seenD.get(s.name);
    if (ds && ds.some(d => Math.abs(d - s.d) < REVISIT_MIN_SEP_KM)) return false;
    if (ds) ds.push(s.d); else seenD.set(s.name, [s.d]);
    return true;
  });
  dedup.sort((a, b) => a.d - b.d);

  line.shape = simplified.map(p => [+p[0].toFixed(6), +p[1].toFixed(6)]);
  line.shapeLen = +cum[cum.length - 1].toFixed(4);
  line.stations = dedup;
  replaced++;
}
console.log(`shape 重選:${replaced} 條線換成涵蓋度更佳的代表 shape,${keptOriginal} 條線維持原選(已是最佳或無更佳候選)`);

// ══════════════════════════════════════════════════════════════════
// 步驟 3:改寫 source_notes(附完整授權標註與方法論)
// ══════════════════════════════════════════════════════════════════
const SOURCE_NOTES_TRACK =
  '來源:transport.data.gouv.fr 國家介接點鏡射(非 PRIM 原站,免帳號/token) ' +
  'https://eu.ftp.opendatasoft.com/stif/GTFS/IDFM-gtfs.zip(Île-de-France Mobilités 官方 GTFS static feed,' +
  '快照抓取於 2026-07-11,每日更新 3 次 08:00/13:00/17:00,calendar 涵蓋 2026-07-07~2026-08-08 之 ' +
  '~32 天滾動窗;逾窗需重抓,不可沿用舊 zip)。' +
  '授權:Licence Mobilités(2021,La Fabrique des Mobilités,非泛用 Etalab/ODbL ── PRIM 官方頁面 ' +
  'https://prim.iledefrance-mobilites.fr/en/licences 明列 GTFS 班表資料走此獨立授權軌道,已取官方 PDF ' +
  '逐字核對)。Article 3.1 明文商業使用；Article 5.6.b 明文動畫視覺化屬「產出創作」不構成需 ' +
  'share-alike 之「衍生資料庫」；Article 5.4 標註義務(逐字範例,Article 5.4.a):「Contient des ' +
  'informations de IDFM GTFS (Horaires théoriques réseau IDFM), présentement mises à disposition ' +
  'aux conditions de la « Licence Mobilités »」,並附來源資料庫連結 ' +
  'https://prim.iledefrance-mobilites.fr/fr/jeux-de-donnees/horaires-theoriques-et-temps-reel-tous-les-modes-de-transport-en-si ' +
  '＋授權文本連結 https://prim.iledefrance-mobilites.fr/en/licences。' +
  '範圍:route_type∈{0=電車,1=地鐵,2=RER+Transilien},排除 agency「TER」(route_short_name 統一為 ' +
  '"TER",10 條線延伸出大巴黎大區到 Normandie/Bourgogne-Franche-Comté/Centre-Val de Loire/' +
  'Hauts-de-France/Grand-Est,非巴黎系統範圍;RER/Transilien/TER 三 agency_id 前綴皆為 "IDFM" ' +
  '無法用既有 --agency-exclude 區分,已改用 route_short_name 後製排除)。' +
  '電車支線因目標日期總量超過 20,000 門檻,砍最小 6 條(T14/T13/T12/T7/T10/T9);地鐵剛好 16 條線' +
  '(1,2,3,3B,4,5,6,7,7B,8,9,10,11,12,13,14)全數 RATP;RER 5 線(A-E);Transilien 9 線' +
  '(H,J,K,L,N,P,R,U,V);電車保留 11 線(T1,T2,T3a,T3b,T4,T5,T6,T8,T11,ORLYVAL,CDG VAL)。' +
  '每路線 shape 選取:目標日期各候選 trip 之 shape 中,「讓最多真實站點落在路徑中段(非起訖點' +
  '夾死)」者(而非最常見 trip 數者,也非單純比里程最長 ── 純比里程最長仍可能選到讓某方向分支' +
  '全部夾死在端點的 shape,已實測驗證改採涵蓋度本身排序更準)。巴黎 RER/Transilien 分支極多,' +
  '最常見的單一 trip pattern 常是尖峰折返的短程支線,不含穿越市中心的共用主幹段;改採涵蓋度優先' +
  '可確保盡量涵蓋主幹+較完整的分支,但單一 trip 的 shape 終究無法同時涵蓋線路兩端都有分支的' +
  '「Y-Y 型」拓撲(如 RER C 南北向分支不可能同時在一條 shape 上),同一路線未涵蓋到的分支/端點' +
  '仍只呈現單一代表路徑,非完整多分支路網(與既有城市資料同慣例限制)。另發現地鐵 4 號線在' +
  '目標日期的原始 GTFS trip 本身即無任何單一 trip 覆蓋全線(直接查證 stop_times.txt:同日 1518' +
  '班次最長者僅 12 站,中段 Châtelet~Saint-Placide 塞納河沿岸段完全不在任何一筆 trip 內,' +
  '推測為該線 CBTC 自動化調度的 trip 切分方式,非本管線篩選造成;13 號線亦有類似但較輕微情形' +
  '(最長 trip 26/32 站)。Douglas-Peucker 簡化' +
  '(eps=0.03km)。線色取 GTFS routes.txt 官方 route_color。詳細篩選/選 shape 邏輯見 tools/build_paris.mjs。';

const SOURCE_NOTES_SCHED =
  '來源與授權同 data/paris.json(見該檔 source_notes;transport.data.gouv.fr 鏡射 IDFM GTFS,' +
  'Licence Mobilités,Article 5.4 標註義務同上)。目標服務日期 20260715(週三,時區 Europe/Paris);' +
  '時刻為 GTFS 原始 HH:MM:SS 直接轉秒(跨午夜 HH>=24 不 wrap,與現有 tra_schedule_dense.json 慣例一致)。' +
  '已排除 agency「TER」(10 條區域線延伸出大巴黎大區外,見 data/paris.json 說明)；電車已砍最小 6 條支線 ' +
  '(T14/T13/T12/T7/T10/T9,共 1,067 車次)以符合 20,000 車次量級門檻,其餘電車/全數地鐵/全數 RER/' +
  '全數 Transilien 保留,詳見 tools/build_paris.mjs。';

track.source_notes = SOURCE_NOTES_TRACK;
sched.source_notes = SOURCE_NOTES_SCHED;

writeFileSync(TRACK_PATH, JSON.stringify(track));
writeFileSync(SCHED_PATH, JSON.stringify(sched));
console.log('\ndone');
