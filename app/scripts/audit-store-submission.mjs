import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(here, '..');
const storeRoot = join(appRoot, 'store');
const assetsRoot = join(storeRoot, 'assets');
const fail = message => { throw new Error(`Store submission：${message}`); };
const expect = (condition, message) => { if (!condition) fail(message); };
const json = async file => JSON.parse(await readFile(file, 'utf8'));
const utf8Bytes = value => Buffer.byteLength(value, 'utf8');

function imageDimensions(buffer) {
  if (buffer.length >= 24 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20), format: 'png' };
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset + 8 < buffer.length) {
      if (buffer[offset] !== 0xff) { offset += 1; continue; }
      const marker = buffer[offset + 1];
      if ([0xd8, 0xd9].includes(marker)) { offset += 2; continue; }
      const length = buffer.readUInt16BE(offset + 2);
      if (length < 2) break;
      if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
        return { width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5), format: 'jpeg' };
      }
      offset += 2 + length;
    }
  }
  fail('無法辨識圖片格式或尺寸');
}

async function expectImage(file, width, height, format = null) {
  const buffer = await readFile(file).catch(() => fail(`缺圖片 ${file.replace(`${appRoot}/`, '')}`));
  const actual = imageDimensions(buffer);
  expect(actual.width === width && actual.height === height, `${file.replace(`${appRoot}/`, '')} 尺寸 ${actual.width}×${actual.height}，應為 ${width}×${height}`);
  if (format) expect(actual.format === format, `${file.replace(`${appRoot}/`, '')} 應為 ${format}`);
  expect(buffer.length > 20_000, `${file.replace(`${appRoot}/`, '')} 檔案異常過小`);
}

const apple = await json(join(storeRoot, 'apple-metadata.json'));
const google = await json(join(storeRoot, 'google-play-metadata.json'));
expect(apple.appId === 'tw.railisland.world' && google.appId === 'tw.railisland.world', '永久 application id 不是 tw.railisland.world');
expect(apple.version === '1.0.0' && google.versionName === '1.0.0' && google.versionCode === 1, '商店版本未鎖定 1.0.0 (1)');
for (const field of ['marketingUrl', 'supportUrl', 'privacyPolicyUrl']) expect(/^https:\/\//.test(apple[field]), `Apple ${field} 不是 HTTPS`);
for (const field of ['supportUrl', 'privacyPolicyUrl']) expect(/^https:\/\//.test(google[field]), `Google ${field} 不是 HTTPS`);
expect(Object.keys(apple.locales).sort().join(',') === ['en-US', 'ja', 'zh-Hant'].sort().join(','), 'Apple locale 集合不是繁中／英文／日文');
expect(Object.keys(google.locales).sort().join(',') === ['en-US', 'ja-JP', 'zh-TW'].sort().join(','), 'Google locale 集合不是繁中／英文／日文');

for (const [locale, copy] of Object.entries(apple.locales)) {
  expect([...copy.name].length <= 30, `Apple ${locale} name 超過 30 字元`);
  expect([...copy.subtitle].length <= 30, `Apple ${locale} subtitle 超過 30 字元`);
  expect([...copy.promotionalText].length <= 170, `Apple ${locale} promotional text 超過 170 字元`);
  expect([...copy.description].length <= 4000, `Apple ${locale} description 超過 4000 字元`);
  expect(utf8Bytes(copy.keywords) <= 100, `Apple ${locale} keywords 超過 100 bytes（目前 ${utf8Bytes(copy.keywords)}）`);
  expect(!/即時列車位置|real-time train location|リアルタイム位置情報/.test(copy.description), `Apple ${locale} 出現不實的即時定位宣稱`);
}
for (const [locale, copy] of Object.entries(google.locales)) {
  expect([...copy.title].length <= 30, `Google ${locale} title 超過 30 字元`);
  expect([...copy.shortDescription].length <= 80, `Google ${locale} short description 超過 80 字元`);
  expect([...copy.fullDescription].length <= 4000, `Google ${locale} full description 超過 4000 字元`);
  expect(!/即時列車位置|real-time train location|リアルタイム位置情報/.test(copy.fullDescription), `Google ${locale} 出現不實的即時定位宣稱`);
}

for (const file of ['SUBMISSION-CHECKLIST.md', 'APPLE-REVIEW-NOTES.md', 'APPLE-PRIVACY-AND-RATING.md', 'GOOGLE-PLAY-DECLARATIONS.md']) {
  expect((await stat(join(storeRoot, file))).size > 500, `${file} 不存在或內容不足`);
}

const cities = ['01-tokyo.jpg', '02-new-york.jpg', '03-london.jpg', '04-istanbul.jpg', '05-singapore.jpg'];
for (const locale of ['zh-Hant', 'en-US', 'ja']) {
  for (const file of cities) await expectImage(join(assetsRoot, 'apple', locale, 'iphone-6.9', file), 1320, 2868, 'jpeg');
  for (const file of cities) await expectImage(join(assetsRoot, 'apple', locale, 'ipad-13', file), 2064, 2752, 'jpeg');
}
for (const locale of ['zh-TW', 'en-US', 'ja-JP']) {
  for (const file of cities) await expectImage(join(assetsRoot, 'google-play', locale, 'phone', file), 1080, 1920, 'jpeg');
  for (const file of cities) await expectImage(join(assetsRoot, 'google-play', locale, '10-inch-tablet', file), 1600, 2560, 'jpeg');
  await expectImage(join(assetsRoot, 'google-play', locale, 'feature-graphic-1024x500.jpg'), 1024, 500, 'jpeg');
}
await expectImage(join(assetsRoot, 'google-play', 'shared', 'app-icon-512.png'), 512, 512, 'png');

const rejectedWorldArtworkReferences = await Promise.all([
  readFile(join(storeRoot, 'apple-metadata.json'), 'utf8'),
  readFile(join(storeRoot, 'google-play-metadata.json'), 'utf8'),
  readFile(join(appRoot, 'scripts', 'capture-store-assets.mjs'), 'utf8')
]);
expect(!rejectedWorldArtworkReferences.some(source => source.includes('og-world-1200x630.png')), '商店素材產線誤用已退件的世界版圖樣');

const assetFiles = await readdir(assetsRoot, { recursive: true });
console.log(`Store submission PASS · 三語 metadata · ${assetFiles.filter(file => /\.(?:jpg|png)$/.test(file)).length} 張圖片 · application id 已鎖定`);
