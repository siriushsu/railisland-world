#!/usr/bin/env node
// 2D 列車沿 assignSchedShapePathsFor 貼好的路段走：相鄰兩站一段，記在 stops[i] 的 segLn（線形）與 dA、dB
// （兩站在那條線形上的里程）；停站時畫在 dA／dB，行進時沿兩者之間的線形內插。路段若配到別條線的同名站，
// 列車就畫在幾百公尺到幾公里外的軌道上，3D 也照這個位置擺車廂。
// 這支檢查每個世界城市的每一段：
//   1. 線形上的兩端離時刻表站點座標都 ≤ 150 公尺。線形位置在這裡用 ln.shape 重算，不呼叫頁面的
//      posAlongShape／ln.cum，算法有錯也抓得到。
//   2. 正向對照：拿已通過的路段，換上另一段「兩站都離它 2 公里以上」的路段的線形與里程。那一段的兩端
//      各在自己的站 150 公尺內，所以換過來的兩端一定離本段的站 1.85 公里以上，第 1 項必須全部判失敗。
//   3. 覆蓋率：每個城市都要有班次與路段；沒貼線形的路段（兩站之間畫直線）不准有任何一條線形同時經過
//      兩站 150 公尺內，免得「改成直線」被當成通過。檢查的城市＝頁面上全部的世界城市。
// 用法：node tools/verify_world_2d_routes.mjs [網址] [城市,城市]（預設全部世界城市）
const baseUrl = process.argv[2] || 'http://127.0.0.1:5188/';
const playwrightModule = process.env.RAIL_WORLD_PLAYWRIGHT || 'playwright';
const { chromium } = await import(playwrightModule);
const LIMIT_M = 150;
const failures = [];

const browser = await chromium.launch({ headless: true });
const open = async city => {
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 }, locale: 'zh-TW' });
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.stack || String(error)));
  await page.addInitScript(() => { try { localStorage.setItem('trainmap-howto-seen', '1'); } catch {} });
  await page.goto(new URL(`?lang=zh-TW${city ? `&city=${city}` : ''}&scene=2d`, baseUrl).href, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector(`html${city ? `[data-active-system="${city}"]` : ''}[data-world-ready="1"]`, { timeout: 120000 });
  return { page, pageErrors };
};

const first = await open(null);
const worldCities = await first.page.evaluate(() => SYS_DEFS.filter(sys => sys.world).map(sys => sys.id));
await first.page.close();
const cities = process.argv[3] ? process.argv[3].split(',') : worldCities;
if (!worldCities.length) failures.push('頁面上沒有世界城市');
for (const city of cities) if (!worldCities.includes(city)) failures.push(`${city} 不是頁面上的世界城市`);

