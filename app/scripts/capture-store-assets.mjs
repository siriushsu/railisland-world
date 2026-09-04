import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir, readFile, rm, stat } from 'node:fs/promises';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(here, '..');
const webRoot = join(appRoot, 'www');
const assetsRoot = join(appRoot, 'store', 'assets');
const originalIcon = join(appRoot, 'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset', 'AppIcon-512@2x.png');

const locales = [
  { app: 'zh-TW', apple: 'zh-Hant', google: 'zh-TW', featureTitle: '軌島・世界', featureSub: '五座城市的鐵道流動' },
  { app: 'en', apple: 'en-US', google: 'en-US', featureTitle: 'Rail Island World', featureSub: 'Five cities. Railways in motion.' },
  { app: 'ja', apple: 'ja', google: 'ja-JP', featureTitle: '軌島・世界', featureSub: '5都市の鉄道の流れを地図で' }
];
const cities = [
  { id: 'tokyo_sched', slug: 'tokyo' },
  { id: 'nyc_sched', slug: 'new-york' },
  { id: 'london', slug: 'london' },
  { id: 'istanbul_sched', slug: 'istanbul' },
  { id: 'singapore', slug: 'singapore' }
];
const devices = [
  { store: 'apple', folder: 'iphone-6.9', width: 440, height: 956, scale: 3, outputWidth: 1320, outputHeight: 2868 },
  { store: 'apple', folder: 'ipad-13', width: 1032, height: 1376, scale: 2, outputWidth: 2064, outputHeight: 2752 },
  { store: 'google-play', folder: 'phone', width: 360, height: 640, scale: 3, outputWidth: 1080, outputHeight: 1920 },
  { store: 'google-play', folder: '10-inch-tablet', width: 800, height: 1280, scale: 1, outputWidth: 1600, outputHeight: 2560, resize: true }
];
const contentTypes = {
  '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.woff': 'font/woff', '.woff2': 'font/woff2'
};

await stat(join(webRoot, 'index.html')).catch(() => {
  throw new Error('找不到 app/www；請先執行 npm run build');
});

const resume = process.argv.includes('--resume');
if (!resume) await rm(assetsRoot, { recursive: true, force: true });
await mkdir(assetsRoot, { recursive: true });

