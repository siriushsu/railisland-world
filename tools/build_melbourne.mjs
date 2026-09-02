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
// 暫存目錄由 MEL_SCRATCH 指定（原本寫死的是 2026-07 那個 session 的 scratchpad，早已不存在）。
const SCRATCH = process.env.MEL_SCRATCH;
if (!SCRATCH) { console.error('請設 MEL_SCRATCH=<gtfs2rail 產出的暫存目錄>'); process.exit(1); }

const SUBSYSTEMS = [
  { prefix: 'VL', tag: 'vline', label: 'V/Line 區域火車' },
  { prefix: 'MT', tag: 'metro', label: 'Metro Trains 都會火車' },
  { prefix: 'TR', tag: 'tram', label: 'Yarra Trams 電車' },
  // 2026-09-02 加收：官方 GTFS 第 10 號子 feed，route_type 102 長途鐵路，現行營運
  // （行事曆排到 2026-11-29）。原本從未被納入範圍討論，稽核覆核時才發現靜默漏掉。
  { prefix: 'GS', tag: 'overland', label: 'The Overland 跨州客運' },
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

// Flemington Racecourse：官方路網圖圖例明列的「Special event line」，整份 feed（2026-08-28~11-29，
// 94 天）只在 2026-09-05 一個週六營運。基準日取平日才拿得到 The Overland 與全部 13 條 V/Line
// （週六會少掉 2 條 V/Line、1 條 Metro 與 The Overland），因此改為：軌道線型從週六那份取進來，
// 班次不取——地圖上這條軌道會在，而基準日當天沒有車正是事實。
const satPath = path.join(SCRATCH, 'metro_sat.json');
if (fs.existsSync(satPath)) {
  const sat = JSON.parse(fs.readFileSync(satPath, 'utf8'));
  const rce = sat.lines.find(l => l.id === 'FlemingtonRacecourse');
  if (!rce) throw new Error('metro_sat.json 裡找不到 FlemingtonRacecourse，中止');
  if (allLines.some(l => l.id === 'MT-FlemingtonRacecourse')) throw new Error('基準日已含 Flemington，不應重複併入');
  allLines.push({ ...rce, id: 'MT-FlemingtonRacecourse' });
  console.log('特殊活動線: Flemington Racecourse 線型併入（0 車次，基準日不營運）');
}

allLines.sort((a, b) => b.shapeLen - a.shapeLen);

const SOURCE_NOTES = '來源:Victoria Department of Transport and Planning(Vic DTP)官方 GTFS 聚合檔' +
  '(CC BY 4.0,data.vic.gov.au / Public Transport Victoria);快照下載日 2026-07-11;' +
  '原始 zip 內含 8 個各自獨立的子資料夾 GTFS(1=V/Line 區域火車、2=Metro Trains 都會火車、' +
  '3=Yarra Trams 電車、4-6=各巴士營運商、10=The Overland 跨州客運、11=校車/其他),' +
  '本站收 1+2+3+10(火車、電車與跨州客運),巴士不收;四子 feed 的 routes.txt 皆帶 ' +
  'UTF-8 BOM 且 agency_id 欄位全空,已用 tools/build_vienna.mjs(通用 BOM 剝除前置腳本,' +
  '非維也納專用)清洗後再過 tools/gtfs2rail.mjs(--typename-mode route,因 agency_id 全空' +
  '無法用預設 agency 模式);Metro Trains feed 另混有 17 條「Replacement Bus」替代巴士' +
  '路線,route_type 誤標為與都會火車同值(400),已於清洗副本以 route_short_name 過濾' +
  '剔除(僅軌道施工替駛用,非實際列車服務);City Circle 35 路電車環線為真實環狀路線,' +
  '同站在路徑上出現兩次為正常現象——另注意都會火車的 City Circle(route_id ' +
  'aus:vic:vic-02-CCL:)不是常設路線:它全部 20 筆班次只掛在單一 service_id「T5+WD07_1」,' +
  '而那是 Metro Tunnel 封閉的工程包(同一個 id 另載 141 筆 Sunbury 接駁巴士),' +
  '只營運 2026-09-07~09,官方路網圖圖例的八項都會鐵路裡也沒有它,故不收;' +
  '目標服務日期 2026-09-17(南半球初春平日時刻),時區 Australia/Melbourne;' +
  'Flemington Racecourse 為官方圖例的「Special event line」,整份 feed 只在 2026-09-05 ' +
  '一個週六營運,故只併入線型、基準日 0 車次(取週六當基準日會少掉 2 條 V/Line、1 條 Metro ' +
  '與 The Overland,得不償失);四子系統 line id / 車次碼加前綴 ' +
  'VL-(V/Line)/MT-(Metro Trains)/TR-(Yarra Trams)/GS-(The Overland)防撞後合併為單一資料集。';

const trackOut = { system: '墨爾本軌道', source_notes: SOURCE_NOTES, lines: allLines };
const schedOut = { system: '墨爾本軌道', date: targetDate, source_notes: SOURCE_NOTES, types: allTypes, trains: allTrains };

fs.writeFileSync(path.join(ROOT, 'data', 'melbourne.json'), JSON.stringify(trackOut));
fs.writeFileSync(path.join(ROOT, 'data', 'melbourne_schedule_dense.json'), JSON.stringify(schedOut));

console.log(`\n合併完成:${allLines.length} 線, ${allTrains.length} 車次, ${allTypes.length} types`);
console.log(`寫出 data/melbourne.json 與 data/melbourne_schedule_dense.json`);
