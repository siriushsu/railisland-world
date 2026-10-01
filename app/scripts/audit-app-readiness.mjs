import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(here, '..');
const repoRoot = resolve(appRoot, '..');
const out = join(appRoot, 'www');
const fail = message => { throw new Error(`App readiness：${message}`); };
const expect = (condition, message) => { if (!condition) fail(message); };
const json = async path => JSON.parse(await readFile(path, 'utf8'));

const requiredCities = ['tokyo_sched', 'nyc_sched', 'london', 'istanbul_sched', 'singapore'];
const spec = await json(join(appRoot, 'world-app.config.json'));
const cap = await json(join(appRoot, 'capacitor.config.json'));
const pkg = await json(join(appRoot, 'package.json'));
expect(new Set(spec.cityIds).size === 5 && requiredCities.every(id => spec.cityIds.includes(id)), '首發城市必須固定為東京、紐約、倫敦、伊斯坦堡、新加坡');
expect(cap.appId === spec.appId && cap.appName === spec.appName && cap.webDir === 'www', 'Capacitor 設定與 world-app.config.json 不一致');
expect(cap.appId !== 'tw.railisland.app', '世界版不可沿用台灣版 bundle id');
for (const forbidden of ['firebase', '@capacitor-firebase/authentication', '@capacitor/geolocation', '@capacitor/local-notifications', '@revenuecat/purchases-capacitor']) {
  expect(!pkg.dependencies?.[forbidden] && !pkg.devDependencies?.[forbidden], `第一版不得帶入 ${forbidden}`);
}

execFileSync(process.execPath, [join(repoRoot, 'tools/audit_route_coverage.mjs'), '--release'], { cwd: repoRoot, stdio: 'inherit' });

for (const file of ['privacy.html', 'terms.html', 'app-support.html', 'legal.css', 'legal.js']) {
  const source = await readFile(join(repoRoot, file), 'utf8');
  expect(source.length > 200, `${file} 不存在或內容不足`);
}
for (const file of ['privacy.html', 'terms.html', 'app-support.html']) {
  const source = await readFile(join(repoRoot, file), 'utf8');
  for (const lang of ['zh-TW', 'en', 'ja']) expect(source.includes(`data-lang="${lang}"`), `${file} 缺 ${lang}`);
}
const supportPage = await readFile(join(repoRoot, 'app-support.html'), 'utf8');
const legalRuntime = await readFile(join(repoRoot, 'legal.js'), 'utf8');
for (const url of ['https://apps.apple.com/tw/app/id6792673516', 'https://play.google.com/store/apps/details?id=tw.railisland.app', 'https://railisland.tw']) {
  expect(legalRuntime.includes(url), `台灣版軌島對應連結缺 ${url}`);
}
expect((supportPage.match(/data-rail-island-link/g) || []).length === 3, '三語支援頁沒有各自提供台灣版軌島入口');

