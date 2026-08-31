#!/usr/bin/env node
// 伊斯坦堡官方頁只提供土耳其文專名；三語介面保留官方專名，不杜撰營運機構譯名，
// 同時完整翻譯路線類型、路徑標籤與資料說明。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const GEO = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'istanbul.json'), 'utf8'));
const SCHED = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'istanbul_schedule_dense.json'), 'utf8'));
const FILE = path.join(ROOT, 'i18n', 'stations.json');
const I18N = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const city = 'istanbul_sched';

const MODE = {
  metro: ['地鐵', 'metro', '地下鉄'],
  tram: ['電車', 'tram', 'トラム'],
  funicular: ['纜索鐵路', 'funicular', 'ケーブルカー'],
  cable: ['纜車', 'aerial cable car', 'ロープウェイ'],
  suburban: ['通勤鐵路', 'commuter rail', '近郊鉄道'],
};
const label = (line, langIndex) => {
  if (line.id === 'Marmaray') return ['Marmaray 通勤鐵路','Marmaray commuter rail','Marmaray近郊鉄道'][langIndex];
  if (line.id === 'B2') return ['Halkalı–Bahçeşehir 通勤鐵路','Halkalı–Bahçeşehir commuter rail','Halkalı–Bahçeşehir近郊鉄道'][langIndex];
  return `${line.id} ${MODE[line.mode][langIndex]}`;
};

I18N.systems[city] = {};
for (const name of [...new Set(GEO.lines.flatMap((line) => line.stations.map((st) => st.name)))].sort()) {
  I18N.systems[city][name] = { 'zh-TW': name, en: name, ja: name };
}

I18N.routes[city] = {};
for (const line of GEO.lines) {
  const suffix = line.name.slice(line.name.indexOf(' · ') + 3);
  I18N.routes[city][line.name] = {
    'zh-TW': `${label(line, 0)}・${suffix}`,
    en: `${label(line, 1)} · ${suffix}`,
    ja: `${label(line, 2)}・${suffix}`,
  };
}

for (const line of GEO.lines) {
  const type = SCHED.trains.find((tr) => tr.carName === line.name)?.typeName;
  if (!type) throw new Error(`missing train type for ${line.id}`);
  I18N.trainTypes[type] = { 'zh-TW': label(line, 0), en: label(line, 1), ja: label(line, 2) };
}

I18N.generated = '2026-08-31';
fs.writeFileSync(FILE, JSON.stringify(I18N, null, 2) + '\n');
console.log(`WROTE ${FILE}`);
console.log(`  Istanbul stations: ${Object.keys(I18N.systems[city]).length}`);
console.log(`  Istanbul routes: ${Object.keys(I18N.routes[city]).length}`);
console.log(`  Istanbul train types: ${new Set(SCHED.types.map((x) => x.key)).size}`);
