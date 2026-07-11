#!/usr/bin/env node
// 倫敦地鐵(Tube) 站點/拓撲/班距 建置腳本(第一階段:不含真實線形,shape 由
// build_london_shapes.py 接手用 OSM Overpass 補上,並計算 d)。
//
// 資料來源:
//  - 站序/分支拓撲:TfL Unified API(匿名) /Line/{id}/Route/Sequence/all
//    (2026-07-11 抓取,快取於 scratchpad/london/*_all.json)
//  - 缺漏的共構站點(如 Bank/King's Cross/Paddington 等,Route/Sequence 回應的
//    stations[] 未含):逐一 /StopPoint/{id} 補查,快取於 extra_stations.json
//  - 官方線路色:TfL Colour standard Issue 10(2025-05,content.tfl.gov.uk/
//    tfl-colour-standard.pdf),RGB 直接轉 hex
//  - 班距(peak/offpeak tph):Wikipedia 各線條目引用之 TfL 數據 + GLA Mayor's
//    Questions 頁面(逐線來源見下方 ENTRIES 註解與任務回報)
//
// Attribution 需求:輸出需標示 "Powered by TfL Open Data"(TfL Transport Data
// Service 條款)+ OSM ODbL(shape 由第二階段腳本加入後一併聲明)。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SCRATCH = "/private/tmp/claude-501/-Users-xuxiang-Code------/2cbdb064-06d3-4c63-90ae-6b17706bf3bc/scratchpad/london";
const DATA = path.join(HERE, "data", "london.json");

const master = JSON.parse(fs.readFileSync(path.join(SCRATCH, "master_stations.json"), "utf8"));

function cleanName(raw) {
  // 只去掉 TfL 附加的通用尾綴 "Underground Station"。不可再額外砍掉單獨的
  // " Station",因為有些站名本身就以 Station 結尾(如「Battersea Power
  // Station」是真實地名,砍了會變成錯誤的「Battersea Power」)。
  let n = raw.replace(/\s+Underground Station$/, "");
  n = n.replace(/\s*\([^)]*\)\s*$/, ""); // 去掉尾端消歧義括號,如 "(Circle Line)"
  return n.trim();
}

function loadLine(fileId) {
  return JSON.parse(fs.readFileSync(path.join(SCRATCH, `${fileId}_all.json`), "utf8"));
}

function findRoute(lineData, from, to, via) {
  for (const r of lineData.orderedLineRoutes) {
    const decoded = r.name.replace(/&harr;/g, "<->");
    const [fromPart, restPart] = decoded.split("<->").map((s) => s.trim());
    let toPart = restPart, viaPart = null;
    const viaIdx = restPart.indexOf(" via ");
    if (viaIdx >= 0) {
      toPart = restPart.slice(0, viaIdx).trim();
      viaPart = restPart.slice(viaIdx + 5).trim();
    }
    if (fromPart === from && toPart === to && (via ? viaPart === via : true)) {
      return r;
    }
  }
  throw new Error(`route not found: ${from} -> ${to} via ${via} in ${lineData.lineId}`);
}

function buildStations(lineData, routeName) {
  const [from, rest] = routeName.split("->").map((s) => s.trim());
  throw new Error("unused");
}

