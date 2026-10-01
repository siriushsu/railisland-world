// 開發用：五個首發城市各開一次（指定語言），跟隨一班車、開一個站牌，截圖並列出頁面錯誤與 4xx/5xx 請求。
// 用法：node tools/dev/check_cities.mjs http://127.0.0.1:5188/ <輸出資料夾>
import { chromium } from 'playwright';
const [,, base, OUT] = process.argv;
const b = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const res = [];
for (const [city, lang] of [['tokyo_sched','ja'],['nyc_sched','en'],['london','zh-TW'],['istanbul_sched','en'],['singapore','zh-TW']]) {
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: lang });
  await p.route(u => !/127\.0\.0\.1/.test(u.href), r => r.abort());
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + (e.stack || e).toString().split('\n').slice(0,3).join(' | ')));
  p.on('response', r => { if (r.status() >= 400) errs.push(r.status()+' '+r.url().replace(base,'')); });
  await p.addInitScript(() => { try { localStorage.setItem('trainmap-howto-seen','1'); } catch (e) {} });
  await p.goto(`${base}?lang=${lang}&city=${city}`, { waitUntil: 'domcontentloaded' });
  await p.waitForSelector(`html[data-active-system="${city}"][data-world-ready="1"]`, { timeout: 60000 }).catch(() => errs.push('NOT READY'));
  await p.waitForTimeout(2000);
  const go = p.locator('#howtoGo'); if (await go.isVisible().catch(()=>false)) await go.tap();
  const r = await p.evaluate(() => {
    const out = { sys: state.sysId, trains: state.trains.length };
    const tr = state.trains.find(t => t.stops && t.stops.length > 5 && trainPos(t, state.simSec));
    if (tr) { setFollow(tr, true); out.follow = trainDisplayNo(tr); }
    return out;
  }).catch(e => ({ err: String(e) }));
  await p.waitForTimeout(2500);
  r.fp = await p.evaluate(() => { const fp = document.getElementById('followPanel'); return fp && !fp.hidden ? fp.innerText.replace(/\s+/g,' ').slice(0,140) : 'hidden'; });
  await p.screenshot({ path: `${OUT}/c-${city}-follow.png`, timeout: 90000 });
  r.board = await p.evaluate(() => { clearFollow && clearFollow(); const st = state.schedStations.find(s => s.tier === 1) || state.schedStations[0]; openBoard(st); const el = document.getElementById('board'); return el && !el.hidden ? el.innerText.replace(/\s+/g,' ').slice(0,200) : 'hidden'; }).catch(e => 'ERR ' + e);
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${OUT}/c-${city}-board.png`, timeout: 90000 });
  res.push({ city, lang, ...r, errs: [...new Set(errs)].slice(0, 8) });
  await p.close();
}
console.log(JSON.stringify(res, null, 1));
await b.close();
