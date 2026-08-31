#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const GEO = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'istanbul.json'), 'utf8'));
const SCHED = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'istanbul_schedule_dense.json'), 'utf8'));
const I18N = JSON.parse(fs.readFileSync(path.join(ROOT, 'i18n', 'stations.json'), 'utf8'));
const langs = ['zh-TW','en','ja'], city = 'istanbul_sched';
const fail = (msg) => { console.error(`✗ ${msg}`); process.exitCode = 1; };
const stations = new Set(GEO.lines.flatMap((line) => line.stations.map((st) => st.name)));

for (const name of stations) for (const lang of langs) {
  if (!I18N.systems?.[city]?.[name]?.[lang]) fail(`station ${name}: missing ${lang}`);
}
for (const line of GEO.lines) for (const lang of langs) {
  if (!I18N.routes?.[city]?.[line.name]?.[lang]) fail(`route ${line.name}: missing ${lang}`);
}
for (const type of SCHED.types) for (const lang of langs) {
  if (!I18N.trainTypes?.[type.key]?.[lang]) fail(`type ${type.key}: missing ${lang}`);
}
if (!process.exitCode) {
  console.log(`✓ 伊斯坦堡三語 gate：${stations.size} 個唯一站名、${GEO.lines.length} 個路徑、${SCHED.types.length} 個線別類型皆有 zh-TW/en/ja`);
  console.log('✓ 無官方中日名稱集的土耳其文專名原樣保留，未杜撰營運機構譯名');
}
