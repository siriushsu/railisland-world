#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [track, schedule] = await Promise.all([
  readFile(path.join(ROOT, 'data/tokyo.json'), 'utf8').then(JSON.parse),
  readFile(path.join(ROOT, 'data/tokyo_schedule_dense.json'), 'utf8').then(JSON.parse),
]);
const expected = { E: 39, I: 27, S: 21, A: 20, SA: 30, NT: 13, G: 19, M: 25, Mb: 4, H: 22, T: 23, C: 20, Y: 24, Z: 14, N: 19, F: 16 };
const actualIds = track.lines.map(line => line.id);
if (actualIds.length !== Object.keys(expected).length || Object.keys(expected).some(id => !actualIds.includes(id))) throw new Error(`東京路徑集合不符：${actualIds.join(', ')}`);
for (const line of track.lines) {
  if (line.stations.length !== expected[line.id]) throw new Error(`${line.id} 應為 ${expected[line.id]} 站，實際 ${line.stations.length}`);
  if (line.shape.length < 2 || !Number.isFinite(line.shapeLen) || line.shapeLen <= 0) throw new Error(`${line.id} 缺有效線形`);
  for (let index = 1; index < line.stations.length; index++) if (line.stations[index].d + 0.001 < line.stations[index - 1].d) throw new Error(`${line.id} 站序里程倒退`);
}
const byId = new Map(track.lines.map(line => [line.id, line]));
const marunouchiUnique = new Set([...byId.get('M').stations, ...byId.get('Mb').stations].map(station => station.name));
if (marunouchiUnique.size !== 28) throw new Error(`丸ノ內線含支線應為 28 個官方站，實際 ${marunouchiUnique.size}`);
if (byId.get('Mb').stations.map(station => station.name).join('→') !== '中野坂上→中野新橋→中野富士見町→方南町') throw new Error('丸ノ內線方南町支線站序不符');
if (byId.get('C').stations[0].name !== '代々木上原' || byId.get('C').stations.at(-1).name !== '北綾瀬') throw new Error('千代田線 C01–C20 未完整接合');
const officialLineCounts = { G: 19, M: 28, H: 22, T: 23, C: 20, Y: 24, Z: 14, N: 19, F: 16 };
for (const [id, count] of Object.entries(officialLineCounts)) {
  const names = id === 'M' ? marunouchiUnique : new Set(byId.get(id).stations.map(station => station.name));
  if (names.size !== count) throw new Error(`${id} 官方線站數應為 ${count}，實際 ${names.size}`);
}
if (schedule.date !== '20260831') throw new Error(`東京班表日期應為 20260831，實際 ${schedule.date}`);
if (schedule.trains.length !== 8628) throw new Error(`東京應為 8,628 車次，實際 ${schedule.trains.length}`);
const typeCounts = new Map();
for (const train of schedule.trains) typeCounts.set(train.typeName, (typeCounts.get(train.typeName) || 0) + 1);
for (const id of Object.keys(expected)) if (![...typeCounts.keys()].some(key => key.startsWith(`${id}・`))) throw new Error(`東京 ${id} 沒有流動班次`);
const toeiCount = [...typeCounts].filter(([key]) => ['A', 'I', 'S', 'E', 'SA', 'NT'].includes(key.split('・')[0])).reduce((sum, [, count]) => sum + count, 0);
if (toeiCount !== 2818) throw new Error(`Toei 官方平日車次應為 2,818，實際 ${toeiCount}`);
console.log('✓ 東京路網 gate：Toei 6 線＋Tokyo Metro 9 線（16 個路徑 variants）');
console.log('✓ 方南町支線與千代田線北綾瀨端分開驗證；雙向班次皆存在');
console.log(`✓ 2,818 班 Toei 官方平日時刻＋${schedule.trains.length - toeiCount} 班 Metro 合成流動`);
