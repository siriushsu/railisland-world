#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [track, schedule] = await Promise.all([
  readFile(path.join(ROOT, 'data/tokyo.json'), 'utf8').then(JSON.parse),
  readFile(path.join(ROOT, 'data/tokyo_schedule_dense.json'), 'utf8').then(JSON.parse),
]);
// 2026-10-01 起含 JR 與私鐵 59 條（tools/build_tokyo_rail.mjs，裁到東京都界）；站數與端點逐條鎖定
const expected = { E: 39, I: 27, S: 21, A: 20, SA: 30, NT: 13, G: 19, M: 25, Mb: 4, H: 22, T: 23, C: 20, Y: 24, Z: 14, N: 19, F: 16, JY: 31, JK: 22, JC: 24, JB: 26, JA: 10, JL: 4, JJ: 5, JO: 8, JE: 6, JT: 3, JU: 4, JS: 7, JN: 10, JM: 5, JH: 11, JCO: 25, JCI: 7, JHK: 6, TY: 9, MG: 9, DT: 25, OM: 15, IK: 15, TM: 7, SG: 10, OH: 22, OT: 3, KO: 32, KON: 4, IN: 17, KOS: 11, KOT: 7, KOK: 2, KOD: 2, SI: 16, SS: 21, SSH: 8, SK: 5, ST: 7, SW: 6, SIT: 2, SIY: 3, SSE: 2, TS: 12, TSO: 2, TSK: 5, TSD: 2, TJ: 10, KS: 12, KSO: 6, KSK: 3, HS: 2, KK: 13, KKA: 7, TX: 7, MO: 11, U: 16, R: 8, TT: 19 };
const railEnds = { JY: ['品川', '品川'], JK: ['蒲田', '赤羽'], JC: ['高尾', '東京'], JB: ['小岩', '三鷹'], JA: ['大崎', '浮間舟渡'], JL: ['金町', '北千住'], JJ: ['北千住', '上野'], JO: ['西大井', '新小岩'], JE: ['東京', '葛西臨海公園'], JT: ['東京', '品川'], JU: ['東京', '赤羽'], JS: ['赤羽', '西大井'], JN: ['立川', '矢野口'], JM: ['府中本町', '新秋津'], JH: ['八王子', '成瀬'], JCO: ['立川', '奥多摩'], JCI: ['拝島', '武蔵五日市'], JHK: ['箱根ヶ崎', '八王子'], TY: ['渋谷', '多摩川'], MG: ['目黒', '多摩川'], DT: ['渋谷', '南町田グランベリーパーク'], OM: ['二子玉川', '大井町'], IK: ['蒲田', '五反田'], TM: ['蒲田', '多摩川'], SG: ['三軒茶屋', '下高井戸'], OH: ['町田', '新宿'], OT: ['小田急永山', '唐木田'], KO: ['京王八王子', '新宿'], KON: ['笹塚', '新線新宿'], IN: ['渋谷', '吉祥寺'], KOS: ['調布', '多摩境'], KOT: ['高尾山口', '北野'], KOK: ['府中競馬正門前', '東府中'], KOD: ['多摩動物公園', '高幡不動'], SI: ['池袋', '秋津'], SS: ['西武新宿', '東村山'], SSH: ['小平', '拝島'], SK: ['国分寺', '東村山'], ST: ['国分寺', '多摩湖'], SW: ['武蔵境', '是政'], SIT: ['練馬', '豊島園'], SIY: ['練馬', '小竹向原'], SSE: ['西武園', '東村山'], TS: ['浅草', '竹ノ塚'], TSO: ['押上〈スカイツリー前〉', '曳舟'], TSK: ['曳舟', '亀戸'], TSD: ['西新井', '大師前'], TJ: ['成増', '池袋'], KS: ['京成上野', '江戸川'], KSO: ['青砥', '押上'], KSK: ['京成高砂', '京成金町'], HS: ['京成高砂', '新柴又'], KK: ['六郷土手', '品川'], KKA: ['羽田空港第1・第2ターミナル', '京急蒲田'], TX: ['六町', '秋葉原'], MO: ['羽田空港第2ターミナル', 'モノレール浜松町'], U: ['新橋', '豊洲'], R: ['新木場', '大崎'], TT: ['上北台', '多摩センター'] };
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
for (const [id, [first, last]] of Object.entries(railEnds)) {
  const line = byId.get(id);
  if (line.stations[0].name !== first || line.stations.at(-1).name !== last) throw new Error(`${id} 端點應為 ${first}→${last}，實際 ${line.stations[0].name}→${line.stations.at(-1).name}`);
  if (!line.osmRelationIds?.length) throw new Error(`${id} 缺 OSM relation 出處`);
}
const yamanote = byId.get('JY');
if (yamanote.stations[0].name !== yamanote.stations.at(-1).name || new Set(yamanote.stations.map(s => s.name)).size !== 30) throw new Error('山手線應為 30 站環線（起點站頭尾各一次）');
if (Math.abs(yamanote.stations.at(-1).d - yamanote.shapeLen) > 0.01) throw new Error('山手線終點里程應等於一圈全長');
const officialLineCounts = { G: 19, M: 28, H: 22, T: 23, C: 20, Y: 24, Z: 14, N: 19, F: 16 };
for (const [id, count] of Object.entries(officialLineCounts)) {
  const names = id === 'M' ? marunouchiUnique : new Set(byId.get(id).stations.map(station => station.name));
  if (names.size !== count) throw new Error(`${id} 官方線站數應為 ${count}，實際 ${names.size}`);
}
if (schedule.date !== '20260831') throw new Error(`東京班表日期應為 20260831，實際 ${schedule.date}`);
if (schedule.trains.length !== 28640) throw new Error(`東京應為 28,640 車次，實際 ${schedule.trains.length}`);
const typeCounts = new Map();
for (const train of schedule.trains) typeCounts.set(train.typeName, (typeCounts.get(train.typeName) || 0) + 1);
for (const id of Object.keys(expected)) if (![...typeCounts.keys()].some(key => key.startsWith(`${id}・`))) throw new Error(`東京 ${id} 沒有流動班次`);
const toeiCount = [...typeCounts].filter(([key]) => ['A', 'I', 'S', 'E', 'SA', 'NT'].includes(key.split('・')[0])).reduce((sum, [, count]) => sum + count, 0);
if (toeiCount !== 2818) throw new Error(`Toei 官方平日車次應為 2,818，實際 ${toeiCount}`);
console.log(`✓ 東京路網 gate：Toei 6 線＋Tokyo Metro 9 線＋JR／私鐵 ${Object.keys(railEnds).length} 條（${track.lines.length} 個路徑）`);
console.log('✓ 方南町支線與千代田線北綾瀨端分開驗證；雙向班次皆存在');
console.log(`✓ 2,818 班 Toei 官方平日時刻＋${schedule.trains.length - toeiCount} 班 Metro／JR／私鐵合成流動；山手線環狀、各線端點與站數逐條鎖定`);