const builtIndex = await readFile(join(out, 'index.html'), 'utf8');
const builtWorldI18n = await readFile(join(out, 'i18n/world-translations.js'), 'utf8');
expect(builtIndex.includes('window.RAIL_APP = true'), 'App bundle 未注入原生旗標');
expect(builtIndex.includes('"plusEnabled":false'), 'App bundle 未明確關閉台灣版付費功能');
expect(builtIndex.includes('"ofmOnly":true'), 'App bundle 未鎖定 OpenFreeMap');
expect(builtIndex.includes('"streetSrc":"ofm"') && builtIndex.includes('ofm://vector'), 'App bundle 沒有可獨立建層的 OFM-only 設定');
expect(builtIndex.includes("localStorage.setItem('trainmap-basemap', 'map')"), 'OFM-only App 沒有清除過去的衛星底圖選擇');
expect(!/cartocdn\.com|basemaps\.carto|arcgis\.com|stadiamaps\.com|APP_CFG\.esriKey/i.test(builtIndex), 'App bundle 仍含 CARTO／Esri／Stadia raster 或金鑰路徑');
expect(!/fetch\([^\n]*(?:basemap-src|basemap-token|basemap-session)/i.test(builtIndex), 'OFM-only App 仍含其他底圖 API 請求程式');
expect(!builtIndex.includes('og-world-1200x630.png'), 'App bundle 仍指向未採用的舊世界版宣傳圖');
expect(builtIndex.includes('<meta property="og:image" content="favicon-512.png" />') && builtIndex.includes('<meta property="og:image:width" content="512" />') && builtIndex.includes('<meta property="og:image:height" content="512" />'), 'App bundle 沒有把 og:image 正確改為原軌島 icon');
expect(!await stat(join(out, 'og-world-1200x630.png')).then(() => true).catch(() => false), 'App bundle 不應攜帶未使用的舊世界版宣傳圖');
expect(!builtIndex.includes('ko-fi.com') && !builtIndex.includes('111010691056'), 'App bundle 仍含網站外部贊助入口');
expect(!builtIndex.includes('<script src="firebase-config.js">') && !builtIndex.includes('<script src="revenuecat-config.js">'), 'App bundle 仍載入帳號／付費設定');
for (const page of ['privacy.html', 'terms.html', 'app-support.html']) expect(builtIndex.includes(`href="${page}"`), `App 內找不到 ${page} 入口`);
const howtoStart = builtIndex.indexOf('<div class="howto-wrap"');
const howtoEnd = builtIndex.indexOf('<!-- 站台帶', howtoStart);
const howto = builtIndex.slice(howtoStart, howtoEnd);
expect(howtoStart >= 0 && howtoEnd > howtoStart, 'App bundle 找不到首訪說明卡');
expect(howto.includes('世界版怎麼玩') && howto.includes('上面選城市，切換五座首發城市'), '首訪說明卡不是世界版內容');
expect(!howto.includes('>台鐵<') && !howto.includes('>431<') && !howto.includes('全／台／高／捷'), '首訪說明卡仍殘留台灣版內容');
expect(builtWorldI18n.includes('How to use Rail Island World') && builtWorldI18n.includes('軌島・世界の使い方'), '首訪說明卡缺英文或日文翻譯');

const expectedData = new Set(['istanbul.json','istanbul_schedule_dense.json','london.json','london_schedule_dense.json','nyc.json','nyc_schedule_dense.json','singapore.json','singapore_schedule_dense.json','tokyo.json','tokyo_schedule_dense.json']);
const actualData = new Set(await readdir(join(out, 'data')));
expect(actualData.size === expectedData.size && [...expectedData].every(file => actualData.has(file)), 'App bundle 的城市資料不是精確五城集合');
for (const file of ['index.html', 'native-bridge.js', 'manifest.webmanifest', 'favicon-512.png', 'third-party-notices.txt', 'third-party-licenses.txt']) {
  expect((await stat(join(out, file))).size > 0, `App bundle 缺 ${file}`);
}
const licenses = await readFile(join(out, 'third-party-licenses.txt'), 'utf8');
for (const marker of ['Capacitor', 'MapLibre GL JS', 'three.js', 'PMTiles', 'fflate', 'OpenFreeMap', 'OpenStreetMap']) {
  expect(licenses.includes(marker), `第三方授權全文缺 ${marker}`);
}

const indexSource = await readFile(join(repoRoot, 'index.html'), 'utf8');
expect(indexSource.includes("const BUILD = 'world-v1001c'"), '網站 BUILD 尚未更新為 world-v1001c');
expect(indexSource.includes('OpenFreeMap（© OpenFreeMap'), '公開資料來源仍未正確標示 OpenFreeMap');
expect(indexSource.includes('id="taiwanAppLink"') && indexSource.includes('tw.railisland.app') && indexSource.includes('id6792673516'), '網站關於頁缺台灣版軌島的對應商店入口');

const nativeChecks = [];
try {
  const vars = await readFile(join(appRoot, 'android/variables.gradle'), 'utf8');
  const manifest = await readFile(join(appRoot, 'android/app/src/main/AndroidManifest.xml'), 'utf8');
  const rootGradle = await readFile(join(appRoot, 'android/build.gradle'), 'utf8');
  const appGradle = await readFile(join(appRoot, 'android/app/build.gradle'), 'utf8');
  const target = Number(/targetSdkVersion\s*=\s*(\d+)/.exec(vars)?.[1]);
  expect(target >= 36, `Android targetSdkVersion ${target || '找不到'}，2026 新版需至少 36`);
  expect(!/ACCESS_(FINE|COARSE|BACKGROUND)_LOCATION|POST_NOTIFICATIONS/.test(manifest), 'Android 第一版不應宣告定位或通知權限');
  expect(!/google-services|firebase/i.test(rootGradle + appGradle), 'Android 第一版不應載入 Google Services／Firebase build plugin');
  expect(appGradle.includes('RAILISLAND_WORLD_STORE_FILE') && appGradle.includes('versionCode 1'), 'Android release signing 範本或版本碼缺失');
  const androidIcon = await readFile(join(appRoot, 'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png'));
  expect(createHash('sha256').update(androidIcon).digest('hex') === '9d330cfb35ef0d1b1caf35a1974031788f7a0109e1a47e43cc9b345c6142722c', 'Android 沒有沿用原本軌島 icon');
  nativeChecks.push(`Android API ${target}`);
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  nativeChecks.push('Android 尚未建立');
}
try {
  const pbx = await readFile(join(appRoot, 'ios/App/App.xcodeproj/project.pbxproj'), 'utf8');
  const info = await readFile(join(appRoot, 'ios/App/App/Info.plist'), 'utf8');
  const privacyManifest = await readFile(join(appRoot, 'ios/App/App/PrivacyInfo.xcprivacy'), 'utf8');
  const exportOptions = await readFile(join(appRoot, 'ios/App/ExportOptions.plist.example'), 'utf8');
  expect(pbx.includes(spec.appId), 'iOS project 未使用世界版 bundle id');
  expect(pbx.includes('MARKETING_VERSION = 1.0.0;'), 'iOS 行銷版本不是 1.0.0');
  expect(!/NSLocation|NSUserTracking|NSCamera|NSPhotoLibrary/.test(info), 'iOS 第一版不應宣告定位、追蹤、相機或相簿用途');
  expect(pbx.includes('PrivacyInfo.xcprivacy in Resources'), 'iOS PrivacyInfo.xcprivacy 未加入 Resources');
  expect(privacyManifest.includes('<key>NSPrivacyTracking</key>') && privacyManifest.includes('<false/>'), 'iOS privacy manifest 未明確關閉追蹤');
  expect(privacyManifest.includes('<key>NSPrivacyCollectedDataTypes</key>') && privacyManifest.includes('<key>NSPrivacyAccessedAPITypes</key>'), 'iOS privacy manifest 缺必要宣告欄位');
  expect(exportOptions.includes('<string>app-store-connect</string>') && exportOptions.includes('<string>automatic</string>'), 'iOS App Store Connect export options 範本缺失或方法錯誤');
  const icon = await readFile(join(appRoot, 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png'));
  expect(createHash('sha256').update(icon).digest('hex') === 'c96ddc1db58208fa64a90dea358994e76c992306dd334920046f00799deb9201', 'iOS 沒有沿用原本軌島 icon');
  nativeChecks.push('iOS project 已建立');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  nativeChecks.push('iOS 尚未建立');
}

const digest = createHash('sha256').update(builtIndex).digest('hex').slice(0, 12);
console.log(`\nApp readiness PASS · 五城／三語／法律頁／無帳號付費定位 · ${nativeChecks.join(' · ')} · index ${digest}`);
