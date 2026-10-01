import { execFile } from 'node:child_process';
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(here, '..');
const repoRoot = resolve(appRoot, '..');
const out = join(appRoot, 'www');
const appSpec = JSON.parse(await readFile(join(appRoot, 'world-app.config.json'), 'utf8'));
const coreData = {
  tokyo_sched: ['data/tokyo.json', 'data/tokyo_schedule_dense.json'],
  nyc_sched: ['data/nyc.json', 'data/nyc_schedule_dense.json'],
  london: ['data/london.json', 'data/london_schedule_dense.json'],
  istanbul_sched: ['data/istanbul.json', 'data/istanbul_schedule_dense.json'],
  singapore: ['data/singapore.json', 'data/singapore_schedule_dense.json']
};

if (!Array.isArray(appSpec.cityIds) || appSpec.cityIds.length !== 5) {
  throw new Error('world-app.config.json 必須明列五個首發城市');
}
for (const id of appSpec.cityIds) if (!coreData[id]) throw new Error(`未知的 App 城市 id：${id}`);
if (!appSpec.cityIds.includes(appSpec.defaultCityId)) throw new Error('預設城市不在 App 城市清單內');

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

const trackedFiles = new Set(await new Promise((resolveFiles, rejectFiles) => {
  execFile('git', ['ls-files', '-z'], { cwd: repoRoot, maxBuffer: 64 * 1024 * 1024 }, (error, stdout) => {
    if (error) rejectFiles(error);
    else resolveFiles(stdout.split('\0').filter(Boolean));
  });
}));
if (!trackedFiles.size) throw new Error('git ls-files 回空，拒絕把無法辨識來源的檔案打進 App');

async function copyFile(relative) {
  if (!trackedFiles.has(relative.replaceAll('\\', '/'))) throw new Error(`App 建置只接受已追蹤檔案：${relative}`);
  const target = join(out, relative);
  await mkdir(dirname(target), { recursive: true });
  await cp(join(repoRoot, relative), target);
}

async function copyTree(relative) {
  const source = join(repoRoot, relative);
  for (const entry of await readdir(source)) {
    const child = join(relative, entry);
    const info = await stat(join(repoRoot, child));
    if (info.isDirectory()) await copyTree(child);
    else if (trackedFiles.has(child.replaceAll('\\', '/'))) await copyFile(child);
  }
}

for (const file of [
  'index.html', 'privacy.html', 'terms.html', 'app-support.html', 'legal.css', 'legal.js',
  'manifest.webmanifest', 'favicon-16.png', 'favicon-32.png', 'favicon-48.png',
  'favicon-192.png', 'favicon-512.png', 'apple-touch-180.png', 'icon-maskable-512.png'
]) await copyFile(file);
for (const file of [
  // 台灣版 2026-09 介面跟上時帶進來的通用模組:暗色 2.0、路線導覽、日夜光影、列車光環
  'night-theme.css', 'night-board.js', 'night-map.js', 'rail-discovery.js', 'rail-3d.css',
  'rail-3d/environment/sun.mjs', 'rail-3d/integration/train-halo-style.js', 'rail-3d/integration/formations.js'
]) await copyFile(file);
for (const directory of ['assets', 'i18n', 'vendor']) await copyTree(directory);
for (const id of appSpec.cityIds) for (const file of coreData[id]) await copyFile(file);

