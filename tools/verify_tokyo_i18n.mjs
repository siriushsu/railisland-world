#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [track, source, catalog] = await Promise.all([
  readFile(path.join(ROOT, 'data/tokyo.json'), 'utf8').then(JSON.parse),
  readFile(path.join(ROOT, 'i18n/tokyo.json'), 'utf8').then(JSON.parse),
  readFile(path.join(ROOT, 'i18n/stations.json'), 'utf8').then(JSON.parse),
]);
const locales = ['zh-TW', 'en', 'ja'];
for (const [slug, localized] of Object.entries(source.lines)) {
  const counts = locales.map(locale => localized[locale].length);
  if (new Set(counts).size !== 1) throw new Error(`${slug} 三語站數不一致：${counts.join('/')}`);
  const codeSets = locales.map(locale => new Set(localized[locale].map(row => row.code.toLowerCase())));
  for (const code of codeSets[0]) if (codeSets.slice(1).some(set => !set.has(code))) throw new Error(`${slug} ${code} 三語缺漏`);
}
const stations = catalog.systems.tokyo_sched || {};
for (const name of new Set(track.lines.flatMap(line => line.stations.map(station => station.name)))) {
  if (!stations[name]) throw new Error(`東京站名索引缺 ${name}`);
  for (const locale of locales) if (!stations[name][locale]) throw new Error(`${name} 缺 ${locale}`);
}
for (const line of track.lines) {
  const route = catalog.routes.tokyo_sched?.[line.name];
  if (!route) throw new Error(`東京路線索引缺 ${line.name}`);
  for (const locale of locales) if (!route[locale]) throw new Error(`${line.name} 缺 ${locale}`);
  const typeKey = Object.keys(catalog.trainTypes || {}).find(key => key.startsWith(`${line.id}・`));
  const type = typeKey && catalog.trainTypes[typeKey];
  if (!type) throw new Error(`東京${line.id} 缺專用 trainType 翻譯`);
  for (const locale of locales) if (!type[locale]) throw new Error(`東京${line.id} 缺 ${locale}`);
}
console.log(`✓ 東京三語 gate：${Object.keys(stations).length} 站、${track.lines.length} 路徑，zh-TW/en/ja 皆完整`);
console.log('✓ Tokyo Metro 官方三語站碼集合逐線一致；Toei 英文取官方 GTFS translations');
