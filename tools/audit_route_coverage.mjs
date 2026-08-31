#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const scope = JSON.parse(await readFile(resolve(root, 'data/route_scope.json'), 'utf8'));
const release = process.argv.includes('--release');
let snapshotErrors = 0;
let knownGaps = 0;

for (const system of scope.systems) {
  const data = JSON.parse(await readFile(resolve(root, 'data', system.file), 'utf8'));
  const lines = Array.isArray(data.lines) ? data.lines : [];
  const ids = new Set(lines.map(line => String(line.id ?? line.name ?? '')));
  const missingRequired = system.requiredLineIds.filter(id => !ids.has(id));
  const countOk = lines.length === system.snapshotLineCount;
  if (!countOk || missingRequired.length) snapshotErrors++;
  knownGaps += system.blockingGaps.length;
  const marks = [countOk ? `${lines.length} 線` : `線數 ${lines.length}≠${system.snapshotLineCount}`];
  if (missingRequired.length) marks.push(`快照缺必要 ID: ${missingRequired.join(', ')}`);
  if (system.blockingGaps.length) marks.push(`待辦 ${system.blockingGaps.length}`);
  console.log(`${snapshotErrors && (!countOk || missingRequired.length) ? '✗' : '✓'} ${system.label}: ${marks.join('；')}`);
}

console.log(`\n快照結構錯誤：${snapshotErrors}；已知路線／新鮮度缺口：${knownGaps}`);
if (snapshotErrors) process.exit(1);
if (release && knownGaps) {
  console.error('release gate 未通過：請先清空 route_scope.json 的 blockingGaps，或逐項改成已明示的策展範圍。');
  process.exit(2);
}
