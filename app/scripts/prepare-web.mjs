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
  'favicon-192.png', 'favicon-512.png', 'apple-touch-180.png', 'icon-maskable-512.png',
  'og-world-1200x630.png'
]) await copyFile(file);
for (const directory of ['assets', 'i18n', 'vendor']) await copyTree(directory);
for (const id of appSpec.cityIds) for (const file of coreData[id]) await copyFile(file);

const leafletDir = join(out, 'vendor', 'leaflet');
await mkdir(join(leafletDir, 'images'), { recursive: true });
await cp(join(appRoot, 'node_modules/leaflet/dist/leaflet.css'), join(leafletDir, 'leaflet.css'));
await cp(join(appRoot, 'node_modules/leaflet/dist/leaflet.js'), join(leafletDir, 'leaflet.js'));
await cp(join(appRoot, 'node_modules/leaflet/dist/images'), join(leafletDir, 'images'), { recursive: true });

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

html = replaceRegion(
  html,
  'leaflet-cdn',
  '<!-- APP_REPLACE_START leaflet-cdn',
  '<!-- APP_REPLACE_END leaflet-cdn -->',
  '<link rel="stylesheet" href="vendor/leaflet/leaflet.css">\n<script src="vendor/leaflet/leaflet.js"></script>'
);
html = stripHtml(html, 'donate-box');
html = stripHtml(html, 'donation-log');
html = stripJs(html, 'donation-handler');

const injected = `<script>\nwindow.RAIL_APP = true;\nwindow.RAIL_ONLINE_BASEMAPS_AVAILABLE = true;\nwindow.RAIL_APP_CONFIG = ${JSON.stringify({
  worldCityIds: appSpec.cityIds,
  defaultWorldCityId: appSpec.defaultCityId,
  plusEnabled: false,
  ofmOnly: true,
  publicUrl: appSpec.publicUrl
})};\n</script>\n<script src="native-bridge.js"></script>`;
const configTags = '<script src="firebase-config.js"></script>\n<script src="revenuecat-config.js"></script>';
if (!html.includes(configTags)) throw new Error('找不到世界版的空 Firebase／RevenueCat 設定標籤');
html = html.replace(configTags, injected);
await writeFile(indexPath, html);

await writeFile(join(out, 'third-party-notices.txt'), [
  '軌島・世界 App 第三方軟體與圖資聲明',
  '',
  'Capacitor 8.4.2 / Capacitor App 8.1.1 / Capacitor Share 8.0.1 — MIT License',
  'Leaflet 1.9.4 — BSD 2-Clause License',
  'MapLibre GL JS 4.7.1 — BSD 3-Clause License',
  'MapLibre GL Leaflet — MIT License',
  'OpenFreeMap — https://openfreemap.org/',
  'OpenMapTiles — https://openmaptiles.org/',
  'OpenStreetMap contributors — Open Database License (ODbL), https://www.openstreetmap.org/copyright',
  '',
  '各城市交通資料的來源與授權說明存放於對應 data/*.json 的 source_notes。'
].join('\n'));

console.log(`軌島・世界 App web bundle 已建立：${appSpec.cityIds.length} 城，預設 ${appSpec.defaultCityId}`);