// entry 定義:每條為一個「無分叉線性走廊」,對應 TfL orderedLineRoutes 中
// 真實存在的完整服務型態(不虛構直通)。分支選擇原則見任務回報。
const ENTRIES = [
  // Bakerloo — 無分支,單一走廊
  { id: "bakerloo", name: "Bakerloo", file: "bakerloo", color: "#B26300",
    from: "Elephant & Castle", to: "Harrow & Wealdstone",
    peakHeadwaySec: 180, offpeakHeadwaySec: 225 },
    // 來源:en.wikipedia.org/wiki/Bakerloo_line (as of 2021-05, 引用 TfL)
    // peak 20tph(180s)/off-peak 16tph(225s) 為 Queen's Park–Elephant&Castle
    // 核心段合併班次(headline 數字);全長 Harrow&Wealdstone 端實際較疏(離峰
    // 僅約 4tph),為簡化模型採核心段數字,已於任務回報中註明限制。

  // Central — 西端 Ealing Broadway/West Ruislip 分岔 + 東端 Hainault 環線,拆 3 條
  { id: "central-wr-epping", name: "Central (West Ruislip–Epping)", file: "central", color: "#DC241F",
    from: "West Ruislip", to: "Epping",
    peakHeadwaySec: 240, offpeakHeadwaySec: 400 },
    // 主幹,不經 Hainault 環。off-peak 9tph(400s)為 WebSearch 摘要 TfL 資料
    // 明確數字;peak 240s(15tph)為依核心段 34tph/off-peak 20tph 比例估算,估算值。
  { id: "central-eb-hainault", name: "Central (Ealing Broadway–Hainault via Newbury Park)", file: "central", color: "#DC241F",
    from: "Ealing Broadway", to: "Hainault",
    peakHeadwaySec: 600, offpeakHeadwaySec: 1200 },
    // off-peak 約 3tph(1200s,"每 20 分" Ealing Broadway–White City 區間班距
    // 之代表值);peak 600s 為估算值(標註)。
  { id: "central-hainault-wr-woodford", name: "Central (Hainault–West Ruislip, Woodford loop)", file: "central", color: "#DC241F",
    from: "Hainault", to: "West Ruislip", via: "Woodford",
    peakHeadwaySec: 600, offpeakHeadwaySec: 1200 },
    // 補上 Grange Hill/Chigwell/Roding Valley 環段。off-peak 約 3tph(1200s,
    // "每 20 分" Leytonstone–Loughton/Hainault 區間班距之代表值);peak 估算值。

  // Circle — 2009 後為螺旋線性(Edgware Road 出現兩次),TfL API 本身已回傳單一走廊
  { id: "circle", name: "Circle", file: "circle", color: "#FFC80A",
    from: "Edgware Road (Circle Line)", to: "Hammersmith (H&C Line)",
    peakHeadwaySec: 450, offpeakHeadwaySec: 600 },
    // 來源:en.wikipedia.org/wiki/Circle_line_(London_Underground) 舊版 6tph
    // (18 列車運用)為離峰代表值;peak 8tph 為估算值(+33%)。共軌路段(如
    // Hammersmith–Paddington)實際合併班距更密,因與 District/H&C 共用軌道,
    // 屬正常現象(比照台北捷運文湖/其他共軌案例)。

  // District — 西端 Ealing Broadway/Richmond + 南端 Wimbledon,拆 3 條(略過極
  // 少班的 Kensington (Olympia) 特殊活動接駁,無常態班距可查)
  { id: "district-eb-upminster", name: "District (Ealing Broadway–Upminster)", file: "district", color: "#007D32",
    from: "Ealing Broadway", to: "Upminster",
    peakHeadwaySec: 400, offpeakHeadwaySec: 600 },
    // off-peak 6tph(600s)明確數字(Wikipedia District line, 2025-01-13);
    // peak 400s(9tph)估算值。
  { id: "district-richmond-upminster", name: "District (Richmond–Upminster)", file: "district", color: "#007D32",
    from: "Richmond", to: "Upminster",
    peakHeadwaySec: 400, offpeakHeadwaySec: 600 },
    // off-peak 6tph 明確數字;peak 估算值。
  { id: "district-wimbledon-upminster", name: "District (Wimbledon–Upminster)", file: "district", color: "#007D32",
    from: "Wimbledon", to: "Upminster",
    peakHeadwaySec: 600, offpeakHeadwaySec: 1200 },
    // off-peak 以「Wimbledon–Barking 3tph」代理值(Wimbledon 實際離峰多半只
    // 開到 Tower Hill/Barking/Edgware Road,鮮少全程到 Upminster);peak
    // 600s 為估算值,兩者皆標註為簡化近似。

  // Hammersmith & City — 無分支
  { id: "hammersmith-city", name: "Hammersmith & City", file: "hammersmith-city", color: "#F589A6",
    from: "Barking", to: "Hammersmith (H&C Line)",
    peakHeadwaySec: 450, offpeakHeadwaySec: 600 },
    // off-peak 6tph(600s)明確數字("6 trains per hour... all day",Wikipedia/
    // GLA);peak 8tph(450s)取 TfL Four Lines Modernisation 目標值。

  // Jubilee — 無分支
  { id: "jubilee", name: "Jubilee", file: "jubilee", color: "#838D93",
    from: "Stratford", to: "Stanmore",
    peakHeadwaySec: 200, offpeakHeadwaySec: 300 },
    // peak 18tph(200s)/off-peak 12tph(300s)為 Stratford–Stanmore 全程班距
    // 明確數字(Wikipedia Jubilee line Services 表)。

  // Metropolitan — Aldgate 端共同出發,四個終點分支,拆 4 條
  { id: "met-aldgate-uxbridge", name: "Metropolitan (Aldgate–Uxbridge)", file: "metropolitan", color: "#9B0058",
    from: "Aldgate", to: "Uxbridge",
    peakHeadwaySec: 600, offpeakHeadwaySec: 600 },
    // 6tph 全日明確數字(WebSearch 摘要 TfL 資料)。
  { id: "met-aldgate-watford", name: "Metropolitan (Aldgate–Watford)", file: "metropolitan", color: "#9B0058",
    from: "Aldgate", to: "Watford",
    peakHeadwaySec: 600, offpeakHeadwaySec: 600 },
    // 6tph 全日明確數字。
  { id: "met-aldgate-amersham", name: "Metropolitan (Aldgate–Amersham)", file: "metropolitan", color: "#9B0058",
    from: "Aldgate", to: "Amersham",
    peakHeadwaySec: 600, offpeakHeadwaySec: 900 },
    // off-peak 4tph(900s)明確數字;peak 6tph(600s,含尖峰加開 2 班)明確數字。
  { id: "met-aldgate-chesham", name: "Metropolitan (Aldgate–Chesham)", file: "metropolitan", color: "#9B0058",
    from: "Aldgate", to: "Chesham",
    peakHeadwaySec: 1800, offpeakHeadwaySec: 1800 },
    // Chesham–Chalfont & Latimer 為單軌區間,全日僅約 2tph(每 30 分)明確數字。

  // Northern — 南北多分支+中央 Bank/Charing Cross 雙走廊,拆 3 條取實際主力型態
  { id: "northern-edgware-morden-bank", name: "Northern (Edgware–Morden, Bank branch)", file: "northern", color: "#000000",
    from: "Edgware", to: "Morden", via: "Bank",
    peakHeadwaySec: 300, offpeakHeadwaySec: 360 },
    // peak 12tph(300s)為 Edgware–Morden(Bank)尖峰主力型態明確數字
    // (Wikipedia Northern line, 2021-09);off-peak 估算(離峰縮班主要影響
    // Charing Cross 側,Bank 側估計降幅較小)。
  { id: "northern-battersea-highbarnet-cx", name: "Northern (Battersea Power Station–High Barnet, Charing Cross branch)", file: "northern", color: "#000000",
    from: "Battersea Power Station", to: "High Barnet",
    peakHeadwaySec: 360, offpeakHeadwaySec: 450 },
    // peak 10tph(360s)為 High Barnet–Battersea(Charing Cross)尖峰主力型態
    // 明確數字;off-peak 估算值。
  { id: "northern-morden-millhilleast-bank", name: "Northern (Morden–Mill Hill East, Bank branch)", file: "northern", color: "#000000",
    from: "Morden", to: "Mill Hill East", via: "Bank",
    peakHeadwaySec: 1800, offpeakHeadwaySec: 1800 },
    // Mill Hill East 支線全日僅 2tph(每 30 分)明確數字,倫敦地鐵最疏站之一。

  // Piccadilly — Acton Town 以西 Uxbridge 分支 + Hatton Cross 以西 T4/T5 分支,拆 3 條
  { id: "piccadilly-cockfosters-uxbridge", name: "Piccadilly (Cockfosters–Uxbridge)", file: "piccadilly", color: "#0019A8",
    from: "Cockfosters", to: "Uxbridge",
    peakHeadwaySec: 300, offpeakHeadwaySec: 1200 },
    // off-peak 3tph(1200s,"Arnos Grove–Uxbridge"明確數字,Cockfosters–
    // Arnos Grove 為共同幹線);peak 300s(12tph)為全線尖峰 24tph 兩分支約
    // 各半之估算值。
  { id: "piccadilly-cockfosters-heathrowt5", name: "Piccadilly (Cockfosters–Heathrow T5)", file: "piccadilly", color: "#0019A8",
    from: "Cockfosters", to: "Heathrow Terminal 5",
    peakHeadwaySec: 600, offpeakHeadwaySec: 600 },
    // off-peak 6tph 明確數字;peak 沿用同值估算(Heathrow 分支尖離峰差異
    // 較小)。
  { id: "piccadilly-cockfosters-heathrowt4", name: "Piccadilly (Cockfosters–Heathrow T4)", file: "piccadilly", color: "#0019A8",
    from: "Cockfosters", to: "Heathrow Terminal 4",
    peakHeadwaySec: 600, offpeakHeadwaySec: 600 },
    // off-peak 6tph 明確數字;peak 估算同值。

  // Victoria — 無分支,全網最高頻率
  { id: "victoria", name: "Victoria", file: "victoria", color: "#039BE5",
    from: "Brixton", to: "Walthamstow Central",
    peakHeadwaySec: 100, offpeakHeadwaySec: 133 },
    // peak 36tph(100s,2017-05 起)/off-peak 27tph(133s)明確數字
    // (Wikipedia Victoria line)。

  // Waterloo & City — 無分支,僅 2 站
  { id: "waterloo-city", name: "Waterloo & City", file: "waterloo-city", color: "#76D0BD",
    from: "Bank", to: "Waterloo",
    peakHeadwaySec: 200, offpeakHeadwaySec: 300 },
    // peak 18tph(200s)/off-peak 12tph(300s)明確數字(Wikipedia Waterloo &
    // City line)。
];

