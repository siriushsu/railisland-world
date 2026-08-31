#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const ENDPOINT = 'https://datamall2.mytransport.sg/ltaodataservice/GTFSScheduleTrain';
const help = process.argv.includes('--help') || process.argv.includes('-h');
const outputArg = process.argv.slice(2).find(arg => !arg.startsWith('-'));

if (help) {
  console.log(`用法:
  LTA_DATAMALL_ACCOUNT_KEY=... node tools/fetch_lta_train_gtfs.mjs <輸出.zip>

資料源：LTA DataMall API v6.9 / GTFSScheduleTrain
AccountKey 只從環境變數讀取，不會寫入檔案或輸出到終端。`);
  process.exit(0);
}

if (!outputArg) {
  console.error('缺少輸出路徑。請先用 --help 查看用法。');
  process.exit(1);
}
const accountKey = process.env.LTA_DATAMALL_ACCOUNT_KEY;
if (!accountKey) {
  console.error('缺少 LTA_DATAMALL_ACCOUNT_KEY；請先向 LTA DataMall 申請 AccountKey。');
  process.exit(1);
}

const metadataResponse = await fetch(ENDPOINT, {
  headers: { AccountKey: accountKey, Accept: 'application/json' },
  redirect: 'follow',
});
if (!metadataResponse.ok) {
  throw new Error(`LTA GTFS metadata 請求失敗：HTTP ${metadataResponse.status}`);
}
const metadata = await metadataResponse.json();
const first = Array.isArray(metadata.value) ? metadata.value[0] : metadata;
const link = first && (first.Link || first.link);
if (!link || !/^https:\/\//.test(link)) {
  throw new Error('LTA GTFS metadata 沒有可用的 HTTPS 下載連結。');
}

const zipResponse = await fetch(link, { redirect: 'follow' });
if (!zipResponse.ok) throw new Error(`LTA GTFS ZIP 下載失敗：HTTP ${zipResponse.status}`);
const bytes = Buffer.from(await zipResponse.arrayBuffer());
if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
  throw new Error('LTA 回應不是有效 ZIP（缺少 PK 檔頭）。');
}

const output = path.resolve(outputArg);
await fs.mkdir(path.dirname(output), { recursive: true });
await fs.writeFile(output, bytes, { mode: 0o600 });
console.log(`✓ 已下載 LTA Train GTFS：${output}（${(bytes.length / 1024 / 1024).toFixed(1)} MiB）`);