await build({
  entryPoints: [join(appRoot, 'src/native-bridge.mjs')],
  outfile: join(out, 'native-bridge.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['ios15', 'chrome100'],
  minify: true
});

const indexPath = join(out, 'index.html');
let html = await readFile(indexPath, 'utf8');
const replaceRegion = (source, name, start, end, replacement = '') => {
  const startAt = source.indexOf(start);
  const endAt = source.indexOf(end, startAt + start.length);
  if (startAt < 0 || endAt < 0) throw new Error(`index.html 缺少 App 建置錨點：${name}`);
  return source.slice(0, startAt) + replacement + source.slice(endAt + end.length);
};
const stripHtml = (source, name) => replaceRegion(source, name, `<!-- APP_STRIP_START ${name}`, `<!-- APP_STRIP_END ${name} -->`);
const stripJs = (source, name) => replaceRegion(source, name, `// APP_STRIP_START ${name}`, `// APP_STRIP_END ${name}`);

// 地圖引擎已是 MapLibre GL(本地 vendor/maplibre-gl.*,網站與 App 同一組標籤),不再替換 Leaflet CDN。
html = stripHtml(html, 'donate-box');
html = stripJs(html, 'web-tiles');
html = replaceRegion(
  html,
  'satellite-session',
  '// 開一顆 session。App 殼用自己 build 內的金鑰直接跟 Esri 要',
  '// 每次衛星圖磚載入時呼叫。三件事:累計張數、跨門檻就升級、效期快到就續一顆。',
  "async function fetchSatSession() { throw new Error('satellite disabled in Rail Island World'); }"
);
html = replaceRegion(
  html,
  'non-ofm-basemap-runtime',
  '  if (WORLD_BUILD) {\n    // 世界版沒有衛星圖源',
  '  // 外觀三段(亮/暗/自動;自動=跟隨系統)。舊鍵 trainmap-theme(light/dark)沿用為固定亮/暗',
  `  satTokenState = 'failed';
  if (state.basemap === 'sat') state.basemap = 'map';
  try { localStorage.setItem('trainmap-basemap', 'map'); } catch (e) {}
  // 外觀三段(亮/暗/自動;自動=跟隨系統)。舊鍵 trainmap-theme(light/dark)沿用為固定亮/暗`
);
const rejectedOgImage = 'https://siriushsu.github.io/railisland-world/og-world-1200x630.png';
if (!html.includes(rejectedOgImage)) throw new Error('找不到預期的網站 og:image，拒絕產出可能沿用舊宣傳圖的 App bundle');
html = html.replace(rejectedOgImage, 'favicon-512.png');
html = html.replace('<meta property="og:image:width" content="1200" />', '<meta property="og:image:width" content="512" />');
html = html.replace('<meta property="og:image:height" content="630" />', '<meta property="og:image:height" content="512" />');

const injected = `<script>\nwindow.RAIL_APP = true;\nwindow.RAIL_ONLINE_BASEMAPS_AVAILABLE = true;\nwindow.RAIL_APP_CONFIG = ${JSON.stringify({
  worldCityIds: appSpec.cityIds,
  defaultWorldCityId: appSpec.defaultCityId,
  plusEnabled: false,
  ofmOnly: true,
  streetSrc: 'ofm',
  tiles: {
    light: { url: 'ofm://vector', maxZoom: 20, attribution: 'OpenFreeMap / OpenMapTiles / OpenStreetMap' },
    dark: { url: 'ofm://vector', maxZoom: 20, attribution: 'OpenFreeMap / OpenMapTiles / OpenStreetMap' }
  },
  publicUrl: appSpec.publicUrl
})};\n</script>\n<script src="native-bridge.js"></script>`;
const configTags = '<script src="firebase-config.js"></script>\n<script src="revenuecat-config.js"></script>';
if (!html.includes(configTags)) throw new Error('找不到世界版的空 Firebase／RevenueCat 設定標籤');
html = html.replace(configTags, injected);
await writeFile(indexPath, html);

const licenseFiles = [
  'CAPACITOR-CORE-MIT.txt',
  'CAPACITOR-PLUGINS-MIT.txt',
  'MAPLIBRE-GL-JS-BSD-3-CLAUSE.txt',
  'MAP-DATA-ATTRIBUTION.txt'
];
const licenseSections = [];
for (const file of licenseFiles) {
  const source = await readFile(join(appRoot, 'licenses', file), 'utf8');
  licenseSections.push(`===== ${file} =====\n\n${source.trim()}\n`);
}
await writeFile(join(out, 'third-party-licenses.txt'), [
  '軌島・世界 App 第三方軟體授權與圖資聲明',
  'Rail Island World — Third-Party Licenses and Map Data Attribution',
  '',
  ...licenseSections
].join('\n'));
await cp(join(appRoot, 'THIRD_PARTY_NOTICES.md'), join(out, 'third-party-notices.txt'));

console.log(`軌島・世界 App web bundle 已建立：${appSpec.cityIds.length} 城，預設 ${appSpec.defaultCityId}`);
