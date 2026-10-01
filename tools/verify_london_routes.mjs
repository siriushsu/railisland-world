#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const GEO = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'london.json'), 'utf8'));
const NO_OFFICIAL_THROUGH_SERVICE = new Set(['dlr-lewisham-stratford']);
const SCHED = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'london_schedule_dense.json'), 'utf8'));
const fail = (msg) => { console.error(`✗ ${msg}`); process.exitCode = 1; };

const expected = { tube: 33, dlr: 6, 'elizabeth-line': 10, overground: 12, tram: 6 };
for (const [mode, count] of Object.entries(expected)) {
  const got = GEO.lines.filter((line) => line.mode === mode).length;
  if (got !== count) fail(`${mode}: expected ${count}, got ${got}`);
}
if (GEO.lines.length !== 67) fail(`expected 67 route variants, got ${GEO.lines.length}`);
if (new Set(GEO.lines.map((line) => line.id)).size !== GEO.lines.length) fail('duplicate route IDs');
if (new Set(GEO.lines.map((line) => line.lineId)).size !== 20) fail('expected 20 official line brands');

const requiredBrands = [
  'bakerloo','central','circle','district','hammersmith-city','jubilee','metropolitan','northern','piccadilly','victoria','waterloo-city',
  'dlr','elizabeth','liberty','lioness','mildmay','suffragette','weaver','windrush','tram',
];
for (const id of requiredBrands) if (!GEO.lines.some((line) => line.lineId === id)) fail(`missing brand ${id}`);

for (const line of GEO.lines) {
  if (line.stations.length < 2) fail(`${line.id}: fewer than two stations`);
  if (line.shape.length < line.stations.length) fail(`${line.id}: shape too short`);
  for (let i = 1; i < line.stations.length; i++) if (!(line.stations[i].d > line.stations[i - 1].d)) fail(`${line.id}: non-increasing distance at ${i}`);
  if (line.mode === 'tram' && !line.oneWay) fail(`${line.id}: tram route must preserve one-way direction`);
  if (line.mode !== 'tram' && line.oneWay) fail(`${line.id}: unexpected oneWay`);
  const trains = SCHED.trains.filter((tr) => tr.train.startsWith(`${line.id}`));
  // TfL 官方平日時刻沒有直通班的路徑：軌道仍由其他系統覆蓋（Stratford–Canary Wharf、Lewisham–Canary Wharf／Bank），
  // 路徑保留在地圖上但不虛構班次。新增例外前要先確認官方逐站時刻真的沒有。
  if (NO_OFFICIAL_THROUGH_SERVICE.has(line.id)) { if (trains.length) fail(`${line.id}: 官方時刻無直通班，卻出現班次`); continue; }
  if (!trains.length) fail(`${line.id}: no motion`);
  if (line.oneWay && trains.some((tr) => tr.train.includes('↑'))) fail(`${line.id}: invented reverse tram service`);
  if (!line.oneWay && (!trains.some((tr) => tr.train.includes('↓')) || !trains.some((tr) => tr.train.includes('↑')))) fail(`${line.id}: missing one direction`);
}
if (SCHED.types.length !== 20) fail(`expected 20 train types, got ${SCHED.types.length}`);
if (!process.exitCode) {
  console.log('✓ 倫敦路網 gate：20 個 TfL 現行線別、67 個官方端點／via 路徑');
  console.log('✓ Underground 33、DLR 6、Elizabeth 10、Overground 12、Tram 6');
  console.log(`✓ ${SCHED.trains.length.toLocaleString()} 班（官方平日時刻 ${SCHED.trains.filter(t => !t.estimated).length.toLocaleString()}、合成班距 ${SCHED.trains.filter(t => t.estimated).length.toLocaleString()}）；Tram 單向環未反向虛構`);
}
