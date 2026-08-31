#!/usr/bin/env node
// 倫敦三語內容索引。TfL 官方 Route/Sequence 僅提供英文專名；為避免杜撰官方譯名，
// zh-TW／ja 的車站與端點保留 TfL 英文，介面、模式、線名與資料說明則完整翻譯。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const GEO = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'london.json'), 'utf8'));
const SCHED = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'london_schedule_dense.json'), 'utf8'));
const FILE = path.join(ROOT, 'i18n', 'stations.json');
const I18N = JSON.parse(fs.readFileSync(FILE, 'utf8'));

const LINE = {
  bakerloo: ['貝克盧線', 'Bakerloo line', 'ベーカールー線'],
  central: ['中央線', 'Central line', 'セントラル線'],
  circle: ['環線', 'Circle line', 'サークル線'],
  district: ['區域線', 'District line', 'ディストリクト線'],
  'hammersmith-city': ['漢默史密斯及城市線', 'Hammersmith & City line', 'ハマースミス&シティー線'],
  jubilee: ['銀禧線', 'Jubilee line', 'ジュビリー線'],
  metropolitan: ['大都會線', 'Metropolitan line', 'メトロポリタン線'],
  northern: ['北線', 'Northern line', 'ノーザン線'],
  piccadilly: ['皮卡迪利線', 'Piccadilly line', 'ピカデリー線'],
  victoria: ['維多利亞線', 'Victoria line', 'ヴィクトリア線'],
  'waterloo-city': ['滑鐵盧及城市線', 'Waterloo & City line', 'ウォータールー&シティー線'],
  dlr: ['碼頭區輕便鐵路 DLR', 'Docklands Light Railway (DLR)', 'ドックランズ・ライト・レイルウェイ（DLR）'],
  elizabeth: ['伊利沙伯線', 'Elizabeth line', 'エリザベス線'],
  tram: ['倫敦電車', 'London Trams', 'ロンドン・トラム'],
  liberty: ['London Overground・Liberty 線', 'London Overground · Liberty line', 'ロンドン・オーバーグラウンド・Liberty線'],
  lioness: ['London Overground・Lioness 線', 'London Overground · Lioness line', 'ロンドン・オーバーグラウンド・Lioness線'],
  mildmay: ['London Overground・Mildmay 線', 'London Overground · Mildmay line', 'ロンドン・オーバーグラウンド・Mildmay線'],
  windrush: ['London Overground・Windrush 線', 'London Overground · Windrush line', 'ロンドン・オーバーグラウンド・Windrush線'],
  weaver: ['London Overground・Weaver 線', 'London Overground · Weaver line', 'ロンドン・オーバーグラウンド・Weaver線'],
  suffragette: ['London Overground・Suffragette 線', 'London Overground · Suffragette line', 'ロンドン・オーバーグラウンド・Suffragette線'],
};

const byType = new Map();
for (const type of SCHED.types) byType.set(type.key, type);

I18N.systems.london = {};
for (const name of [...new Set(GEO.lines.flatMap((line) => line.stations.map((st) => st.name)))].sort()) {
  I18N.systems.london[name] = { 'zh-TW': name, en: name, ja: name };
}

I18N.routes.london = {};
for (const line of GEO.lines) {
  const base = LINE[line.lineId];
  if (!base) throw new Error(`missing line translation: ${line.lineId}`);
  const suffix = line.name.slice(line.name.indexOf(' · ') + 3);
  I18N.routes.london[line.name] = {
    'zh-TW': `${base[0]}・${suffix}`,
    en: `${base[1]} · ${suffix}`,
    ja: `${base[2]}・${suffix}`,
  };
}

for (const line of GEO.lines) {
  const base = LINE[line.lineId];
  const type = SCHED.trains.find((tr) => tr.carName === line.name)?.typeName;
  if (!type || !byType.has(type)) throw new Error(`missing type for ${line.id}`);
  I18N.trainTypes[type] = { 'zh-TW': base[0], en: base[1], ja: base[2] };
}

I18N.generated = '2026-08-31';
fs.writeFileSync(FILE, JSON.stringify(I18N, null, 2) + '\n');
console.log(`WROTE ${FILE}`);
console.log(`  London stations: ${Object.keys(I18N.systems.london).length}`);
console.log(`  London route variants: ${Object.keys(I18N.routes.london).length}`);
console.log(`  London train types: ${new Set(SCHED.types.map((x) => x.key)).size}`);
