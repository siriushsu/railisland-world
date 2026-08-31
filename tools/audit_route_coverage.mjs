#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const scope = JSON.parse(await readFile(resolve(root, 'data/route_scope.json'), 'utf8'));
const release = process.argv.includes('--release');
const allRelease = process.argv.includes('--all-release');
const requiredLaunchLocales = ['zh-TW', 'en', 'ja'];
const localePolicyOk = requiredLaunchLocales.every(locale => scope.launchLocales?.includes(locale));
const routePolicyOk = Number.isFinite(scope.maxOfficialRouteReviewAgeDays) && scope.maxOfficialRouteReviewAgeDays > 0;
let snapshotErrors = localePolicyOk && routePolicyOk ? 0 : 1;
let knownRouteGaps = 0;
let knownMotionGaps = 0;
let knownTruthGaps = 0;
let coreRouteGaps = 0;
let coreMotionGaps = 0;
let coreTruthGaps = 0;
let coreVerificationGaps = 0;
let coreLocaleGaps = 0;

if (!localePolicyOk) console.error('✗ 首發語言設定必須包含 zh-TW、en、ja。');
if (!routePolicyOk) console.error('✗ maxOfficialRouteReviewAgeDays 必須是正數。');

for (const system of scope.systems) {
  const data = JSON.parse(await readFile(resolve(root, 'data', system.file), 'utf8'));
  const lines = Array.isArray(data.lines) ? data.lines : [];
  const ids = new Set(lines.map(line => String(line.id ?? line.name ?? '')));
  const missingRequired = system.requiredLineIds.filter(id => !ids.has(id));
  const countOk = lines.length === system.snapshotLineCount;
  const isCore = system.productTier === 'launch-core';
  const coreSchemaOk = !isCore || (
    ['routeBlockingGaps', 'motionBlockingGaps', 'truthfulnessBlockingGaps', 'scheduleEnhancements', 'routeVerificationEvidence']
      .every(key => Array.isArray(system[key])) &&
    typeof system.officialNetworkCheckedAt === 'string' &&
    typeof system.routeVerificationStatus === 'string'
  );
  const scopeOk = typeof system.productTier === 'string' && typeof system.completionDefinition === 'string' && coreSchemaOk;
  if (!countOk || missingRequired.length || !scopeOk) snapshotErrors++;
  const routeGaps = system.routeBlockingGaps ?? system.blockingGaps ?? [];
  const motionGaps = system.motionBlockingGaps ?? [];
  const truthGaps = system.truthfulnessBlockingGaps ?? [];
  const enhancements = system.scheduleEnhancements ?? [];
  knownRouteGaps += routeGaps.length;
  knownMotionGaps += motionGaps.length;
  knownTruthGaps += truthGaps.length;
  const pendingLocales = isCore
    ? requiredLaunchLocales.filter(locale => system.localeStatus?.[locale] !== 'complete')
    : [];
  const reviewAgeDays = isCore
    ? (Date.now() - Date.parse(`${system.officialNetworkCheckedAt}T00:00:00Z`)) / 86400000
    : 0;
  const routeReviewStale = isCore && (!Number.isFinite(reviewAgeDays) || reviewAgeDays > scope.maxOfficialRouteReviewAgeDays);
  const routeUnverified = isCore && system.routeVerificationStatus !== 'complete';
  if (isCore) {
    coreRouteGaps += routeGaps.length;
    coreMotionGaps += motionGaps.length;
    coreTruthGaps += truthGaps.length;
    coreVerificationGaps += Number(routeReviewStale) + Number(routeUnverified);
    coreLocaleGaps += pendingLocales.length;
  }
  const marks = [countOk ? `${lines.length} 線` : `線數 ${lines.length}≠${system.snapshotLineCount}`];
  if (missingRequired.length) marks.push(`快照缺必要 ID: ${missingRequired.join(', ')}`);
  if (!scopeOk) marks.push('缺範圍或核心 gate 欄位');
  if (routeGaps.length) marks.push(`路線待辦 ${routeGaps.length}`);
  if (motionGaps.length) marks.push(`流動待辦 ${motionGaps.length}`);
  if (truthGaps.length) marks.push(`來源／標示待辦 ${truthGaps.length}`);
  if (routeUnverified) marks.push('全線官方複核待完成');
  if (routeReviewStale) marks.push(`官方路網查證已超過 ${scope.maxOfficialRouteReviewAgeDays} 天`);
  if (enhancements.length) marks.push(`時刻增強 ${enhancements.length}（不阻擋）`);
  if (pendingLocales.length) marks.push(`三語待驗 ${pendingLocales.join(', ')}`);
  console.log(`${(!countOk || missingRequired.length || !scopeOk) ? '✗' : '✓'} ${system.label}: ${marks.join('；')}`);
}

console.log(`\n快照結構錯誤：${snapshotErrors}；首發核心路線缺口：${coreRouteGaps}；首發全線複核缺口：${coreVerificationGaps}；首發流動缺口：${coreMotionGaps}；首發來源／標示缺口：${coreTruthGaps}；首發翻譯缺口：${coreLocaleGaps}；全部已知路線缺口：${knownRouteGaps}；全部流動缺口：${knownMotionGaps}；全部來源／標示缺口：${knownTruthGaps}`);
if (snapshotErrors) process.exit(1);
if (release && (coreRouteGaps || coreVerificationGaps || coreMotionGaps || coreTruthGaps || coreLocaleGaps)) {
  console.error('首發 release gate 未通過：請先補齊現行路線與基本流動／誠實標示，並完成 zh-TW／en／ja 城市專屬內容；分鐘級時刻與即時位置不阻擋。');
  process.exit(2);
}
if (allRelease && (knownRouteGaps || coreVerificationGaps || knownMotionGaps || knownTruthGaps || coreLocaleGaps)) {
  console.error('全範圍 release gate 未通過：仍有路線、流動、來源／標示或首發三語缺口；策展／拆層項目須先完成或明確移出範圍。');
  process.exit(2);
}
