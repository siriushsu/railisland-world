#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [track, source, catalog, scope] = await Promise.all([
  readFile(path.join(ROOT, 'data/singapore.json'), 'utf8').then(JSON.parse),
  readFile(path.join(ROOT, 'i18n/singapore.json'), 'utf8').then(JSON.parse),
  readFile(path.join(ROOT, 'i18n/stations.json'), 'utf8').then(JSON.parse),
  readFile(path.join(ROOT, 'data/route_scope.json'), 'utf8').then(JSON.parse),
]);
const actualStations = new Set(track.lines.flatMap(line => line.stations.map(station => station.name)));
const actualRoutes = new Set(track.lines.map(line => line.name));
const sourceStations = new Set(Object.keys(source.stations));
const sourceRoutes = new Set(Object.keys(source.routes));
const rows = catalog.systems.singapore || {};
const routeRows = catalog.routes.singapore || {};
let failures = 0;

function check(ok, message) {
  if (ok) return;
  failures++;
  console.error(`✗ ${message}`);
}
function sameSet(a, b) {
  return a.size === b.size && [...a].every(value => b.has(value));
}

check(source.auditedAt === '2026-08-31', '語系查證日不正確');
check(source.stationCount === 185 && actualStations.size === 185, `站名總數應為 185，source=${source.stationCount}、track=${actualStations.size}`);
check(source.routeVariantCount === 13 && actualRoutes.size === 13, `路線 variant 應為 13，source=${source.routeVariantCount}、track=${actualRoutes.size}`);
check(sameSet(actualStations, sourceStations), '語系來源的站名集合與現行路網不一致');
check(sameSet(actualRoutes, sourceRoutes), '語系來源的路線集合與現行路網不一致');

for (const name of actualStations) {
  const row = rows[name];
  check(Boolean(row), `catalog 缺站名 ${name}`);
  if (!row) continue;
  check(typeof row['zh-TW'] === 'string' && /\p{Script=Han}/u.test(row['zh-TW']), `${name} 缺繁中站名`);
  check(typeof row.en === 'string' && row.en.length > 0, `${name} 缺英文站名`);
  check(typeof row.ja === 'string' && /[\p{Script=Katakana}\p{Script=Hiragana}\p{Script=Han}]/u.test(row.ja), `${name} 缺日文站名`);
  check(row.en === name.replace(/ \([A-Z]+\d+\)$/, ''), `${name} 的英文顯示名未正確移除內部代碼`);
}
for (const name of actualRoutes) {
  const row = routeRows[name];
  check(Boolean(row), `catalog 缺路線名稱 ${name}`);
  if (!row) continue;
  for (const lang of ['zh-TW', 'en', 'ja']) check(typeof row[lang] === 'string' && row[lang].length > 0, `${name} 缺 ${lang} 路線名稱`);
}

const singaporeScope = scope.systems.find(system => system.id === 'singapore');
check(singaporeScope?.routeVerificationStatus === 'complete', 'route_scope 尚未標記新加坡路線稽核完成');
for (const lang of scope.launchLocales) check(singaporeScope?.localeStatus?.[lang] === 'complete', `route_scope 的 ${lang} 尚未完成`);

if (failures) {
  console.error(`\n新加坡多語驗證失敗：${failures} 項`);
  process.exit(1);
}
console.log('✓ 新加坡 185 個站名、13 個路線 variant 的繁中／英文／日文索引全數通過');
