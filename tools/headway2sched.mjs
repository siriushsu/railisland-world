#!/usr/bin/env node
// headway → schedule_dense 合成器（新加坡／倫敦／伊斯坦堡）。
//
// 動機:軌島「世界」群組是 sched 引擎(state.trains[] + trainPos + 多時區同框 +
// 聚焦城市時鐘/成就池/跟隨),東京/瑞士/挪威/紐約都是 sched。新加坡/倫敦原始資料是
// headway/freq 型(lines[].peakHeadwaySec/offpeakHeadwaySec,無逐車時刻表)。為了讓兩城
// 成為「世界」群組的一等公民而「零引擎修改」,本腳本把 headway 型幾何檔合成成 sched 型
// 逐車班表(schedule_dense),於是 index.html 只需在 defs 加一筆(url=合成班表, track=幾何檔,
// tz),完全比照 norway/nyc,不動任何動畫/聚焦/成就邏輯。
//
// 合成規則:
//  - 營運時間 05:30–00:30(次日),雙向(fwd = stations 原序、rev = 反轉)。
//  - 班距:尖峰窗(07:00–09:30、17:00–19:30)用 peakHeadwaySec,其餘用 offpeakHeadwaySec。
//  - 站間行駛時間 = (d[i+1]-d[i]) / cruiseKmh * 3600;每站停靠 dwellSec。
//  - 跨午夜:depSec 直接 > 86400(不 wrap),與 tra/norway 慣例一致,由 trainPos() 處理。
//  - stops[].name 與幾何檔 stations[].name 逐字一致 → assignSchedShapePathsFor() 依站名把
//    每個 stop 貼回該線真實 shape 弧長,列車沿真實軌跡跑(與 sched 系統相同機制)。
//  - typeName:折疊到「顯示線」(倫敦各分支 → 母線名;新加坡支線 → 母線名),作為車種篩選
//    chip 的 key(=chip 文字),跨六城不撞名。color 用官方線色(逐車保留自己的分支色)。
//
// ⚠️ 合成班表為「班距模擬」,非官方逐車時刻;source_notes 明確標註。
//
// 用法:node tools/headway2sched.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'data');

// 營運窗(當地當日秒數):05:30 → 24:30(=次日 00:30)
const OP_START = 5.5 * 3600;      // 19800
const OP_END = 24.5 * 3600;       // 88200
// 尖峰窗(當地當日秒數):早 07:00–09:30、晚 17:00–19:30
const PEAKS = [[7 * 3600, 9.5 * 3600], [17 * 3600, 19.5 * 3600]];
const isPeak = (s) => PEAKS.some(([a, b]) => s >= a && s < b);

