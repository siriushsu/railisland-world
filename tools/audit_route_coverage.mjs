#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const scope = JSON.parse(await readFile(resolve(root, 'data/route_scope.json'), 'utf8'));
const release = process.argv.includes('--release');
const allRelease = process.argv.includes('--all-release');
let snapshotErrors = 0;
let knownGaps = 0;
let coreGaps = 0;

for (const system of scope.systems) {
  const data = JSON.parse(await readFile(resolve(root, 'data', system.file), 'utf8'));
  const lines = Array.isArray(data.lines) ? data.lines : [];
  const ids = new Set(lines.map(line => String(line.id ?? line.name ?? '')));
  const missingRequired = system.requiredLineIds.filter(id => !ids.has(id));
  const countOk = lines.length === system.snapshotLineCount;
  const scopeOk = typeof system.productTier === 'string' && typeof system.completionDefinition === 'string';
  if (!countOk || missingRequired.length || !scopeOk) snapshotErrors++;
  knownGaps += system.blockingGaps.length;
  if (system.productTier === 'launch-core') coreGaps += system.blockingGaps.length;
  const marks = [countOk ? `${lines.length} 線` : `線數 ${lines.length}≠${system.snapshotLineCount}`];
  if (missingRequired.length) marks.push(`快照缺必要 ID: ${missingRequired.join(', ')}`);
  if (!scopeOk) marks.push('缺 productTier／completionDefinition');
  if (system.blockingGaps.length) marks.push(`待辦 ${system.blockingGaps.length}`);
  console.log(`${(!countOk || missingRequired.length || !scopeOk) ? '✗' : '✓'} ${system.label}: ${marks.join('；')}`);
}

console.log(`\n快照結構錯誤：${snapshotErrors}；首發核心缺口：${coreGaps}；全部已知缺口：${knownGaps}`);
if (snapshotErrors) process.exit(1);
if (release && coreGaps) {
  console.error('首發 release gate 未通過：請先清空 launch-core 城市的 blockingGaps。');
  process.exit(2);
}
if (allRelease && knownGaps) {
  console.error('全範圍 release gate 未通過：仍有 blockingGaps；策展／拆層項目須先完成或明確移出範圍。');
  process.exit(2);
}
