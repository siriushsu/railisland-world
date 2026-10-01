#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const GEO = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'istanbul.json'), 'utf8'));
const SCHED = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'istanbul_schedule_dense.json'), 'utf8'));
const fail = (msg) => { console.error(`✗ ${msg}`); process.exitCode = 1; };
const rad = (x) => x * Math.PI / 180, R = 6371;
const km = (a, b) => {
  const p = rad(b[0] - a[0]), q = rad(b[1] - a[1]);
  const h = Math.sin(p / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(q / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
};
const direction = (shape, i) => {
  const a = shape[Math.max(0, i - 1)], b = shape[Math.min(shape.length - 1, i + 1)];
  const x = (b[1] - a[1]) * Math.cos(rad((a[0] + b[0]) / 2)), y = b[0] - a[0], n = Math.hypot(x, y) || 1;
  return [x / n, y / n];
};
const backtracks = (shape) => {
  const out = [];
  for (let i = 1; i < shape.length - 1; i++) for (let j = i + 5; j < shape.length - 1; j++) {
    if (km(shape[i], shape[j]) >= 0.015) continue;
    const a = direction(shape, i), b = direction(shape, j), dot = a[0] * b[0] + a[1] * b[1];
    if (dot < -0.5) out.push([i, j]);
    if (out.length >= 3) return out;
  }
  return out;
};

const expected = {
  M1A:18,M1B:13,M2:15,M2A:2,M3:20,M4:23,M5:24,M6:4,M7:17,M8:13,M9:14,M11:15,
  T1:31,T2:5,T3:11,T4:22,T5:14,T6:8,F1:2,F2:2,F3:2,F4:2,TF1:2,TF2:2,Marmaray:43,B2:3,
};
if (GEO.lines.length !== 26) fail(`expected 26 paths, got ${GEO.lines.length}`);
if (new Set(GEO.lines.map((line) => line.id)).size !== GEO.lines.length) fail('duplicate path IDs');
for (const [id, count] of Object.entries(expected)) {
  const line = GEO.lines.find((x) => x.id === id);
  if (!line) { fail(`missing ${id}`); continue; }
  const got = id === 'T3' ? new Set(line.stations.map((s) => s.name)).size : line.stations.length;
  if (got !== count) fail(`${id}: expected ${count} stations, got ${got}`);
}
for (const line of GEO.lines) {
  if (line.shape.length < 2 || line.stations.length < 2) fail(`${line.id}: empty geometry/stations`);
  for (let i = 1; i < line.stations.length; i++) if (!(line.stations[i].d > line.stations[i - 1].d)) fail(`${line.id}: non-increasing station distance at ${i}`);
  const turns = backtracks(line.shape);
  if (turns.length) fail(`${line.id}: reverse re-traversal at ${JSON.stringify(turns)}`);
  const trains = SCHED.trains.filter((tr) => tr.train.startsWith(line.id));
  if (!trains.length) fail(`${line.id}: no synthetic motion`);
  if (line.id === 'T3') {
    if (!line.oneWay || line.stations[0].name !== line.stations.at(-1).name) fail('T3: loop topology/direction not preserved');
    if (trains.some((tr) => tr.train.includes('↑'))) fail('T3: invented reverse loop service');
  } else if (!trains.some((tr) => tr.train.includes('↓')) || !trains.some((tr) => tr.train.includes('↑'))) fail(`${line.id}: missing one direction`);
}
// Metro İstanbul 營運的路徑用官方時刻（tools/build_istanbul_timetable.mjs），其餘明示模擬並標 estimated
const SYNTHETIC = new Set(['M11', 'T2', 'T6', 'F2', 'F3', 'Marmaray', 'B2']);
for (const line of GEO.lines) {
  const trains = SCHED.trains.filter((tr) => tr.train.startsWith(line.id) && (tr.train.length === line.id.length || /[↓↑→]/.test(tr.train[line.id.length])));
  const est = trains.filter((tr) => tr.estimated).length;
  if (SYNTHETIC.has(line.id) ? est !== trains.length : est) fail(`${line.id}: ${est}/${trains.length} trains marked estimated`);
}
if (!GEO.source_notes.includes('模擬') || !SCHED.source_notes.includes('GetTimeTable') || !SCHED.source_notes.includes('estimated')) fail('timetable source disclosure missing');
if (!GEO.coverage?.excludes?.includes('unopened T7')) fail('unopened T7 exclusion missing');
if (!process.exitCode) {
  console.log('✓ 伊斯坦堡路網 gate：12 Metro、6 Tram、4 Funicular、2 Marmaray/通勤鐵路路徑完整；TF1/TF2 另作補充顯示');
  console.log('✓ M11 全線、M3/M4/M5 延伸、T2/T5/T6/F4 與 B2 均已收錄；T7 未提前加入');
  console.log(`✓ ${SCHED.trains.length.toLocaleString()} 班（Metro İstanbul 官方時刻＋其餘明示模擬）；T3 單向環未反向虛構，其餘路徑皆有正反方向`);
  console.log('✓ 全線反向重走 gate 為空（非相鄰點 <15m、方向點積 < -0.5）');
}