// 折疊規則:把幾何檔的 line.id 映到「顯示線」typeName + 官方色。分支併入母線。
function foldSingapore(lineId) {
  const M = {
    NSL: ['南北線', '#d42e12'], EWL: ['東西線', '#009645'], EWL_CGA: ['東西線', '#009645'],
    NEL: ['東北線', '#9900aa'], CCL: ['環線', '#fa9e0d'], CCL_DG: ['環線', '#fa9e0d'],
    DTL: ['濱海市區線', '#005ec4'], TEL: ['湯申-東海岸線', '#9D5B25'],
    BPLRT: ['武吉班讓輕軌', '#748477'],
    SKLRT_E: ['盛港輕軌', '#748477'], SKLRT_W: ['盛港輕軌', '#748477'],
    PGLRT_E: ['榜鵝輕軌', '#748477'], PGLRT_W: ['榜鵝輕軌', '#748477'],
  };
  return M[lineId] || [lineId, '#888888'];
}
function foldLondon(lineId) {
  const base = lineId.split('-')[0];
  const M = {
    bakerloo: ['貝克盧線', '#B26300'], central: ['中央線', '#DC241F'],
    circle: ['環線', '#FFC80A'], district: ['區域線', '#007D32'],
    hammersmith: ['漢默史密斯及城市線', '#F589A6'], jubilee: ['銀禧線', '#838D93'],
    metropolitan: ['大都會線', '#9B0058'], northern: ['北線', '#000000'],
    piccadilly: ['皮卡迪利線', '#0019A8'], victoria: ['維多利亞線', '#039BE5'],
    waterloo: ['滑鐵盧及城市線', '#76D0BD'], dlr: ['碼頭區輕便鐵路 DLR', '#00A4A7'],
    elizabeth: ['伊利沙伯線', '#6950A1'], tram: ['倫敦電車', '#84B817'],
    liberty: ['London Overground・Liberty 線', '#5D6061'],
    lioness: ['London Overground・Lioness 線', '#F4A900'],
    mildmay: ['London Overground・Mildmay 線', '#0072CE'],
    windrush: ['London Overground・Windrush 線', '#DC241F'],
    weaver: ['London Overground・Weaver 線', '#9B0058'],
    suffragette: ['London Overground・Suffragette 線', '#18A558'],
  };
  return M[base] || [lineId, '#888888'];
}
function foldIstanbul(lineId, line) {
  if (line.mode === 'metro') return [`${lineId} 地鐵`, line.color];
  if (line.mode === 'tram') return [`${lineId} 電車`, line.color];
  if (line.mode === 'funicular') return [`${lineId} 纜索鐵路`, line.color];
  if (line.mode === 'cable') return [`${lineId} 纜車`, line.color];
  if (lineId === 'Marmaray') return ['Marmaray 通勤鐵路', line.color];
  if (lineId === 'B2') return ['Halkalı–Bahçeşehir 通勤鐵路', line.color];
  return [lineId, line.color];
}

const r5 = (x) => Math.round(x * 1e5) / 1e5;

// 從一條 line 生成一個方向的所有班次。stations 已按行進方向排好(rev 傳反轉後陣列)。
function genLine(line, foldFn, cruiseKmh, dwellSec, out, seqRef) {
  const [typeName, typeColor] = foldFn(line.id, line);
  const dirs = line.oneWay ? [{ tag: '→', sts: line.stations }] : [
    { tag: '↓', sts: line.stations },
    { tag: '↑', sts: [...line.stations].reverse() },
  ];
  for (const dir of dirs) {
    const sts = dir.sts;
    if (sts.length < 2) continue;
    // 站間行駛秒數(用相鄰 d 差;d 對 rev 而言遞減,取絕對值)
    const runSec = [];
    for (let i = 0; i < sts.length - 1; i++) {
      const gapKm = Math.abs(sts[i + 1].d - sts[i].d);
      runSec.push(Math.max(20, Math.round(gapKm / cruiseKmh * 3600)));
    }
    let t = OP_START, seq = 0;
    while (t <= OP_END) {
      seq++;
      const stops = [];
      let cur = t;
      for (let i = 0; i < sts.length; i++) {
        const st = sts[i];
        const arr = cur;
        // 頭尾站不停留 dwell 疊加以外的時間;中間站 dwell
        const dep = (i === sts.length - 1) ? arr : arr + dwellSec;
        // order 未被引擎消費、stop 缺省即視為停靠(引擎只查 stop !== false),兩者省略以縮小檔案
        stops.push({ name: st.name, lat: r5(st.lat), lon: r5(st.lon), arrSec: arr, depSec: dep });
        if (i < sts.length - 1) cur = dep + runSec[i];
      }
      out.push({
        train: `${line.id}${dir.tag}${String(seq).padStart(3, '0')}`,
        typeName, carName: line.name, color: line.color, stops,
      });
      // 下一班發車:依「當前發車時刻」落在尖/離峰決定班距
      const hw = isPeak(t) ? (line.peakHeadwaySec || 600) : (line.offpeakHeadwaySec || 900);
      t += Math.max(60, hw);
    }
  }
  seqRef.types.set(typeName, typeColor);
}

