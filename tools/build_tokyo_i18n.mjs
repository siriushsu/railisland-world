#!/usr/bin/env node
// 東京三語索引建置器。Tokyo Metro 採官方繁中/英文/日文各線頁；Toei 日文站名與英文
// 採官方 GTFS-JP translations.txt。東京都交通局未提供對等的地鐵繁中站名資料集，
// 因此 Toei 專有站名在 zh-TW 保留官方日文專名（與 NYC 無官方譯名時的策略一致）。

import { readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const execFileAsync = promisify(execFile);
const args = Object.fromEntries(process.argv.slice(2).reduce((rows, token, index, all) => {
  if (token.startsWith('--')) rows.push([token.slice(2), all[index + 1]]);
  return rows;
}, []));
if (!args['toei-gtfs']) throw new Error('缺 --toei-gtfs /path/Toei-Train-GTFS.zip');

function parseCSVLine(line) {
  const out = []; let value = '', quoted = false;
  for (let index = 0; index < line.length; index++) {
    const character = line[index];
    if (quoted) {
      if (character === '"' && line[index + 1] === '"') { value += '"'; index++; }
      else if (character === '"') quoted = false;
      else value += character;
    } else if (character === '"') quoted = true;
    else if (character === ',') { out.push(value); value = ''; }
    else value += character;
  }
  out.push(value); return out;
}
function csvRows(text) {
  const lines = text.replaceAll('\r', '').trim().split('\n');
  const header = parseCSVLine(lines.shift());
  return lines.map(line => Object.fromEntries(header.map((key, index) => [key, parseCSVLine(line)[index] || ''])));
}
function localizedByCode(source, slug, locale) {
  return new Map(source.lines[slug][locale].map(row => [row.code, row.name]));
}
function codeValue(map, code) { return map.get(code) || map.get(`${code[0].toLowerCase()}${code.slice(1)}`); }

const [track, source, catalog, translationText] = await Promise.all([
  readFile(path.join(ROOT, 'data/tokyo.json'), 'utf8').then(JSON.parse),
  readFile(path.join(ROOT, 'i18n/tokyo.json'), 'utf8').then(JSON.parse),
  readFile(path.join(ROOT, 'i18n/stations.json'), 'utf8').then(JSON.parse),
  execFileAsync('unzip', ['-p', path.resolve(args['toei-gtfs']), 'translations.txt'], { maxBuffer: 2_000_000 }).then(result => result.stdout),
]);

const stationI18n = new Map();
for (const [slug, localized] of Object.entries(source.lines)) {
  const ja = localizedByCode(source, slug, 'ja');
  const en = localizedByCode(source, slug, 'en');
  const zhTW = localizedByCode(source, slug, 'zh-TW');
  for (const [code, jaName] of ja) {
    stationI18n.set(jaName, { 'zh-TW': codeValue(zhTW, code), en: codeValue(en, code), ja: jaName });
  }
}
const toeiEnglish = new Map();
for (const row of csvRows(translationText)) {
  if (row.table_name === 'stops' && row.field_name === 'stop_name' && row.language === 'en') toeiEnglish.set(row.field_value, row.translation);
}
const stationNames = [...new Set(track.lines.flatMap(line => line.stations.map(station => station.name)))];
for (const name of stationNames) {
  if (stationI18n.has(name)) continue;
  stationI18n.set(name, { 'zh-TW': name, en: toeiEnglish.get(name) || name, ja: name });
}

const ROUTES = {
  '大江戸線': ['大江戶線', 'Toei Oedo Line', '大江戸線'],
  '三田線': ['三田線', 'Toei Mita Line', '三田線'],
  '新宿線': ['新宿線', 'Toei Shinjuku Line', '新宿線'],
  '浅草線': ['淺草線', 'Toei Asakusa Line', '浅草線'],
  '東京さくらトラム（都電荒川線）': ['東京櫻花路面電車（都電荒川線）', 'Tokyo Sakura Tram (Toden Arakawa Line)', '東京さくらトラム（都電荒川線）'],
  '日暮里・舎人ライナー': ['日暮里・舍人線', 'Nippori-Toneri Liner', '日暮里・舎人ライナー'],
  '銀座線': ['銀座線', 'Tokyo Metro Ginza Line', '銀座線'],
  '丸ノ内線': ['丸之內線', 'Tokyo Metro Marunouchi Line', '丸ノ内線'],
  '丸ノ内線 方南町支線': ['丸之內線 方南町支線', 'Tokyo Metro Marunouchi Line · Honancho branch', '丸ノ内線 方南町支線'],
  '日比谷線': ['日比谷線', 'Tokyo Metro Hibiya Line', '日比谷線'],
  '東西線': ['東西線', 'Tokyo Metro Tozai Line', '東西線'],
  '千代田線': ['千代田線', 'Tokyo Metro Chiyoda Line', '千代田線'],
  '有楽町線': ['有樂町線', 'Tokyo Metro Yurakucho Line', '有楽町線'],
  '半蔵門線': ['半藏門線', 'Tokyo Metro Hanzomon Line', '半蔵門線'],
  '南北線': ['南北線', 'Tokyo Metro Namboku Line', '南北線'],
  '副都心線': ['副都心線', 'Tokyo Metro Fukutoshin Line', '副都心線'],
};
const TYPE_ROUTE = {
  A: '浅草線', I: '三田線', S: '新宿線', E: '大江戸線', SA: '東京さくらトラム（都電荒川線）', NT: '日暮里・舎人ライナー',
  G: '銀座線', M: '丸ノ内線', Mb: '丸ノ内線 方南町支線', H: '日比谷線', T: '東西線', C: '千代田線', Y: '有楽町線', Z: '半蔵門線', N: '南北線', F: '副都心線',
};
catalog.generated = source.auditedAt;
catalog.systems.tokyo_sched = Object.fromEntries([...stationI18n.entries()].sort(([a], [b]) => a.localeCompare(b, 'ja')));
catalog.routes.tokyo_sched = Object.fromEntries(Object.entries(ROUTES).map(([name, [zhTW, en, ja]]) => [name, { 'zh-TW': zhTW, en, ja }]));
for (const key of Object.keys(catalog.trainTypes || {})) if (/^東京(?:A|I|S|E|SA|NT|G|M|Mb|H|T|C|Y|Z|N|F)$/.test(key)) delete catalog.trainTypes[key];
for (const [id, route] of Object.entries(TYPE_ROUTE)) {
  const [zhTW, en, ja] = ROUTES[route];
  catalog.trainTypes[`${id}・${zhTW.replace(/（[^）]+）/g, '').replace(/\s+/g, '')}`] = { 'zh-TW': `${id}・${zhTW}`, en: `${id} · ${en}`, ja: `${id}・${ja}` };
}
await writeFile(path.join(ROOT, 'i18n/stations.json'), JSON.stringify(catalog, null, 2) + '\n');
console.log(`✓ 東京三語索引：${stationI18n.size} 站、${Object.keys(ROUTES).length} 個路徑名、${Object.keys(TYPE_ROUTE).length} 個專用車種 key`);
console.log(`  Toei 官方英文譯名命中 ${stationNames.filter(name => toeiEnglish.has(name)).length} 站；其餘 zh-TW 專名保留官方日文`);
