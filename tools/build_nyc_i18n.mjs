#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [track, source, catalog] = await Promise.all([
  readFile(path.join(ROOT, 'data/nyc.json'), 'utf8').then(JSON.parse),
  readFile(path.join(ROOT, 'i18n/nyc.json'), 'utf8').then(JSON.parse),
  readFile(path.join(ROOT, 'i18n/stations.json'), 'utf8').then(JSON.parse),
]);
const stationNames = [...new Set(track.lines.flatMap(line => line.stations.map(station => station.name)))].sort((a, b) => a.localeCompare(b, 'en'));
catalog.generated = source.auditedAt;
catalog.systems.nyc_sched = Object.fromEntries(stationNames.map(name => [name, { 'zh-TW': name, en: name, ja: name }]));
catalog.routes.nyc_sched = Object.fromEntries(Object.entries(source.routes).map(([name, [zhTW, en, ja]]) => [name, { 'zh-TW': zhTW, en, ja }]));
await writeFile(path.join(ROOT, 'i18n/stations.json'), JSON.stringify(catalog, null, 2) + '\n');
console.log(`✓ 已寫入紐約 ${stationNames.length} 個官方站名、${Object.keys(source.routes).length} 個 route variant 的三語索引`);
