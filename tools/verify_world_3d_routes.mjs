#!/usr/bin/env node
// 立體列車用 capture() 給每輛車的 route 線形擺車廂；位置離那條線形超過 3 公尺就退回示意
// （rail-3d/integration/map3d.js 的 routeProfile）。位置是沿 trainSeg 那一段的線形算的：世界版的路段
// 優先貼列車自己的路線，自己的路線涵蓋不到的路段才貼別條線（例：紐約 2 線部分班次經 Eastern Pkwy
// 開往 New Lots Av，路線資料只有往 Flatbush Av 的線形）。
// 每個城市取「路段不在自己路線上」的全部路段，加上每條路線平均 4 班的一般路段當對照；時鐘撥到該段
// 中點、跟隨那班車、呼叫 capture()，檢查：
//   1. 位置離 3D 線形 ≤ 3 公尺；
//   2. routeId（決定車型與節數）仍是列車自己的路線；
//   3. 對照組的 3D 線形仍是自己的路線，且每條路線都有對照；
//   4. 每班車都找得到自己的路線（找不到的班次上面三項都沒檢查到）。
// 這裡驗的是 3D 線形與 2D 位置一致；2D 路段有沒有貼對軌道（依站名配對，可能配到別條線的同名站）不在這裡驗。
// 用法：node tools/verify_world_3d_routes.mjs [網址] [城市,城市]（預設有立體車型的紐約、東京）
const baseUrl = process.argv[2] || 'http://127.0.0.1:5188/';
const cities = (process.argv[3] || 'nyc_sched,tokyo_sched').split(',');
const playwrightModule = process.env.RAIL_WORLD_PLAYWRIGHT || 'playwright';
const { chromium } = await import(playwrightModule);
const failures = [];

const browser = await chromium.launch({ headless: true });
for (const city of cities) {
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 }, locale: 'zh-TW' });
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.stack || String(error)));
  await page.addInitScript(() => { try { localStorage.setItem('trainmap-howto-seen', '1'); } catch {} });
  await page.goto(new URL(`?lang=zh-TW&city=${city}&scene=2d`, baseUrl).href, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector(`html[data-active-system="${city}"][data-world-ready="1"]`, { timeout: 90000 });
  const result = await page.evaluate(() => {
    const MAX_M = 3; // 與 map3d.js routeProfile 的退回門檻相同
    // 點到折線（[經度, 緯度]）的最短距離，公尺；局部平面近似，與 3D 的 locate 各自獨立計算
    const distanceM = (coords, lon, lat) => {
      const kx = Math.cos(lat * Math.PI / 180) * 111320, ky = 110574;
      let best = Infinity;
      for (let i = 0; i < coords.length - 1; i++) {
        const ax = (coords[i][0] - lon) * kx, ay = (coords[i][1] - lat) * ky;
        const vx = (coords[i + 1][0] - coords[i][0]) * kx, vy = (coords[i + 1][1] - coords[i][1]) * ky, l2 = vx * vx + vy * vy;
        const t = l2 > 0 ? Math.max(0, Math.min(1, -(ax * vx + ay * vy) / l2)) : 0;
        best = Math.min(best, Math.hypot(ax + vx * t, ay + vy * t));
      }
      return best;
    };
    if (state.playing) togglePlay();
    const trips = state.trains.filter(tr => worldSchedSystemOf(tr));
    const samples = [], ownSegments = new Map();
    let withoutOwn = 0, bridged = 0;
    for (const tr of trips) {
      const own = worldTrainLine(tr);
      if (!own) { withoutOwn++; continue; }
      const segments = tr.stops.slice(0, -1).map((st, i) => ({ st, i })).filter(({ st, i }) => st.segLn && tr.stops[i + 1].arrSec > st.depSec);
      for (const { st, i } of segments) {
        if (st.segLn === own) continue;
        // 跨線接續段的尾端走兩條線形之間的直線，不在任何一條線形上；中點可能落在那裡，不取
        if (st.bridgeKm) bridged++; else samples.push({ tr, own, i, kind: 'off' });
      }
      const mine = segments.filter(({ st }) => st.segLn === own && !st.bridgeKm);
      if (mine.length) (ownSegments.get(tr.carName) || ownSegments.set(tr.carName, []).get(tr.carName)).push({ tr, own, i: mine[mine.length >> 1].i });
    }
    for (const list of ownSegments.values()) {
      const n = Math.min(4, list.length);
      for (let k = 0; k < n; k++) samples.push({ ...list[Math.floor(k * list.length / n)], kind: 'own' });
    }
    const routes = new Set(trips.filter(tr => worldTrainLine(tr)).map(tr => tr.carName));
    const fails = [...routes].filter(route => !ownSegments.has(route)).map(route => `路線 ${route} 沒有一般路段可當對照`);
    if (!trips.length) fails.push('沒有世界版班次');
    if (withoutOwn) fails.push(`${withoutOwn} 班找不到自己的路線，沒有檢查到`);
    for (const sample of samples) {
      const from = sample.tr.stops[sample.i], to = sample.tr.stops[sample.i + 1];
      const where = `${sample.tr.train} ${from.name}→${to.name}`;
      setSimSec((from.depSec + to.arrSec) / 2);
      state.followTrain = sample.tr;
      const vehicle = railIslandIntegration.capture().vehicles.find(v => v.followed);
      if (!vehicle?.route?.coordinates?.length) { fails.push(`${where}：沒有車輛或線形`); continue; }
      const gap = distanceM(vehicle.route.coordinates, vehicle.longitude, vehicle.latitude);
      if (!(gap <= MAX_M)) fails.push(`${where}：位置離 3D 線形（${vehicle.route.routeId}）${gap.toFixed(1)} m`);
      if (vehicle.routeId !== String(sample.own.id)) fails.push(`${where}：編組依 ${vehicle.routeId}，應依自己的路線 ${sample.own.id}`);
      if (sample.kind === 'own' && vehicle.route.routeId !== String(sample.own.id)) fails.push(`${where}：一般路段的 3D 線形變成 ${vehicle.route.routeId}`);
    }
    state.followTrain = null;
    return {
      trips: trips.length, withoutOwn, bridged, routes: routes.size,
      off: samples.filter(s => s.kind === 'off').length, own: samples.filter(s => s.kind === 'own').length, fails,
    };
  });
  for (const message of result.fails) failures.push(`${city}: ${message}`);
  if (pageErrors.length) failures.push(`${city}: pageerror：${pageErrors.join(' | ')}`);
  const bad = result.fails.length ? `，✗ ${result.fails.length} 項` : '';
  console.log(`${result.fails.length ? '✗' : '✓'} ${city}: ${result.trips} 班、${result.routes} 條路線；` +
    `不在自己路線上的路段 ${result.off} 段（跨線接續段 ${result.bridged} 段不取）、對照 ${result.own} 段` +
    `${result.withoutOwn ? `、${result.withoutOwn} 班找不到自己的路線` : ''}${bad}`);
  await page.close();
}
await browser.close();

if (failures.length) {
  console.error(failures.slice(0, 40).join('\n') + (failures.length > 40 ? `\n…另 ${failures.length - 40} 項` : ''));
  process.exit(1);
}
console.log('✓ 立體列車的線形與列車位置一致');
