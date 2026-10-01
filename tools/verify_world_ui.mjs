#!/usr/bin/env node
const baseUrl = process.argv[2] || 'http://127.0.0.1:5188/';
const playwrightModule = process.env.RAIL_WORLD_PLAYWRIGHT || 'playwright';
const { chromium, webkit } = await import(playwrightModule);
const widths = [360, 375, 414, 768];
const failures = [];

function fail(engine, message) {
  failures.push(`${engine}: ${message}`);
}

for (const [engine, browserType] of [['chromium', chromium], ['webkit', webkit]]) {
  const browser = await browserType.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 375, height: 780 },
    isMobile: true,
    hasTouch: true,
    locale: 'zh-TW',
  });
  const page = await context.newPage();
  const pageErrors = [];
  const requests = [];
  page.on('pageerror', error => pageErrors.push(error.stack || String(error)));
  page.on('request', request => requests.push(request.url()));
  await page.goto(new URL('?lang=zh-TW', baseUrl).href, { waitUntil: 'domcontentloaded' });
  try {
    await page.waitForSelector('html[data-world-ready="1"]', { timeout: 30000 });
  } catch (error) {
    const state = await page.evaluate(() => ({
      href: location.href,
      activeSystem: document.documentElement.dataset.activeSystem || '',
      note: document.getElementById('note')?.textContent || '',
    })).catch(() => ({}));
    throw new Error(`${engine} 開機逾時：${JSON.stringify(state)}；page errors=${pageErrors.join(' | ') || 'none'}`, { cause: error });
  }
  if (!(await page.locator('#howtoWrap').isVisible())) {
    fail(engine, '全新安裝未顯示首訪說明卡');
  } else {
    const expectedHowto = {
      'zh-TW': ['世界版怎麼玩', '並非即時'],
      en: ['How to use Rail Island World', 'not live'],
      ja: ['軌島・世界の使い方', 'リアルタイムではありません'],
    };
    for (const [lang, expected] of Object.entries(expectedHowto)) {
      await page.evaluate(value => window.__i18n.setLanguage(value), lang);
      const text = await page.locator('#howtoWrap').innerText();
      if (!expected.every(value => text.includes(value))) fail(engine, `${lang} 首訪說明不符：${text.replaceAll('\n', ' / ')}`);
    }
    await page.evaluate(() => window.__i18n.setLanguage('zh-TW'));
    await page.tap('#howtoGo');
  }

  for (const width of widths) {
    await page.setViewportSize({ width, height: 780 });
    await page.waitForTimeout(150);
    const audit = await page.evaluate(() => {
      const visibleRect = element => {
        const raw = element.getBoundingClientRect();
        const rect = { left: Math.max(0, raw.left), top: Math.max(0, raw.top), right: Math.min(innerWidth, raw.right), bottom: Math.min(innerHeight, raw.bottom) };
        for (let parent = element.parentElement; parent && parent !== document.documentElement; parent = parent.parentElement) {
          const style = getComputedStyle(parent), box = parent.getBoundingClientRect();
          if (/^(hidden|clip|scroll|auto)$/.test(style.overflowX)) {
            rect.left = Math.max(rect.left, box.left); rect.right = Math.min(rect.right, box.right);
          }
          if (/^(hidden|clip|scroll|auto)$/.test(style.overflowY)) {
            rect.top = Math.max(rect.top, box.top); rect.bottom = Math.min(rect.bottom, box.bottom);
          }
        }
        return rect;
      };
      const visible = [...document.querySelectorAll('button,input,select,a[href]')].filter(element => {
        const style = getComputedStyle(element), rect = visibleRect(element);
        return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) !== 0 &&
          style.pointerEvents !== 'none' && rect.right > rect.left && rect.bottom > rect.top;
      });
      const rows = visible.map(element => {
        const rect = visibleRect(element);
        const x = Math.max(0, Math.min(innerWidth - 1, (rect.left + rect.right) / 2));
        const y = Math.max(0, Math.min(innerHeight - 1, (rect.top + rect.bottom) / 2));
        const hit = document.elementFromPoint(x, y);
        return {
          label: (element.getAttribute('aria-label') || element.title || element.textContent || element.id).trim().slice(0, 40),
          rect: [rect.left, rect.top, rect.right, rect.bottom],
          reachable: Boolean(hit && (hit === element || element.contains(hit))),
        };
      });
      const collisions = [];
      for (let i = 0; i < rows.length; i++) for (let j = i + 1; j < rows.length; j++) {
        const a = rows[i].rect, b = rows[j].rect;
        if (Math.min(a[2], b[2]) - Math.max(a[0], b[0]) > 2 && Math.min(a[3], b[3]) - Math.max(a[1], b[1]) > 2)
          collisions.push(`${rows[i].label} × ${rows[j].label}`);
      }
      const city = document.querySelector('#topTabs .world-citysel');
      const cityRect = city && city.getBoundingClientRect();
      return {
        overflowX: document.documentElement.scrollWidth - innerWidth,
        unreachable: rows.filter(row => !row.reachable).map(row => row.label),
        collisions,
        cityReachable: Boolean(cityRect && cityRect.width >= 44 && cityRect.height >= 36),
      };
    });
    if (audit.overflowX > 0) fail(engine, `${width}px 水平溢出 ${audit.overflowX}px`);
    if (audit.unreachable.length) fail(engine, `${width}px 點不到：${audit.unreachable.join(', ')}`);
    if (audit.collisions.length) fail(engine, `${width}px 控件重疊：${audit.collisions.join(', ')}`);
    if (!audit.cityReachable) fail(engine, `${width}px 城市選單觸控面積不足`);
    // 2026-09 起台灣版手機頂列把播放鍵收進時鐘膠囊;看得到才按(桌面寬度仍在)
    if (await page.locator('#pp').isVisible()) {
      await page.tap('#pp');
      await page.tap('#pp');
    }
  }

  await page.setViewportSize({ width: 375, height: 780 });
  await page.tap('#topTabs .world-citysel');
  await page.selectOption('#topTabs .world-citysel', 'tokyo_sched');
  await page.waitForSelector('html[data-active-system="tokyo_sched"]', { timeout: 30000 });
  const cityResult = await page.evaluate(() => ({
    system: document.documentElement.dataset.activeSystem,
    trains: Number(document.documentElement.dataset.trainCount),
    selected: document.querySelector('#topTabs .world-citysel')?.value,
    left: document.querySelector('#plateL')?.textContent,
    right: document.querySelector('#plateR')?.textContent,
  }));
  if (cityResult.system !== 'tokyo_sched' || cityResult.selected !== 'tokyo_sched' || cityResult.trains !== 28640 ||
      cityResult.left !== '奥多摩' || cityResult.right !== '葛西臨海公園')
    fail(engine, `東京切換結果不符：${JSON.stringify(cityResult)}`);
  const ofmOnly = await page.evaluate(() => window.RAIL_APP_CONFIG?.ofmOnly === true);
  if (ofmOnly) {
    const unexpected = requests.filter(url => /\/api\/basemap-(?:src|token|session)|arcgis\.com|stadiamaps\.com|cartocdn\.com/i.test(url));
    if (unexpected.length) fail(engine, `OFM-only App 仍發出其他底圖請求：${[...new Set(unexpected)].join(', ')}`);
  }
  const desktopTaiwanHref = await page.locator('#taiwanAppLink').getAttribute('href');
  if (desktopTaiwanHref !== 'https://railisland.tw') fail(engine, `桌面台灣版入口不符：${desktopTaiwanHref}`);

  const platformCase = engine === 'webkit'
    ? {
        name: 'iOS',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
        expected: 'https://apps.apple.com/tw/app/id6792673516'
      }
    : {
        name: 'Android',
        userAgent: 'Mozilla/5.0 (Linux; Android 16; Pixel 9) AppleWebKit/537.36 Chrome/139.0 Mobile Safari/537.36',
        expected: 'https://play.google.com/store/apps/details?id=tw.railisland.app'
      };
  const linkContext = await browser.newContext({
    viewport: { width: 375, height: 780 },
    isMobile: true,
    hasTouch: true,
    locale: 'zh-TW',
    userAgent: platformCase.userAgent
  });
  const linkPage = await linkContext.newPage();
  await linkPage.goto(new URL('app-support.html?lang=zh-TW', baseUrl).href, { waitUntil: 'domcontentloaded' });
  const supportLinks = await linkPage.locator('[data-rail-island-link]').evaluateAll(links => links.map(link => link.href));
  if (supportLinks.length !== 3 || supportLinks.some(href => href !== platformCase.expected)) {
    fail(engine, `${platformCase.name} 支援頁台灣版入口不符：${supportLinks.join(', ')}`);
  }
  await linkContext.close();
  if (pageErrors.length) fail(engine, `pageerror：${pageErrors.join(' | ')}`);
  console.log(`✓ ${engine}: 4 widths、真實 tap、東京懶載入、${platformCase.name} 台灣版入口`);
  await browser.close();
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('✓ 世界版手機／觸控／雙引擎驗收通過');
