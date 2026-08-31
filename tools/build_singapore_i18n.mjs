#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(ROOT, 'i18n/singapore.json');
const catalogPath = path.join(ROOT, 'i18n/stations.json');
const source = JSON.parse(await readFile(sourcePath, 'utf8'));
const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));

catalog.generated = source.auditedAt;
catalog.systems.singapore = Object.fromEntries(Object.entries(source.stations).map(([name, values]) => {
  const [zhTW, ja] = values;
  const en = name.replace(/ \([A-Z]+\d+\)$/, '');
  return [name, { 'zh-TW': zhTW, en, ja }];
}));
catalog.routes.singapore = Object.fromEntries(Object.entries(source.routes).map(([name, values]) => {
  const [zhTW, en, ja] = values;
  return [name, { 'zh-TW': zhTW, en, ja }];
}));

await writeFile(catalogPath, JSON.stringify(catalog, null, 2) + '\n');
console.log(`✓ 已寫入新加坡 ${Object.keys(catalog.systems.singapore).length} 站、${Object.keys(catalog.routes.singapore).length} 個路線 variant 的繁中／英文／日文索引`);
