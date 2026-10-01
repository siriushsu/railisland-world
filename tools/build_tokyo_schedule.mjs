#!/usr/bin/env node
// 合併東京動畫班表：Toei 六線保留官方 GTFS-JP 平日時刻；Tokyo Metro 九線用明示的
// 合成班距產生雙向流動。2026-08-31 為普通星期一，與原快照 2026-07-15 同屬 Toei
// calendar.txt service_id=0，且不在 calendar_dates 例外日，故官方 2,818 車次可沿用。

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TOKYO_RAIL_SPECS } from './tokyo_rail_specs.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TRACK_FILE = path.join(ROOT, 'data/tokyo.json');
const SCHEDULE_FILE = path.join(ROOT, 'data/tokyo_schedule_dense.json');
const OP_START = 5 * 3600;
const OP_END = 24.5 * 3600;
const PEAKS = [[7 * 3600, 9.5 * 3600], [17 * 3600, 19.5 * 3600]];
const TOEI_TYPES = new Set(['A', 'I', 'S', 'E', 'SA', 'NT']);
const TYPE_ZH = { A: '淺草線', I: '三田線', S: '新宿線', E: '大江戶線', SA: '東京櫻花路面電車', NT: '日暮里・舍人線', G: '銀座線', M: '丸之內線', Mb: '丸之內線方南町支線', H: '日比谷線', T: '東西線', C: '千代田線', Y: '有樂町線', Z: '半藏門線', N: '南北線', F: '副都心線' };
// JR 與私鐵的車種名取路線清單的繁中名，規則同 build_tokyo_i18n.mjs（去括號、去空白）
for (const spec of TOKYO_RAIL_SPECS) TYPE_ZH[spec.id] = spec.names[0].replace(/（[^）]+）/g, '').replace(/\s+/g, '');
const RAIL_IDS = new Set(TOKYO_RAIL_SPECS.map(spec => spec.id));
const tokyoType = id => `${id}・${TYPE_ZH[id]}`;
const rawTokyoType = key => String(key).replace(/^東京/, '').split('・')[0];
const isPeak = second => PEAKS.some(([from, to]) => second >= from && second < to);
const r5 = value => Math.round(value * 1e5) / 1e5;

function generateLine(line, trains) {
  const directions = [
    { mark: '↓', stations: line.stations },
    { mark: '↑', stations: [...line.stations].reverse() },
  ];
  for (const direction of directions) {
    const runSeconds = [];
    for (let index = 0; index < direction.stations.length - 1; index++) {
      const distanceKm = Math.abs(direction.stations[index + 1].d - direction.stations[index].d);
      runSeconds.push(Math.max(30, Math.round(distanceKm / (line.cruiseKmh || 34) * 3600)));
    }
    let departure = OP_START, sequence = 0;
    while (departure <= OP_END) {
      sequence++;
      let current = departure;
      const stops = direction.stations.map((station, index) => {
        const arrSec = current;
        const depSec = index === direction.stations.length - 1 ? arrSec : arrSec + (RAIL_IDS.has(line.id) ? 30 : 25);
        if (index < direction.stations.length - 1) current = depSec + runSeconds[index];
        return { name: station.name, lat: r5(station.lat), lon: r5(station.lon), arrSec, depSec };
      });
      trains.push({
        train: `${line.id}${direction.mark}${String(sequence).padStart(3, '0')}`,
        typeName: tokyoType(line.id),
        carName: line.name,
        color: line.color,
        estimated: true,
        stops,
      });
      departure += isPeak(departure) ? line.peakHeadwaySec : line.offpeakHeadwaySec;
    }
  }
}

const [track, previous] = await Promise.all([
  readFile(TRACK_FILE, 'utf8').then(JSON.parse),
  readFile(SCHEDULE_FILE, 'utf8').then(JSON.parse),
]);
const toeiTrains = previous.trains.filter(train => TOEI_TYPES.has(rawTokyoType(train.typeName))).map(train => ({ ...train, typeName: tokyoType(rawTokyoType(train.typeName)) }));
if (toeiTrains.length !== 2818) throw new Error(`Toei 官方平日班次應為 2818，實際 ${toeiTrains.length}`);
const metroLines = track.lines.filter(line => !TOEI_TYPES.has(line.id) && !RAIL_IDS.has(line.id));
if (metroLines.length !== 10) throw new Error(`Tokyo Metro 應為 10 個路徑 variants，實際 ${metroLines.length}`);
const railLines = track.lines.filter(line => RAIL_IDS.has(line.id));
if (railLines.length !== TOKYO_RAIL_SPECS.length) throw new Error(`JR／私鐵應為 ${TOKYO_RAIL_SPECS.length} 條，實際 ${railLines.length}`);
const metroTrains = [], railTrains = [];
for (const line of metroLines) generateLine(line, metroTrains);
for (const line of railLines) generateLine(line, railTrains);
const types = [
  ...previous.types.filter(type => TOEI_TYPES.has(rawTokyoType(type.key))).map(type => ({ ...type, key: tokyoType(rawTokyoType(type.key)) })),
  ...metroLines.map(line => ({ key: tokyoType(line.id), color: line.color })),
  ...railLines.map(line => ({ key: tokyoType(line.id), color: line.color })),
];
const output = {
  system: '東京都全境鐵道（都營・東京メトロ・JR・私鐵）',
  date: '20260831',
  source_notes: 'Toei 六線為東京都交通局官方 GTFS-JP（feed_version 20260314）普通平日 service_id=0 的 2,818 車次；2026-08-31 為星期一且不在 calendar_dates 例外日，與原 2026-07-15 平日快照服務集合相同。Tokyo Metro 九線無免註冊官方 GTFS 可直接重製，故依 05:00–00:30、尖離峰估計班距雙向合成，只供路線流動示意，不是官方逐班時刻、即時位置或準點資訊。 JR 東日本、東急、小田急、京王、西武、東武、京成、北總、京急、筑波快線、東京單軌、百合海鷗號、臨海線、多摩單軌共 59 條路線：線形與站點採 OpenStreetMap（ODbL，2026-10-01），裁到東京都界；這些業者在 ODPT 只提供比賽限定授權的時刻資料，不能公開使用，因此依各線一般尖峰／離峰班距與站間平均速度雙向合成，只供路線流動示意，不是官方逐班時刻、即時位置或準點資訊。',
  types,
  trains: [...toeiTrains, ...metroTrains, ...railTrains],
};
await writeFile(SCHEDULE_FILE, JSON.stringify(output));
console.log(`✓ 東京班表：Toei ${toeiTrains.length} 官方平日車次＋Tokyo Metro ${metroTrains.length}＋JR／私鐵 ${railTrains.length} 合成車次＝${output.trains.length}`);
console.log(`  variants：${metroLines.map(line => line.id).join(', ')}`);
