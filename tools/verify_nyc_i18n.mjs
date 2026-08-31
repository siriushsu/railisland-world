#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [track, source, catalog, scope] = await Promise.all([
  readFile(path.join(ROOT, 'data/nyc.json'), 'utf8').then(JSON.parse),
  readFile(path.join(ROOT, 'i18n/nyc.json'), 'utf8').then(JSON.parse),
  readFile(path.join(ROOT, 'i18n/stations.json'), 'utf8').then(JSON.parse),
  readFile(path.join(ROOT, 'data/route_scope.json'), 'utf8').then(JSON.parse),
]);
const stations = new Set(track.lines.flatMap(line => line.stations.map(station => station.name)));
const routes = new Set(track.lines.map(line => line.name));
const stationRows = catalog.systems.nyc_sched || {};
const routeRows = catalog.routes.nyc_sched || {};
let failures = 0;
function check(ok, message) { if (!ok) { failures++; console.error(`✗ ${message}`); } }

check(source.auditedAt === '2026-08-31', '語系查證日不正確');
check(Object.keys(stationRows).length === stations.size, `站名索引 ${Object.keys(stationRows).length}≠${stations.size}`);
check(Object.keys(routeRows).length === routes.size, `路線索引 ${Object.keys(routeRows).length}≠${routes.size}`);
for (const name of stations) {
  const row = stationRows[name];
  check(Boolean(row), `缺站名 ${name}`);
  if (!row) continue;
  for (const lang of ['zh-TW', 'en', 'ja']) check(row[lang] === name, `${name} 的 ${lang} 未依 MTA 官方英文專名保留原文`);
}
for (const name of routes) {
  const row = routeRows[name];
  check(Boolean(row), `缺路線 ${name}`);
  if (row) for (const lang of ['zh-TW', 'en', 'ja']) check(typeof row[lang] === 'string' && row[lang].length > 0, `${name} 缺 ${lang}`);
}
const city = scope.systems.find(system => system.id === 'nyc_sched');
check(city?.routeVerificationStatus === 'complete', 'route_scope 尚未標記紐約路線完成');
for (const lang of scope.launchLocales) check(city?.localeStatus?.[lang] === 'complete', `route_scope 的 ${lang} 尚未完成`);
if (failures) process.exit(1);
console.log(`✓ 紐約 ${stations.size} 個官方站名與 ${routes.size} 個 route variant 的繁中／英文／日文索引全數通過`);
