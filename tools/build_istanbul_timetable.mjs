#!/usr/bin/env node
// 伊斯坦堡官方時刻表建置器：Metro İstanbul 18 條線改用官方班次，其餘維持合成班距。
//
// 來源：Metro İstanbul 手機 App 的公開 API（api.ibb.gov.tr/MetroIstanbul/api/MetroMobile/V2，不需金鑰）。
//   GetLines／GetStations／GetDirectionById 取路線、站序與方向；
//   GetTimeTable（POST，給站、線、方向與時間）回傳該時刻起一小時內的發車時刻。
// 伊斯坦堡市開放資料平台的「Public Transport GTFS」服務期只到 2024-12-31、缺 M11／T5 與 2024 年後的延伸，
// 所以不用；metro.istanbul 網站的逐站時刻端點有防自動化檢查，也不用。
//
// 重建：
//   1. 每條線、每個方向的起點站逐小時查全天（04:00～隔日 00:00），得到全天發車時刻。
//   2. 其餘各站查 08:00、14:00 兩個時段，比對相鄰兩站的發車時刻推出站間時間（含停站）：
//      班距固定時差一個班距也對得上，所以在命中數接近最高的候選裡取最接近距離推估的值；
//      只有兩站的往返線兩端同時發車，直接用距離推估。
//   3. 每班從起點出發，依累計站間時間排到各站。中途站在樣本時段的班次若明顯多於推算經過的班次，
//      代表有中途起駛的區間車，列入報告（目前直接沿用起點班次，不另造區間車）。
// 服務日取 2026-10-07（星期三）。時刻精度是分鐘。
//
// 不在這組 API 的路線（M11、T2、T6、F2、F3、Marmaray、B2）沿用原本的合成班距並標 estimated。
//
// 用法：node tools/build_istanbul_timetable.mjs [--offline] [--synthetic-from path]
// 網路請求需要 NODE_USE_ENV_PROXY=1（雲端環境）。快取：.cache/ibb/tt

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = path.join(ROOT, '.cache/ibb/tt');
const API = 'https://api.ibb.gov.tr/MetroIstanbul/api/MetroMobile/V2';
const SERVICE_DATE = '2026-10-07';
const TRACK_FILE = path.join(ROOT, 'data/istanbul.json');
const SCHEDULE_FILE = path.join(ROOT, 'data/istanbul_schedule_dense.json');
const OFFLINE = process.argv.includes('--offline');
const SYNTHETIC_SOURCE = process.argv.includes('--synthetic-from') ? process.argv[process.argv.indexOf('--synthetic-from') + 1] : SCHEDULE_FILE;
const SAMPLE_HOURS = [8, 14];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function api(apiPath, body, file) {
  await mkdir(CACHE, { recursive: true });
  const cacheFile = path.join(CACHE, file);
  if (existsSync(cacheFile)) return JSON.parse(await readFile(cacheFile, 'utf8'));
  if (OFFLINE) throw new Error(`離線模式缺少快取：${cacheFile}`);
  for (let attempt = 0; attempt < 5; attempt++) {
    const response = await fetch(`${API}/${apiPath}`, {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'RailIslandWorld/1.0 (timetable builder; github.com/siriushsu/railisland-world)' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (response.ok) {
      const json = await response.json();
      await writeFile(cacheFile, JSON.stringify(json));
      await sleep(250);
      return json;
    }
    await sleep(2000 * (attempt + 1));
  }
  throw new Error(`Metro İstanbul ${apiPath} 失敗`);
}
const timetable = (lineId, directionId, stationId, hour) => api('GetTimeTable', {
  BoardingStationId: stationId, LineId: lineId, Language: 'tr', DirectionId: directionId,
  DateTime: hour < 24 ? `${SERVICE_DATE}T${String(hour).padStart(2, '0')}:00:00` : '2026-10-08T00:00:00',
}, `${lineId}_${directionId}_${stationId}_${String(hour).padStart(2, '0')}.json`);

// 'HH:MM' → 分鐘；查詢時段跨過午夜時，00:xx 算隔天
function minutes(times, hour) {
  return times.map(s => { const [h, m] = s.split(':').map(Number); let v = h * 60 + m; if (v < hour * 60 - 60) v += 1440; return v; });
}
const norm = s => String(s || '').toLocaleLowerCase('tr').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i').replace(/[^a-z0-9]/g, '');
const median = xs => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };
const r5 = x => Math.round(x * 1e5) / 1e5;

const track = JSON.parse(await readFile(TRACK_FILE, 'utf8'));
const previous = JSON.parse(await readFile(SYNTHETIC_SOURCE, 'utf8'));
const lines = (await api('GetLines', null, 'lines.json')).Data;
const apiStations = (await api('GetStations', null, 'stations.json')).Data;
const typeOf = new Map(previous.trains.map(t => [t.carName, t.typeName]));

const trains = [], report = [], counters = new Map();
// 站名模糊比對：完全相同 → 互相包含 → 共同字首最長（例如 Sabiha Gökçen ↔ Sabiha Gökçen Havalimanı、
// Kirazlı ↔ Kirazlı-Bağcılar、İskele Cami ↔ İskele Camii）
function nameScore(a, b) {
  const x = norm(a), y = norm(b);
  if (!x || !y) return 0;
  if (x === y) return 1000;
  if (x.includes(y) || y.includes(x)) return 500 + Math.min(x.length, y.length);
  let k = 0; while (k < x.length && k < y.length && x[k] === y[k]) k++;
  const tokens = s => new Set(String(s).toLocaleLowerCase('tr').split(/[^\p{L}\p{N}]+/u).filter(t => t.length > 2).map(norm));
  const ta = tokens(a), tb = tokens(b), shared = [...ta].filter(t => tb.has(t)).length;
  return shared ? 100 * shared + k : (k >= 5 ? k : 0);
}
// 相鄰兩站的時間差：試 0.5～15 分，算每個差值能讓兩站幾班對上（±0.5 分）。
// 班距固定時好幾個差值都對得上（差一個班距），所以在命中數接近最高的候選裡取最接近距離推估的值。
function bestDelta(prev, next, estimate) {
  const scored = [];
  for (let d = 0.5; d <= 15; d += 0.5) {
    let hits = 0;
    for (const t of prev) if (next.some(u => Math.abs(u - t - d) <= 0.5)) hits++;
    scored.push({ d, hits });
  }
  const max = Math.max(...scored.map(s => s.hits));
  if (max < Math.max(2, prev.length * 0.5)) return null;
  const close = scored.filter(s => s.hits >= max * 0.8);
  close.sort((a, b) => Math.abs(a.d - estimate) - Math.abs(b.d - estimate) || b.hits - a.hits);
  return close[0].d;
}

for (const line of lines) {
  const candidates = track.lines.filter(l => l.id === line.Name || l.id.startsWith(line.Name));
  if (!candidates.length) { report.push({ line: line.Name, skipped: '世界版路網沒有這條線' }); continue; }
  const directions = (await api(`GetDirectionById/${line.Id}`, null, `dir_${line.Id}.json`)).Data;
  const stops = apiStations.filter(s => s.LineId === line.Id);
  for (const direction of directions) {
    const [fromName, toName] = direction.DirectionName.split('->').map(x => x.trim());
    // 世界版路徑：兩端都對得上的最短路徑（M2 的 Sanayi Mahallesi–Seyrantepe 落在 M2A）
    let world = null, fromW = null, toW = null;
    for (const cand of candidates) {
      const pick = name => cand.stations.reduce((b, w) => { const sc = nameScore(name, w.name); return sc > (b?.sc || 0) ? { w, sc } : b; }, null);
      const f = pick(fromName), t = pick(toName);
      if (f && t && f.w !== t.w && (!world || cand.stations.length < world.stations.length)) { world = cand; fromW = f.w; toW = t.w; }
    }
    if (!world) { report.push({ line: line.Name, direction: direction.DirectionName, skipped: '起訖站對不上世界版路徑' }); continue; }
    // API 站 → 世界版站（名稱；對不上就取 400 m 內最近的站）
    const toWorld = new Map();
    for (const st of stops) {
      let hit = world.stations.reduce((b, w) => { const sc = nameScore(st.Description, w.name); return sc >= 500 && sc > (b?.sc || 0) ? { w, sc } : b; }, null)?.w;
      if (!hit) {
        const lat = Number(st.DetailInfo?.Latitude), lon = Number(st.DetailInfo?.Longitude);
        let best = null;
        for (const w of world.stations) { const d = Math.hypot((w.lat - lat) * 111, (w.lon - lon) * 84); if (!best || d < best.d) best = { w, d }; }
        if (best && best.d < 0.4) hit = best.w;
      }
      if (hit) toWorld.set(st.Id, hit);
    }
    const loop = world.oneWay;
    const lo = Math.min(fromW.d, toW.d), hi = Math.max(fromW.d, toW.d);
    let order = stops.filter(st => toWorld.has(st.Id) && (loop || (toWorld.get(st.Id).d >= lo - 1e-6 && toWorld.get(st.Id).d <= hi + 1e-6)))
      .sort((a, b) => toWorld.get(a.Id).d - toWorld.get(b.Id).d);
    if (!loop && fromW.d > toW.d) order = order.reverse();
    if (loop) { const k = order.findIndex(st => toWorld.get(st.Id) === fromW); if (k > 0) order = [...order.slice(k), ...order.slice(0, k)]; }
    if (order.length < 2) { report.push({ line: line.Name, direction: direction.DirectionName, skipped: '站序不足兩站' }); continue; }
    // 1. 起點全天
    const originTimes = new Set();
    for (let hour = 4; hour <= 24; hour++) {
      const doc = await timetable(line.Id, direction.DirectionId, order[0].Id, hour);
      for (const row of doc.Data || []) for (const t of minutes(row.TimeInfos?.Times || [], hour)) originTimes.add(t);
    }
    const departures = [...originTimes].sort((a, b) => a - b);
    // 2. 站間時間（含停站）
    const samples = [];
    for (const st of order) {
      const set = new Set();
      for (const hour of SAMPLE_HOURS) {
        const doc = await timetable(line.Id, direction.DirectionId, st.Id, hour);
        for (const row of doc.Data || []) for (const t of minutes(row.TimeInfos?.Times || [], hour)) set.add(t);
      }
      samples.push([...set].sort((a, b) => a - b));
    }
    const offsets = [0], fallbacks = [];
    const kmh = { metro: 32, tram: 16, funicular: 20, cable: 6 }[world.mode] || 30;
    for (let i = 1; i < order.length; i++) {
      const km = Math.abs(toWorld.get(order[i].Id).d - toWorld.get(order[i - 1].Id).d) || Math.abs(world.shapeLen - toWorld.get(order[i - 1].Id).d);
      const estimate = Math.max(1, Math.round(km / kmh * 60));
      // 只有兩站的往返線（纜索、空中纜車）兩端同時發車，比對不出站間時間，直接用距離推估
      let d = order.length === 2 ? null : bestDelta(samples[i - 1], samples[i], estimate);
      // 速度合理範圍：站間平均 8～90 km/h（纜車另計）；超出就改用距離推估
      const speed = d ? km / (d / 60) : null;
      if (d == null || (world.mode !== 'cable' && (speed < 8 || speed > 90))) { d = estimate; fallbacks.push(order[i].Description); }
      offsets.push(offsets[i - 1] + d);
    }
    // 3. 中途起駛檢查
    const extra = [];
    for (let i = 1; i < order.length; i++) {
      const predicted = departures.filter(t => t + offsets[i] >= 8 * 60 && t + offsets[i] <= 9 * 60).length;
      const listed = samples[i].filter(t => t >= 8 * 60 && t <= 9 * 60).length;
      if (listed > predicted + 1) extra.push(`${order[i].Description} ${listed}>${predicted}`);
    }
    const mark = world.oneWay ? '→' : (fromW.d <= toW.d ? '↓' : '↑');
    for (const t0 of departures) {
      const trainStops = order.map((st, i) => {
        const w = toWorld.get(st.Id), arrSec = Math.round((t0 + offsets[i]) * 60);
        return { name: w.name, lat: r5(w.lat), lon: r5(w.lon), arrSec, depSec: i === order.length - 1 ? arrSec : arrSec + 25 };
      });
      for (let i = 1; i < trainStops.length; i++) if (trainStops[i].arrSec <= trainStops[i - 1].depSec) { trainStops[i].arrSec = trainStops[i - 1].depSec + 20; trainStops[i].depSec = Math.max(trainStops[i].depSec, trainStops[i].arrSec); }
      if (loop && trainStops.at(-1).name !== trainStops[0].name) {
        const first = trainStops[0], last = trainStops.at(-1);
        const back = Math.max(60, Math.round(Math.abs(world.shapeLen - toWorld.get(order.at(-1).Id).d) / kmh * 3600));
        trainStops.push({ ...first, arrSec: last.depSec + back, depSec: last.depSec + back });
      }
      const key = `${world.id}${mark}`;
      counters.set(key, (counters.get(key) || 0) + 1);
      trains.push({ train: `${key}${String(counters.get(key)).padStart(3, '0')}`, typeName: typeOf.get(world.name) || `${world.id} 地鐵`, carName: world.name, color: world.color, stops: trainStops });
    }
    report.push({ line: line.Name, world: world.id, direction: direction.DirectionName, stations: order.length, worldStations: world.stations.length, trains: departures.length, runMin: offsets.at(-1), fallbacks, midLineStarts: extra });
  }
}
// 不在 Metro İstanbul API 的路線沿用合成班距
const realIds = new Set(trains.map(t => t.carName));
const carried = previous.trains.filter(t => !realIds.has(t.carName)).map(t => ({ ...t, estimated: true }));
const syntheticLines = [...new Set(carried.map(t => t.carName.split(' · ')[0]))];
const output = {
  ...previous,
  date: SERVICE_DATE.replaceAll('-', ''),
  source_notes: `Metro İstanbul 18 條線（${[...new Set(trains.map(t => t.carName.split(' · ')[0]))].join('、')}）依 Metro İstanbul 公開 API（api.ibb.gov.tr/MetroIstanbul，GetTimeTable）${SERVICE_DATE}（星期三）的官方發車時刻：起點站全天逐小時查詢，站間時間由 08 時與 14 時各站發車時刻比對推得，時刻精度為分鐘，不含中途起駛的區間車。其餘 ${syntheticLines.join('、')} 不在這組 API，沿用班距模擬合成（班次標 estimated）。2026-08-31 已依 Metro İstanbul、UAB、TCDD 與 IETT 官方現行資料逐線核對路網；細部線形採 OpenStreetMap route relations（© OpenStreetMap contributors，ODbL）。這是表定時刻，不是即時位置，臨時停駛與改點請以官方公告為準。`,
  trains: [...trains, ...carried].sort((a, b) => a.stops[0].depSec - b.stops[0].depSec),
};
await writeFile(SCHEDULE_FILE, JSON.stringify(output));
await writeFile(path.join(CACHE, '..', 'build-report.json'), JSON.stringify(report, null, 1));
for (const r of report) console.log(r.skipped ? `- ${r.line} ${r.direction || ''} 略過：${r.skipped}` : `${r.line.padEnd(4)} ${(r.world || '').padEnd(4)} ${r.direction.padEnd(42)} ${String(r.stations).padStart(2)}/${r.worldStations} 站 ${String(r.trains).padStart(4)} 班 全程 ${r.runMin} 分${r.fallbacks?.length ? '  距離推估：' + r.fallbacks.length + ' 段' : ''}${r.midLineStarts.length ? '  中途起駛？' + r.midLineStarts.join('、') : ''}`);
console.log(`✓ 伊斯坦堡班表：官方 ${trains.length} 班＋合成 ${carried.length} 班（${syntheticLines.join('、')}）`);
