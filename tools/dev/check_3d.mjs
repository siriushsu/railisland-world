// 開發用：跟隨某條路線的一班車，切到 3D 傾斜視角並截圖，印出載入的模型數與退回原因。
// 用法：node tools/dev/check_3d.mjs <city> <路線或車次開頭> <輸出.png> [時刻 10:30] [zoom 19.6] [pitch 72] [bearing 偏移 60]
// 需要本機伺服器：python3 -m http.server 5188（在 repo 根目錄）；可用 BASE 環境變數改網址。
// 第二行是判定：MODELLED（擺好車廂）、FALLBACK <原因>（退回示意）、INCONCLUSIVE（等不到跟隨車的結果、找不到車次、或資料 frame 停住）、FLAKY（兩秒後再看一次結果不同，優先於 frame 停住）；頁面錯誤從第三行起印。
// 3D 模組沒載入時 fallbacks 一樣是空的，所以只認跟隨車出現在 poseSamples 或 modelFallbacks。exit：MODELLED 0、FALLBACK 2、INCONCLUSIVE 與 FLAKY 1。
// render 丟例外後 stats 會停在最後一次成功的那一幀，所以 3D 不在 active 狀態時不採信；跟隨車 id（sys:day:train:dep:arr）的 sys 與 train 也要對上這裡選的那班。
// tick 丟例外時 active 仍是 true、資料 frame 卻不再更新，所以複查時 frame.clock.wallEpochSec 再等 10 秒都沒前進也判 INCONCLUSIVE，附 frozen（原本的判定）與 tickErrors
// （頁面載入以來累計的前 5 筆；空的代表不是 tick 例外，例如每幀太慢或頁面被隱藏）。
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
const want = await p.evaluate((route) => {
  const tr = state.trains.find(t => (t.carName === route || t.train.startsWith(route)) && trainPos(t, state.simSec) && t.stops.length > 6 && !t.estimatedSkip);
  if (!tr) return null; setFollow(tr, true); state.playing=false; return { label: trainDisplayNo(tr) + ' ' + tr.train, sys: tr.sys, train: tr.train };
}, route);
const r = want ? want.label : 'no train';
await p.waitForTimeout(4000);
await p.evaluate(({zoom,pitch,bearOff}) => { document.querySelectorAll('.toast').forEach(t=>t.remove());
  const st=window.railIslandIntegration?.renderer?.stats; M.raw.setZoom(+zoom); M.raw.setPitch(+pitch); M.raw.setBearing(M.raw.getBearing()+(+bearOff)); }, {zoom,pitch,bearOff});
await p.waitForTimeout(4000);
const evidence = (want) => { const ri = window.railIslandIntegration, id = ri?.frame?.selectedVehicleId, st = ri?.renderer?.stats;
  if (ri?.active !== true || !id) return null; const [sys,, train] = id.split(':'); if (sys !== want.sys || train !== want.train) return null;
  const pose = st?.poseSamples?.find(s => s.id === id), fb = st?.modelFallbacks?.find(f => f.id === id);
  return pose ? `MODELLED ${pose.modelId} ${pose.carCount} 節` : fb ? `FALLBACK ${fb.reason}` : null; };
const clock = () => window.railIslandIntegration?.frame?.clock?.wallEpochSec ?? null;
let verdict = !want ? null : await p.waitForFunction(evidence, want, { timeout: 30000, polling: 500 })
  .then(h => h.jsonValue(), e => { if (e.name === 'TimeoutError') return null; throw e; });
const info = await p.evaluate(() => ({ pitch: +M.raw.getPitch().toFixed(1), zoom: +M.raw.getZoom().toFixed(2), bearing:+M.raw.getBearing().toFixed(0), models: window.railIslandIntegration?.renderer?.stats?.models, fallbacks: (window.railIslandIntegration?.renderer?.stats?.modelFallbacks||[]).slice(0,3) }));
let line, frozen = null;
if (verdict) { const t0 = await p.evaluate(clock); await p.waitForTimeout(2000);
  const moved = await p.waitForFunction(t0 => (window.railIslandIntegration?.frame?.clock?.wallEpochSec ?? null) > t0, t0, { timeout: 10000, polling: 250 })
    .then(() => true, e => { if (e.name === 'TimeoutError') return false; throw e; });
  const again = await p.evaluate(evidence, want);
  if (again !== verdict) line = `FLAKY ${verdict} → ${again ?? 'INCONCLUSIVE'}`; else if (!moved) { frozen = verdict; verdict = null; } else line = verdict; }
if (!verdict) line = 'INCONCLUSIVE ' + JSON.stringify(await p.evaluate((frozen) => { const ri = window.railIslandIntegration;
  return { active: ri?.active ?? null, renderer: !!ri?.renderer, selected: ri?.frame?.selectedVehicleId ?? null, errors: (ri?.errors||[]).slice(0,3).map(e => String(e).split('\n').slice(0,3).join(' | ')),
    ...(frozen && { frozen, tickErrors: (state._tickErrs||[]).slice(0,3).map(e => String(e).split('\n').slice(0,3).join(' | ')) }) }; }, frozen));
console.log(r, JSON.stringify(info));
console.log(line);
console.log(errs.join('\n'));
await p.screenshot({ path: out, timeout: 120000 });
await b.close();
process.exitCode = line !== verdict ? 1 : verdict.startsWith('FALLBACK') ? 2 : 0;
