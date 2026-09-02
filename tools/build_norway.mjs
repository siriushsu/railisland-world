#!/usr/bin/env node
// 挪威資料後製：把 gtfs2rail.mjs 產出的原始結果篩成「Bane NOR 官方線號清單」。
//
// 為什麼需要這一步：Entur 的全國聚合 GTFS 是**多營運商的聯集**，裡面混著三類不屬於
// 「挪威現行鐵路線」的東西，而 gtfs2rail.mjs 只依 route_type 篩，濾不掉它們：
//   1) 跨境鄰國線的對向登錄（如 route_short_name「Luleå-Stockholm」、數字線號 30/31/33/…）
//   2) 已停駛卻仍留在 lines 登錄裡的線（2026-09-02 稽核：Norrtåg 6 條 activeDates 只到
//      2025-10-31）——不濾掉就會把停駛線畫上地圖
//   3) Entur 內部的班次變體碼（`x` 後綴，如 L2x／R13x／R23x）。它們在 Entur 有現行班次，
//      但 Bane NOR 的官方線號表與 Vy 官網時刻表都沒有這些代號。舊快照只收了 R23x 一個、
//      沒收其餘四個，兩邊都不是——本檔一律以 Bane NOR 官方線號為準，變體全不收。
//
// 判準來源：Bane NOR「Toglinjer i Norge」https://www.banenor.no/reise-og-trafikk/toglinjer/
// （挪威國營鐵路基礎設施管理者的官方帶線號清單，比 Entur developer 頁更適合當「官方現行路線」）。
//
// 用法：先跑 gtfs2rail.mjs 產出到暫存前綴，再跑本腳本：
//   node tools/gtfs2rail.mjs --gtfs <entur.zip> --sys 挪威鐵道 --tz Europe/Oslo \
//     --route-types 100,101,102,105,106 --out-prefix <暫存>/norway_raw --date 20260909 \
//     --typename-mode route
//   node tools/build_norway.mjs <暫存>/norway_raw

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW = process.argv[2];
if (!RAW) { console.error('用法：node tools/build_norway.mjs <gtfs2rail 的 --out-prefix>'); process.exit(1); }

// Bane NOR 官方線號（2026-09-02 逐字取自上述頁面，33 條；F8 在頁面上有兩筆條目但同一個線號）
const OFFICIAL = ['F1', 'F2', 'F4', 'F5', 'F6', 'F7', 'F8', 'FLY1', 'FLY2',
  'L1', 'L2', 'L4', 'L5',
  'R12', 'R13', 'R14', 'R21', 'R22', 'R23', 'R31', 'R40', 'R45', 'R50', 'R55',
  'R60', 'R65', 'R70', 'R71', 'R75',
  'RE10', 'RE11', 'RE20', 'RE30'];
const KEEP = new Set(OFFICIAL);

const trackPath = `${RAW}.json`, schedPath = `${RAW}_schedule_dense.json`;
for (const p of [trackPath, schedPath]) if (!existsSync(p)) { console.error(`找不到 ${p}`); process.exit(1); }
const track = JSON.parse(readFileSync(trackPath, 'utf8'));
const sched = JSON.parse(readFileSync(schedPath, 'utf8'));

const beforeLines = track.lines.length, beforeTrains = sched.trains.length;
const dropped = track.lines.filter(l => !KEEP.has(l.id)).map(l => l.id);
track.lines = track.lines.filter(l => KEEP.has(l.id));
sched.trains = sched.trains.filter(t => KEEP.has(t.typeName));
if (sched.types) sched.types = sched.types.filter(t => KEEP.has(t.key));

// 官方有、但目標日期沒有班次的線要明確報出來——靜默少線正是舊快照缺 6 條卻沒人發現的原因
const got = new Set(track.lines.map(l => l.id));
const missing = OFFICIAL.filter(id => !got.has(id));

track.system = '挪威鐵道';
sched.system = '挪威鐵道';

const NOTES = '來源:Entur 全國 GTFS 聚合檔(NLOD 授權,' +
  'https://storage.googleapis.com/marduk-production/outbound/gtfs/rb_norway-aggregated-gtfs.zip);' +
  `目標服務日期 ${sched.date}(時區 Europe/Oslo);route_type∈{100,101,102,105,106}。` +
  '路線母體以 Bane NOR 官方線號表為準(https://www.banenor.no/reise-og-trafikk/toglinjer/,' +
  `2026-09-02 逐字取得 ${OFFICIAL.length} 個線號),不在該表上的一律不收:包含跨境鄰國線的對向登錄、` +
  '已停駛但仍留在 Entur lines 登錄裡的線(如 Norrtåg 6 條 activeDates 只到 2025-10-31),' +
  '以及 Entur 內部的班次變體碼(`x` 後綴 L2x/R13x/R23x/RX11/RX20——舊快照只收了 R23x 一個,' +
  '兩邊都不是,現一律不收)。每路線取最常用 shape_id 代表線型,Douglas-Peucker 簡化(eps=0.03km);' +
  '站點依投影弧長(km)排序。' +
  (missing.length ? `未收錄:${missing.join('、')}。` : '官方 33 條線全數收錄。') +
  'F1／F2／F8 三條跨境線未收錄的原因是**官方 feed 沒有給線型**:它們在目標日期確實有班' +
  '(2026-09-09 分別有 10／5／1 筆有效 trip),但 trips.txt 的 shape_id 欄位全部是空的' +
  '(F1 13 筆、F2 43 筆、F8 4 筆,無一例外),而本管線需要代表 shape 才畫得出路徑。' +
  '這三條在 Entur 也不是用 Bane NOR 線號登錄(F8 短名為空、long_name「Stockholm-Narvik (-Luleå)」;' +
  'F1 登錄為 SJ 的「70」、long_name「Stockholm-Hallsberg-Karlstad-Oslo」;F2 登錄為 Snälltåget 的' +
  '「IC」、long_name「Malmö C」),已在清洗副本把 route_short_name 對回官方線號,線型仍缺。' +
  '其中 F8(Ofotbanen)最可惜——Narvik 是挪威境內唯一與其餘鐵路網不相連的旅客鐵道。';
track.source_notes = NOTES;
sched.source_notes = NOTES;

writeFileSync(path.join(ROOT, 'data', 'norway.json'), JSON.stringify(track));
writeFileSync(path.join(ROOT, 'data', 'norway_schedule_dense.json'), JSON.stringify(sched));

console.log(`線:${beforeLines} → ${track.lines.length}（剔除 ${dropped.length} 條:${dropped.join(',') || '無'}）`);
console.log(`車次:${beforeTrains} → ${sched.trains.length}`);
console.log(`官方 ${OFFICIAL.length} 條中，目標日期有班次 ${track.lines.length} 條` +
  (missing.length ? `，無班次 ${missing.length} 條:${missing.join(',')}` : '，全數到齊'));
