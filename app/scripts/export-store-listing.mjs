import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(here, '..');
const storeRoot = join(appRoot, 'store');
const exportRoot = join(storeRoot, 'export');
const readJson = async file => JSON.parse(await readFile(join(storeRoot, file), 'utf8'));
const apple = await readJson('apple-metadata.json');
const google = await readJson('google-play-metadata.json');

async function writeText(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${String(value).trimEnd()}\n`);
}

await rm(exportRoot, { recursive: true, force: true });

for (const [locale, copy] of Object.entries(apple.locales)) {
  const dir = join(exportRoot, 'apple', locale);
  await writeText(join(dir, 'name.txt'), copy.name);
  await writeText(join(dir, 'subtitle.txt'), copy.subtitle);
  await writeText(join(dir, 'promotional_text.txt'), copy.promotionalText);
  await writeText(join(dir, 'description.txt'), copy.description);
  await writeText(join(dir, 'keywords.txt'), copy.keywords);
  await writeText(join(dir, 'release_notes.txt'), copy.whatsNew);
  await writeText(join(dir, 'marketing_url.txt'), apple.marketingUrl);
  await writeText(join(dir, 'support_url.txt'), apple.supportUrl);
  await writeText(join(dir, 'privacy_url.txt'), apple.privacyPolicyUrl);
}

for (const [locale, copy] of Object.entries(google.locales)) {
  const dir = join(exportRoot, 'google-play', locale);
  await writeText(join(dir, 'title.txt'), copy.title);
  await writeText(join(dir, 'short_description.txt'), copy.shortDescription);
  await writeText(join(dir, 'full_description.txt'), copy.fullDescription);
  await writeText(join(dir, 'support_email.txt'), google.supportEmail);
  await writeText(join(dir, 'support_url.txt'), google.supportUrl);
  await writeText(join(dir, 'privacy_policy_url.txt'), google.privacyPolicyUrl);
}

await writeText(join(exportRoot, 'APPLE-APP-INFORMATION.txt'), [
  `Bundle ID: ${apple.appId}`,
  `SKU: ${apple.sku}`,
  `Version: ${apple.version}`,
  `Primary category: ${apple.primaryCategory}`,
  `Secondary category: ${apple.secondaryCategory}`,
  `Price: ${apple.price}`,
  `Copyright: ${apple.copyright}`
].join('\n'));

await writeText(join(exportRoot, 'GOOGLE-PLAY-APP-INFORMATION.txt'), [
  `Package name: ${google.appId}`,
  `Version name: ${google.versionName}`,
  `Version code: ${google.versionCode}`,
  `App or game: ${google.appOrGame}`,
  `Category: ${google.category}`,
  `Price: ${google.price}`,
  `Contains ads: ${google.containsAds}`
].join('\n'));

console.log(`商店貼入文字已輸出：Apple ${Object.keys(apple.locales).length} 語、Google Play ${Object.keys(google.locales).length} 語`);
