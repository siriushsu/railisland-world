import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(here, '..');
const config = JSON.parse(await readFile(resolve(appRoot, 'world-app.config.json'), 'utf8'));
const baseUrl = process.argv[2] || process.env.RAILISLAND_WORLD_PUBLIC_URL || config.publicUrl;

if (!baseUrl.startsWith('https://')) throw new Error(`送審公開網址必須使用 HTTPS：${baseUrl}`);

const checks = [
  ['', '<title>軌島・世界</title>'],
  ['privacy.html', 'Privacy Policy'],
  ['terms.html', 'Terms of Use'],
  ['app-support.html', 'App Support']
];

const failures = [];
for (const [path, marker] of checks) {
  const url = new URL(path, baseUrl);
  url.searchParams.set('submission-check', Date.now().toString());
  const displayUrl = `${url.origin}${url.pathname}`;
  try {
    const response = await fetch(url, {
      headers: { 'cache-control': 'no-cache', 'user-agent': 'RailIslandWorldSubmissionCheck/1.0' },
      redirect: 'follow'
    });
    const body = await response.text();
    const contentType = response.headers.get('content-type') || '';
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (!contentType.includes('text/html')) throw new Error(`不是 HTML（${contentType || '無 Content-Type'}）`);
    if (!body.includes(marker)) throw new Error(`找不到預期內容「${marker}」`);
    if (/Page not found|There isn't a GitHub Pages site here/i.test(body)) throw new Error('顯示託管平台錯誤頁');
    console.log(`PASS ${displayUrl} · ${response.status}`);
  } catch (error) {
    failures.push(`${displayUrl} · ${error.message}`);
    console.error(`FAIL ${displayUrl} · ${error.message}`);
  }
}

if (failures.length) throw new Error(`送審公開網址尚未就緒：\n- ${failures.join('\n- ')}`);
console.log('公開首頁、隱私、條款與支援網址均可供商店審核讀取');