function build(cityFile, foldFn, cruiseKmh, dwellSec, system, srcNotes, outFile) {
  const geo = JSON.parse(readFileSync(path.join(DATA, cityFile), 'utf8'));
  const out = [];
  const seqRef = { types: new Map() };
  for (const line of geo.lines) genLine(line, foldFn, cruiseKmh, dwellSec, out, seqRef);
  const types = [...seqRef.types.entries()].map(([key, color]) => ({ key, color }));
  const doc = { system, date: geo.data_date || '20260715', source_notes: srcNotes, types, trains: out };
  writeFileSync(path.join(DATA, outFile), JSON.stringify(doc));
  // 統計
  let maxT = 0, stopRows = 0;
  for (const tr of out) { stopRows += tr.stops.length; for (const s of tr.stops) if (s.depSec > maxT) maxT = s.depSec; }
  const bytes = readFileSync(path.join(DATA, outFile)).length;
  console.log(`${outFile}: ${out.length} 車次, ${types.length} 車種, ${stopRows} 停靠列, maxDep=${maxT}(${(maxT / 3600).toFixed(1)}h), ${(bytes / 1e6).toFixed(2)}MB`);
  console.log(`  車種: ${types.map(t => t.key).join(', ')}`);
}

const target = process.argv[2] || 'all';
if (target === 'all' || target === 'singapore') {
  build(
    'singapore.json', foldSingapore, 48, 25, 'SGMRT',
    '班距模擬合成，非官方逐車時刻或即時位置。現行路線範圍依 LTA MRT/LRT Map（2026-08-31 查證）；' +
    'CCL6 與三套 LRT 的站序／線形採 OSM route relations（© OpenStreetMap contributors，ODbL）。' +
    '本班表由 tools/headway2sched.mjs 依 peak/offpeak 合成班距與營運時間（05:30–00:30）雙向生成，僅供流動示意。',
    'singapore_schedule_dense.json'
  );
}
// 倫敦自 2026-10-01 起改用 TfL 官方逐站時刻（tools/build_london_timetable.mjs），'all' 不再重建倫敦，
// 免得蓋掉真實班表。只有 Elizabeth line 與 Overground 沿用這裡的合成班次：要重建時先跑
// `node tools/headway2sched.mjs london` 產生合成檔，再跑 build_london_timetable.mjs --synthetic-from 該檔。
if (target === 'london') {
  build(
    'london.json', foldLondon, 42, 25, 'TFL',
    '班距模擬合成，非官方逐車時刻或即時位置。Powered by TfL Open Data（2026-08-31 現行線別、端點、via、站序與站點座標）；' +
    'Underground 細部線形沿用 OSM route relations（© OpenStreetMap contributors，ODbL）。' +
    '本班表依 peak/offpeak 合成班距與營運時間（05:30–00:30）生成；Tram 單向環按官方方向，其他路徑雙向，僅供流動示意。',
    'london_schedule_dense.json'
  );
}
if (target === 'all' || target === 'istanbul') {
  build(
    'istanbul.json', foldIstanbul, 42, 25, 'İSTANBUL RAIL',
    '班距模擬合成，非官方逐車時刻或即時位置。2026-08-31 已依 Metro İstanbul、UAB、TCDD 與 IETT 官方現行資料逐線核對 Metro、tram、funicular、Marmaray 與 Halkalı–Bahçeşehir；細部線形採 OpenStreetMap route relations（© OpenStreetMap contributors，ODbL）。T3 按單向環生成，其他路徑雙向；所有班次只供正確路網上的流動示意，臨時停駛與改點請以官方公告為準。',
    'istanbul_schedule_dense.json'
  );
}
if (!['all', 'singapore', 'london', 'istanbul'].includes(target)) {
  console.error('用法：node tools/headway2sched.mjs [all|singapore|london|istanbul]');
  process.exit(1);
}
