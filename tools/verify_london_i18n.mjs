#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const GEO = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'london.json'), 'utf8'));
const SCHED = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'london_schedule_dense.json'), 'utf8'));
const I18N = JSON.parse(fs.readFileSync(path.join(ROOT, 'i18n', 'stations.json'), 'utf8'));
const fail = (msg) => { console.error(`✗ ${msg}`); process.exitCode = 1; };
const locales = ['zh-TW', 'en', 'ja'];

const stations = [...new Set(GEO.lines.flatMap((line) => line.stations.map((st) => st.name)))];
for (const name of stations) for (const lang of locales) if (!I18N.systems.london?.[name]?.[lang]) fail(`station ${name}: missing ${lang}`);
for (const line of GEO.lines) for (const lang of locales) if (!I18N.routes.london?.[line.name]?.[lang]) fail(`route ${line.name}: missing ${lang}`);
for (const type of SCHED.types) for (const lang of locales) if (!I18N.trainTypes?.[type.key]?.[lang]) fail(`type ${type.key}: missing ${lang}`);

if (Object.keys(I18N.systems.london || {}).length !== stations.length) fail('station translation count mismatch');
if (Object.keys(I18N.routes.london || {}).length !== GEO.lines.length) fail('route translation count mismatch');
if (!process.exitCode) {
  console.log(`✓ 倫敦三語 gate：${stations.length} 站、${GEO.lines.length} 路徑、${SCHED.types.length} 線別`);
  console.log('✓ zh-TW/en/ja 皆有值；TfL 無官方中日站名者保留官方英文專名');
}