const lineCache = {};
function getLine(fileId) {
  if (!lineCache[fileId]) lineCache[fileId] = loadLine(fileId);
  return lineCache[fileId];
}

const outLines = [];
for (const e of ENTRIES) {
  const ld = getLine(e.file);
  const route = findRoute(ld, e.from, e.to, e.via);
  const stations = route.naptanIds.map((nid, i) => {
    const m = master[nid];
    if (!m) throw new Error(`missing station ${nid} in ${e.id}`);
    return { name: cleanName(m.name), lat: m.lat, lon: m.lon, d: i }; // d 佔位,由 shapes 腳本重算
  });
  outLines.push({
    id: e.id,
    name: e.name,
    color: e.color,
    peakHeadwaySec: e.peakHeadwaySec,
    offpeakHeadwaySec: e.offpeakHeadwaySec,
    stations,
    shape: [], // 由 build_london_shapes.py 填入
  });
  console.log(`${e.id.padEnd(38)} ${stations.length} stations  ${e.from} -> ${e.to}${e.via ? " via " + e.via : ""}`);
}

const out = {
  system: "LU",
  source_notes: "TfL Unified API(匿名,2026-07-11 抓取)取站序/分支拓撲;OSM Overpass(ODbL)取真實軌跡線形;班距(peak/off-peak tph)綜合 TfL 官方數據與 Wikipedia 引用之 TfL 資料,部分無法查得逐分支數字者以合理值估算並標註,詳見專案交接紀錄。分支眾多(Northern/Central/District/Metropolitan/Piccadilly)依真實存在的服務型態拆分為多條 line 條目,同一實體軌道可能被多條 line 覆蓋(倫敦地鐵大量共軌為真實現象,非資料錯誤)。線路色:TfL Colour Standard Issue 10(2025-05)。Powered by TfL Open Data. Contains OS data © Crown copyright and database rights. Map data © OpenStreetMap contributors, ODbL.",
  lines: outLines,
};

fs.writeFileSync(DATA, JSON.stringify(out));
console.log(`\nWROTE ${DATA}  (${outLines.length} line entries, ${outLines.reduce((a, l) => a + l.stations.length, 0)} station rows)`);