for (const city of cities.filter(id => worldCities.includes(id))) {
  const { page, pageErrors } = await open(city);
  const result = await page.evaluate(({ LIMIT_M }) => {
    const MARGIN_M = 5;          // 覆蓋率判「線形經過兩站」時留的餘量，避免兩邊數值方法差幾公尺就互相打架
    const DONOR_M = 2000;        // 正向對照：借來的路段，兩站離本段兩站都要超過這個距離
    const rad = Math.PI / 180, R = 6371000;
    const distM = (a, b) => {
      const x = Math.sin((b.lat - a.lat) * rad / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin((b.lon - a.lon) * rad / 2) ** 2;
      return 2 * R * Math.asin(Math.sqrt(x));
    };
    const cumCache = new Map();
    const cumOf = ln => {
      let c = cumCache.get(ln);
      if (!c) {
        c = [0];
        for (let i = 1; i < ln.shape.length; i++)
          c.push(c[i - 1] + distM({ lat: ln.shape[i - 1][0], lon: ln.shape[i - 1][1] }, { lat: ln.shape[i][0], lon: ln.shape[i][1] }));
        cumCache.set(ln, c);
      }
      return c;
    };
    // 線形上里程 dKm（公里）的位置
    const pointAt = (ln, dKm) => {
      const sh = ln.shape, c = cumOf(ln), m = dKm * 1000, n = sh.length;
      if (!(m > 0)) return { lat: sh[0][0], lon: sh[0][1] };
      if (m >= c[n - 1]) return { lat: sh[n - 1][0], lon: sh[n - 1][1] };
      let lo = 0, hi = n - 1;
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (c[mid] <= m) lo = mid; else hi = mid; }
      const f = c[hi] > c[lo] ? (m - c[lo]) / (c[hi] - c[lo]) : 0;
      return { lat: sh[lo][0] + (sh[hi][0] - sh[lo][0]) * f, lon: sh[lo][1] + (sh[hi][1] - sh[lo][1]) * f };
    };
    // 點到線形的最短距離（公尺），局部平面近似
    const perpM = (ln, p) => {
      const ky = R * rad, kx = ky * Math.cos(p.lat * rad), sh = ln.shape;
      let best = Infinity;
      for (let i = 0; i < sh.length - 1; i++) {
        const ax = (sh[i][1] - p.lon) * kx, ay = (sh[i][0] - p.lat) * ky;
        const vx = (sh[i + 1][1] - sh[i][1]) * kx, vy = (sh[i + 1][0] - sh[i][0]) * ky, l2 = vx * vx + vy * vy;
        const t = l2 > 0 ? Math.max(0, Math.min(1, -(ax * vx + ay * vy) / l2)) : 0;
        best = Math.min(best, Math.hypot(ax + vx * t, ay + vy * t));
      }
      return best;
    };
    // 第 1 項：一段的兩端離站多遠；NaN（里程缺漏）也算失敗
    const ends = (from, to, ln, dA, dB) => {
      const ea = distM(pointAt(ln, dA), from), eb = distM(pointAt(ln, dB), to);
      return { ea, eb, ok: ea <= LIMIT_M && eb <= LIMIT_M };
    };

    const trips = state.trains.filter(tr => worldSchedSystemOf(tr));
    const lines = state.trackLines.filter(ln => ln.shape && ln.shape.length >= 2);
    const bad = new Map(), straight = [], good = [];
    let segments = 0, onShape = 0, badSegments = 0;
    for (const tr of trips) {
      const s = tr.stops;
      for (let i = 0; i + 1 < s.length; i++) {
        segments++;
        const st = s[i];
        if (!st.segLn) { straight.push({ tr, from: s[i], to: s[i + 1] }); continue; }
        onShape++;
        const r = ends(s[i], s[i + 1], st.segLn, st.dA, st.dB);
        if (r.ok) { good.push({ tr, from: s[i], to: s[i + 1], ln: st.segLn, dA: st.dA, dB: st.dB }); continue; }
        badSegments++;
        const key = `${s[i].name}→${s[i + 1].name}（線形 ${st.segLn.id}）`;
        const v = bad.get(key) || { key, n: 0, trains: [], maxM: 0 };
        v.n++; if (v.trains.length < 2) v.trains.push(tr.train);
        v.maxM = Math.max(v.maxM, Number.isFinite(r.ea) ? r.ea : Infinity, Number.isFinite(r.eb) ? r.eb : Infinity);
        bad.set(key, v);
      }
    }

    // 第 2 項：正向對照。受測段平均取自全部通過的路段；借用段從另一端開始找，兩站都離受測段兩站 2 公里以上
    const controls = [], missed = [];
    const want = Math.min(60, good.length);
    for (let k = 0; k < want; k++) {
      const rec = good[Math.floor(k * good.length / want)];
      let donor = null;
      for (let j = good.length - 1 - k; j >= 0 && !donor; j -= Math.max(1, Math.floor(good.length / 997))) {
        const g = good[j];
        if (Math.min(distM(g.from, rec.from), distM(g.from, rec.to), distM(g.to, rec.from), distM(g.to, rec.to)) > DONOR_M) donor = g;
      }
      if (!donor) continue;
      const r = ends(rec.from, rec.to, donor.ln, donor.dA, donor.dB);
      controls.push(rec);
      if (r.ok) missed.push(`${rec.tr.train} ${rec.from.name}→${rec.to.name} 換上 ${donor.tr.train} ${donor.from.name}→${donor.to.name}（線形 ${donor.ln.id}）沒被抓到`);
    }

    // 第 3 項：直線段不准有線形同時經過兩站
    const perpCache = new Map();
    const near = p => {
      const k = p.lat + ',' + p.lon;
      if (!perpCache.has(k)) perpCache.set(k, new Map(lines.map(ln => [ln, perpM(ln, p)])));
      return perpCache.get(k);
    };
    const coverable = new Map();
    for (const seg of straight) {
      const a = near(seg.from), b = near(seg.to);
      const hit = lines.find(ln => a.get(ln) <= LIMIT_M - MARGIN_M && b.get(ln) <= LIMIT_M - MARGIN_M);
      if (!hit) continue;
      const key = `${seg.from.name}→${seg.to.name}（線形 ${hit.id} 離兩站 ${a.get(hit).toFixed(0)}、${b.get(hit).toFixed(0)} m）`;
      const v = coverable.get(key) || { key, n: 0, trains: [] };
      v.n++; if (v.trains.length < 2) v.trains.push(seg.tr.train);
      coverable.set(key, v);
    }

    const fails = [];
    if (!trips.length) fails.push('沒有世界版班次');
    if (!segments) fails.push('沒有路段');
    for (const v of [...bad.values()].sort((a, b) => b.maxM - a.maxM))
      fails.push(`${v.key} 離站最遠 ${Number.isFinite(v.maxM) ? v.maxM.toFixed(0) + ' m' : '（里程缺漏）'}，${v.n} 段，例 ${v.trains.join('、')}`);
    if (good.length && !controls.length) fails.push('正向對照：找不到兩站相距 2 公里以上的路段可借用');
    fails.push(...missed.map(m => `正向對照：${m}`));
    for (const v of coverable.values()) fails.push(`沒貼線形但線形經過兩站：${v.key}，${v.n} 段，例 ${v.trains.join('、')}`);
    return { trips: trips.length, segments, onShape, straight: straight.length, badSegments, controls: controls.length,
      coverableSegments: [...coverable.values()].reduce((n, v) => n + v.n, 0), fails };
  }, { LIMIT_M });
  for (const message of result.fails) failures.push(`${city}: ${message}`);
  if (pageErrors.length) failures.push(`${city}: pageerror：${pageErrors.join(' | ')}`);
  console.log(`${result.fails.length || pageErrors.length ? '✗' : '✓'} ${city}: ${result.trips} 班、${result.segments} 段；` +
    `貼線形 ${result.onShape} 段（兩端超過 ${LIMIT_M} m：${result.badSegments} 段）、直線 ${result.straight} 段` +
    `（線形經過兩站卻是直線：${result.coverableSegments} 段）；正向對照 ${result.controls} 段`);
  await page.close();
}
await browser.close();

if (failures.length) {
  console.error(failures.slice(0, 60).join('\n') + (failures.length > 60 ? `\n…另 ${failures.length - 60} 項` : ''));
  process.exit(1);
}
console.log(`✓ 世界版 2D 路段兩端都在時刻表站點 ${LIMIT_M} 公尺內（${cities.length} 個城市）`);