const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url || '/', 'http://127.0.0.1').pathname);
    if (pathname === '/__store_original_icon.png') {
      response.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' });
      response.end(await readFile(originalIcon));
      return;
    }
    const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const file = normalize(join(webRoot, relative));
    if (!file.startsWith(`${webRoot}/`) && file !== join(webRoot, 'index.html')) throw new Error('invalid path');
    const body = await readFile(file);
    response.writeHead(200, { 'Content-Type': contentTypes[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    response.end(body);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  }
});
await new Promise(resolveServer => server.listen(0, '127.0.0.1', resolveServer));
const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}`;

const browser = await chromium.launch({ headless: true });
let captured = 0;
try {
  for (const device of devices) {
    for (const locale of locales) {
      const localeFolder = device.store === 'apple' ? locale.apple : locale.google;
      const output = join(assetsRoot, device.store, localeFolder, device.folder);
      await mkdir(output, { recursive: true });
      const context = await browser.newContext({
        viewport: { width: device.width, height: device.height },
        deviceScaleFactor: device.scale,
        isMobile: true,
        hasTouch: true,
        locale: locale.app === 'zh-TW' ? 'zh-TW' : locale.app === 'ja' ? 'ja-JP' : 'en-US',
        colorScheme: 'light',
        reducedMotion: 'reduce'
      });
      const page = await context.newPage();
      await page.addInitScript(({ language }) => {
        localStorage.setItem('trainmap-howto-seen', '1');
        localStorage.setItem('trainmap-language', language);
        localStorage.removeItem('trainmap-last-view');
      }, { language: locale.app });
      for (const [index, city] of cities.entries()) {
        const filename = `${String(index + 1).padStart(2, '0')}-${city.slug}.jpg`;
        const destination = join(output, filename);
        if (resume && await stat(destination).then(() => true).catch(() => false)) {
          captured += 1;
          continue;
        }
        const url = `${baseUrl}/?city=${encodeURIComponent(city.id)}&t=12:00&lang=${encodeURIComponent(locale.app)}&store=1`;
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
        await page.waitForFunction(expected =>
          document.documentElement.dataset.worldReady === '1' &&
          document.documentElement.dataset.activeSystem === expected &&
          Number(document.documentElement.dataset.trainCount || 0) > 0,
          city.id,
          { timeout: 60_000 }
        );
        await page.waitForSelector('.maplibregl-canvas', { state: 'visible', timeout: 30_000 });
        await page.evaluate(async () => { if (document.fonts?.ready) await document.fonts.ready; });
        await page.waitForTimeout(1800);
        await page.waitForFunction(() => {
          const element = document.querySelector('.leaflet-control-attribution');
          if (!element) return false;
          const evidence = `${element.textContent || ''} ${[...element.querySelectorAll('a')].map(link => link.href).join(' ')}`;
          return /OpenFreeMap|OpenMapTiles|OpenStreetMap|openfreemap\.org|openstreetmap\.org/i.test(evidence);
        }, null, { timeout: 30_000 }).catch(() => null);
        await page.waitForTimeout(800);
        const bodyText = await page.locator('body').innerText();
        if (/API\s*key|required API key|carto\.com\/attributions/i.test(bodyText)) {
          throw new Error(`${city.slug}/${locale.app} 出現 API key 或 CARTO 錯誤文字`);
        }
        const capturePath = device.resize ? `${destination}.capture.jpg` : destination;
        await page.screenshot({ path: capturePath, type: 'jpeg', quality: 92, fullPage: false });
        if (device.resize) {
          execFileSync('sips', ['-z', String(device.outputHeight), String(device.outputWidth), capturePath, '--out', destination], { stdio: 'ignore' });
          await rm(capturePath, { force: true });
        }
        const attribution = await page.locator('.leaflet-control-attribution').evaluateAll(elements => elements.map(element => ({
          text: element.textContent || '',
          links: [...element.querySelectorAll('a')].map(link => link.href),
          rect: element.getBoundingClientRect().toJSON(),
          display: getComputedStyle(element).display,
          opacity: getComputedStyle(element).opacity
        }))).catch(() => []);
        const attributionEvidence = JSON.stringify(attribution);
        if (!/OpenFreeMap|OpenMapTiles|OpenStreetMap|openfreemap\.org|openstreetmap\.org/i.test(attributionEvidence)) {
          throw new Error(`${city.slug}/${locale.app} 找不到 OpenFreeMap／OSM 署名：${attributionEvidence}`);
        }
        captured += 1;
      }
      await context.close();
    }
  }

  const featureContext = await browser.newContext({ viewport: { width: 1024, height: 500 }, colorScheme: 'light', reducedMotion: 'reduce' });
  const featurePage = await featureContext.newPage();
  for (const locale of locales) {
    await featurePage.goto(`${baseUrl}/?city=tokyo_sched&t=12:00&lang=${encodeURIComponent(locale.app)}&store=feature`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await featurePage.evaluate(({ language }) => {
      localStorage.setItem('trainmap-howto-seen', '1');
      localStorage.setItem('trainmap-language', language);
    }, { language: locale.app });
    await featurePage.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 });
    await featurePage.waitForFunction(() => document.documentElement.dataset.worldReady === '1' && Number(document.documentElement.dataset.trainCount || 0) > 0, null, { timeout: 60_000 });
    await featurePage.waitForSelector('.maplibregl-canvas', { state: 'visible', timeout: 30_000 });
    await featurePage.waitForTimeout(1800);
    await featurePage.evaluate(({ title, subtitle }) => {
      document.getElementById('__store_feature_overlay')?.remove();
      const overlay = document.createElement('div');
      overlay.id = '__store_feature_overlay';
      overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;padding:42px 54px;box-sizing:border-box;background:linear-gradient(90deg,rgba(239,230,210,.98) 0%,rgba(239,230,210,.95) 43%,rgba(239,230,210,.22) 72%,rgba(239,230,210,0) 100%);pointer-events:none;font-family:-apple-system,BlinkMacSystemFont,"Noto Sans",sans-serif;color:#173d72';
      const card = document.createElement('div');
      card.style.cssText = 'display:grid;grid-template-columns:112px 1fr;gap:22px;align-items:center;width:610px;filter:drop-shadow(0 4px 12px rgba(35,46,64,.15))';
      const icon = document.createElement('img');
      icon.src = '/__store_original_icon.png';
      icon.alt = '';
      icon.style.cssText = 'width:112px;height:112px;border-radius:25px';
      const text = document.createElement('div');
      text.innerHTML = `<div style="font-size:48px;font-weight:900;letter-spacing:.02em;line-height:1.05">${title}</div><div style="margin-top:13px;font-size:23px;font-weight:750;line-height:1.25;color:#4e5b6b">${subtitle}</div><div style="margin-top:16px;font-size:16px;font-weight:700;letter-spacing:.08em;color:#a5403c">TOKYO · NEW YORK · LONDON · ISTANBUL · SINGAPORE</div>`;
      card.append(icon, text);
      overlay.append(card);
      document.body.append(overlay);
    }, { title: locale.featureTitle, subtitle: locale.featureSub });
    await featurePage.waitForSelector('#__store_feature_overlay img', { state: 'visible' });
    const output = join(assetsRoot, 'google-play', locale.google);
    await mkdir(output, { recursive: true });
    await featurePage.screenshot({ path: join(output, 'feature-graphic-1024x500.jpg'), type: 'jpeg', quality: 94, fullPage: false });
  }
  await featureContext.close();
} finally {
  await browser.close();
  await new Promise(resolveServer => server.close(resolveServer));
}

const playIconDir = join(assetsRoot, 'google-play', 'shared');
await mkdir(playIconDir, { recursive: true });
execFileSync('sips', ['-z', '512', '512', originalIcon, '--out', join(playIconDir, 'app-icon-512.png')], { stdio: 'ignore' });

console.log(`商店素材完成：${captured} 張 App 截圖、3 張 Google feature graphic、1 張沿用軌島的 Play icon。`);
