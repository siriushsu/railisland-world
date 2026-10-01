// 開發用：跟隨某條路線的一班車，切到 3D 傾斜視角並截圖，印出載入的模型數與退回原因。
// 用法：node tools/dev/check_3d.mjs <city> <路線或車次開頭> <輸出.png> [時刻 10:30] [zoom 19.6] [pitch 72] [bearing 偏移 60]
// 需要本機伺服器：python3 -m http.server 5188（在 repo 根目錄）；可用 BASE 環境變數改網址。
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:5188/';
const [,, city, route, out, t='10:30', zoom='19.6', pitch='72', bearOff='60'] = process.argv;
const b = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 800 }, locale: 'zh-TW' });
const errs=[]; p.on('pageerror', e => errs.push(String(e.stack||e).split('\n').slice(0,3).join(' | ')));
await p.addInitScript(() => { try { localStorage.setItem('trainmap-howto-seen','1'); } catch (e) {} });
await p.goto(`${BASE}?lang=zh-TW&city=${city}&scene=3d&z=17&t=${t}`);
await p.waitForSelector(`html[data-active-system="${city}"][data-world-ready="1"]`, { timeout: 60000 });
await p.waitForTimeout(1500);
const r = await p.evaluate((route) => {
  const tr = state.trains.find(t => (t.carName === route || t.train.startsWith(route)) && trainPos(t, state.simSec) && t.stops.length > 6 && !t.estimatedSkip);
  if (!tr) return 'no train'; setFollow(tr, true); state.playing=false; return trainDisplayNo(tr) + ' ' + tr.train;
}, route);
await p.waitForTimeout(4000);
await p.evaluate(({zoom,pitch,bearOff}) => { document.querySelectorAll('.toast').forEach(t=>t.remove());
  const st=window.railIslandIntegration?.renderer?.stats; M.raw.setZoom(+zoom); M.raw.setPitch(+pitch); M.raw.setBearing(M.raw.getBearing()+(+bearOff)); }, {zoom,pitch,bearOff});
await p.waitForTimeout(4000);
const info = await p.evaluate(() => ({ pitch: +M.raw.getPitch().toFixed(1), zoom: +M.raw.getZoom().toFixed(2), bearing:+M.raw.getBearing().toFixed(0), models: window.railIslandIntegration?.renderer?.stats?.models, fallbacks: (window.railIslandIntegration?.renderer?.stats?.modelFallbacks||[]).slice(0,3) }));
console.log(r, JSON.stringify(info));
console.log(errs.join('\n'));
await p.screenshot({ path: out, timeout: 120000 });
await b.close();
