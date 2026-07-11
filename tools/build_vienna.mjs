#!/usr/bin/env node
// 前置腳本:維也納 GTFS(Wiener Linien)zip 每個 .txt 檔案(除 stops.txt 外)開頭都帶 UTF-8 BOM
// (EF BB BF),而 tools/gtfs2rail.mjs 的 CSV 解析不會剝除 BOM ── BOM 會混進 header 第一欄欄名
// (如 "route_id" 被讀成 "﻿route_id"),導致所有以該欄位查值的地方(route_id/service_id/
// shape_id/trip_id)全部取到 undefined,使白名單串接失敗(實測:候選路線 261 條卻只收到 1 條、
// trips 白名單 0 筆)。tools/gtfs2rail.mjs 為唯讀共用工具,不可修改;此腳本改為在餵給它之前,
// 先把 GTFS 解壓到暫存目錄並剝除每個檔案開頭的 BOM,再呼叫原版 gtfs2rail.mjs。
//
// 用法:node tools/build_vienna.mjs <gtfs.zip 路徑> <暫存輸出目錄>
// 之後另外呼叫:node tools/gtfs2rail.mjs --gtfs <暫存輸出目錄> --sys ... --out-prefix data/vienna ...

import { readdirSync, statSync, readFileSync, writeFileSync, mkdirSync, openSync, readSync, closeSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const [, , zipPath, outDir] = process.argv;
if (!zipPath || !outDir) {
  console.error('用法:node tools/build_vienna.mjs <gtfs.zip 路徑> <暫存輸出目錄>');
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
const unzipRes = spawnSync('unzip', ['-o', '-q', zipPath, '-d', outDir], { stdio: 'inherit' });
if (unzipRes.status !== 0) { console.error('unzip 失敗'); process.exit(1); }

const BOM = Buffer.from([0xef, 0xbb, 0xbf]);
function readHead3(p) {
  const fd = openSync(p, 'r');
  const buf = Buffer.alloc(3);
  readSync(fd, buf, 0, 3, 0);
  closeSync(fd);
  return buf;
}
function stripBomInPlace(p) {
  const buf = readFileSync(p);
  writeFileSync(p, buf.subarray(3));
}

for (const name of readdirSync(outDir)) {
  if (!name.endsWith('.txt')) continue;
  const p = path.join(outDir, name);
  if (statSync(p).size < 3) continue;
  if (readHead3(p).equals(BOM)) {
    console.log(`剝除 BOM:${name}`);
    stripBomInPlace(p);
  } else {
    console.log(`無 BOM,略過:${name}`);
  }
}

console.log(`完成,已剝除 BOM 的乾淨 GTFS 目錄:${outDir}`);
console.log('下一步:node tools/gtfs2rail.mjs --gtfs ' + outDir + ' --sys <系統名> --tz Europe/Vienna --route-types 0,1 --out-prefix data/vienna --date 20260715');
