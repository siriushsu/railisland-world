#!/usr/bin/env node
// 墨爾本(Melbourne)三子系統合併腳本:V/Line 區域火車 + Metro Trains 都會火車 + Yarra Trams 電車。
//
// 前置踩坑(比照 tools/build_vienna.mjs 的 Vienna 案例,墨爾本 GTFS 同患兩個問題):
//  1) 三個子 feed 的 routes.txt/trips.txt/... 開頭都帶 UTF-8 BOM,gtfs2rail.mjs 的 CSV 解析
//     不會剝除 BOM,header 第一欄會被讀成 "﻿route_id",導致 route_id 全部收斂成
//     undefined(實測:候選路線從 13/34/24 條掉到 1 條、trips 白名單 0 筆)。已用
//     tools/gtfs2rail.mjs 唯讀不改,改用既有的 tools/build_vienna.mjs(其實是通用 BOM 剝除
//     前置腳本,非維也納專用)把三個子 feed 各自清洗到 scratchpad 暫存目錄。
//  2) 三個子 feed 的 routes.txt agency_id 欄位全空,若用 gtfs2rail.mjs 預設
//     --typename-mode agency 會讓 typeName 全部 undefined(JSON.stringify 直接丟掉該欄位,
//     types[] 只剩 1 筆且沒有 key)。已改用 --typename-mode route(用 route_short_name 當
//     typeName,如「Pakenham」「35」,比照 nyc/budapest 既有「每路線一個 type」慣例)。
//  3) Metro Trains feed(子資料夾 2)另外混有 17 條「Replacement Bus」替代巴士路線,
//     route_type 卻與都會火車同值(400),不濾除會混進「火車」清單。已在清洗副本的
//     routes.txt 用 route_short_name === "Replacement Bus" 過濾掉(scratchpad 內操作,
//     不動來源 GTFS 也不動 gtfs2rail.mjs)。
//
// 三個子 feed 各自跑 gtfs2rail.mjs 產出到 scratchpad 暫存前綴後,此腳本只做「內部格式層
// 合併」:line id / 車次碼加前綴(VL-/MT-/TR-)防撞,lines[]/trains[]/types[] 三路直接
// 串接(types 已核對三系統間 typeName 不重疊,不需額外前綴)。
//
// 用法:node tools/build_melbourne.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRATCH = '/private/tmp/claude-501/-Users-xuxiang-Code------/2cbdb064-06d3-4c63-90ae-6b17706bf3bc/scratchpad/melbourne';

const SUBSYSTEMS = [
  { prefix: 'VL', tag: 'vline', label: 'V/Line 區域火車' },
  { prefix: 'MT', tag: 'metro', label: 'Metro Trains 都會火車' },
  { prefix: 'TR', tag: 'tram', label: 'Yarra Trams 電車' },
];

const allLines = [];
const allTrains = [];
const allTypes = [];
const seenTypeKeys = new Set();
let targetDate = null;

for (const sub of SUBSYSTEMS) {
  const track = JSON.parse(fs.readFileSync(path.join(SCRATCH, `${sub.tag}.json`), 'utf8'));
  const sched = JSON.parse(fs.readFileSync(path.join(SCRATCH, `${sub.tag}_schedule_dense.json`), 'utf8'));
  if (!targetDate) targetDate = sched.date;
  else if (targetDate !== sched.date) throw new Error(`日期不一致:${sub.tag}=${sched.date} vs ${targetDate}`);

  for (const line of track.lines) allLines.push({ ...line, id: `${sub.prefix}-${line.id}` });
  for (const train of sched.trains) allTrains.push({ ...train, train: `${sub.prefix}-${train.train}` });
  for (const t of sched.types) {
    if (seenTypeKeys.has(t.key)) {
      console.warn(`警告:typeName「${t.key}」跨子系統撞名(${sub.tag}),沿用先出現者的顏色`);
      continue;
    }
    seenTypeKeys.add(t.key);
    allTypes.push(t);
  }
  console.log(`${sub.label}: ${track.lines.length} 線, ${sched.trains.length} 車次`);
}

allLines.sort((a, b) => b.shapeLen - a.shapeLen);

const SOURCE_NOTES = '來源:Victoria Department of Transport and Planning(Vic DTP)官方 GTFS 聚合檔' +
  '(CC BY 4.0,data.vic.gov.au / Public Transport Victoria);快照下載日 2026-07-11;' +
  '原始 zip 內含 8 個各自獨立的子資料夾 GTFS(1=V/Line 區域火車、2=Metro Trains 都會火車、' +
  '3=Yarra Trams 電車、4-6=各巴士營運商、10=The Overland 跨州臥鋪車、11=校車/其他),' +
  '本站僅收 1+2+3(火車與電車),巴士/客運/跨州車不收;三子 feed 的 routes.txt 皆帶 ' +
  'UTF-8 BOM 且 agency_id 欄位全空,已用 tools/build_vienna.mjs(通用 BOM 剝除前置腳本,' +
  '非維也納專用)清洗後再過 tools/gtfs2rail.mjs(--typename-mode route,因 agency_id 全空' +
  '無法用預設 agency 模式);Metro Trains feed 另混有 17 條「Replacement Bus」替代巴士' +
  '路線,route_type 誤標為與都會火車同值(400),已於清洗副本以 route_short_name 過濾' +
  '剔除(僅軌道施工替駛用,非實際列車服務);City Circle 35 路電車環線與 City Loop 地下' +
  '鐵環段皆為真實環狀路線,同站在路徑上出現兩次為正常現象;目標服務日期 2026-07-15' +
  '(南半球冬季平日時刻),時區 Australia/Melbourne;三子系統 line id / 車次碼加前綴 ' +
  'VL-(V/Line)/MT-(Metro Trains)/TR-(Yarra Trams)防撞後合併為單一資料集。';

const trackOut = { system: '墨爾本軌道', source_notes: SOURCE_NOTES, lines: allLines };
const schedOut = { system: '墨爾本軌道', date: targetDate, source_notes: SOURCE_NOTES, types: allTypes, trains: allTrains };

fs.writeFileSync(path.join(ROOT, 'data', 'melbourne.json'), JSON.stringify(trackOut));
fs.writeFileSync(path.join(ROOT, 'data', 'melbourne_schedule_dense.json'), JSON.stringify(schedOut));

console.log(`\n合併完成:${allLines.length} 線, ${allTrains.length} 車次, ${allTypes.length} types`);
console.log(`寫出 data/melbourne.json 與 data/melbourne_schedule_dense.json`);
