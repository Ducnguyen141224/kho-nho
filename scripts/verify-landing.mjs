import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { preview } from 'vite';

const release = JSON.parse(await readFile(new URL('../src/content/kho-nho-release.json', import.meta.url)));
const server = await preview({ preview: { host: '127.0.0.1', port: 4180, strictPort: true } });
const origin = 'http://127.0.0.1:4180';
const evidence = new URL('../evidence/checks/kho-nho/', import.meta.url);
const results = [];
let browser;
await mkdir(evidence, { recursive: true });

try {
  browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  });
  for (const width of [1440, 820, 600, 390, 320]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      window.animationEvents = new Set();
      document.addEventListener('ix2-animation-started', event => {
        const instance = window.Webflow?.require('ix2').store.getState().ixInstances[event.detail];
        if (instance?.eventId && !instance.immediate) window.animationEvents.add(instance.eventId);
      }, true);
    });
    await page.goto(origin);
    await page.waitForFunction(() => document.documentElement.dataset.runtime === 'ready');
    assert.equal(await page.locator('h1').innerText(), 'Kho Nhỏ');
    assert.equal(await page.locator('html').getAttribute('lang'), 'vi');
    assert.equal(await page.evaluate(() => document.body.scrollWidth <= innerWidth), true);
    assert.deepEqual(await page.locator('.apk-button').evaluateAll(nodes => nodes.map(node => node.href)), [release.url, release.url]);
    await page.waitForFunction(() => window.animationEvents.has('e-3') && window.animationEvents.has('e-4'));
    await page.waitForTimeout(1500);
    if (width === 1440 || width === 390) await page.screenshot({ path: fileURLToPath(new URL(`hero-${width}.png`, evidence)) });

    if (width < 992) {
      const menu = page.getByRole('button', { name: 'menu' });
      await menu.click();
      await page.waitForFunction(() => document.querySelector('.w-nav-button').getAttribute('aria-expanded') === 'true');
      await page.getByRole('navigation').getByRole('link', { name: 'Cài đặt' }).click();
      await page.waitForURL('**/#Pricing');
      await page.waitForFunction(() => document.querySelector('.w-nav-button').getAttribute('aria-expanded') === 'false');
    }
    await page.getByRole('tab', { name: 'Cập nhật' }).click();
    await page.getByRole('tabpanel', { name: 'Cập nhật' }).getByText('Cài đè', { exact: true }).waitFor();
    await page.getByRole('tab', { name: 'Cài lần đầu' }).click();
    await page.getByRole('tabpanel', { name: 'Cài lần đầu' }).getByText('Tải tệp', { exact: true }).waitFor();
    await page.locator('#apk-download .apk-button').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => window.animationEvents.has('e-108'));
    if (width === 1440 || width === 390) {
      await page.waitForFunction(() => getComputedStyle(document.querySelector('.cta-phone-holder')).opacity === '1');
      await page.screenshot({ path: fileURLToPath(new URL(`download-${width}.png`, evidence)) });
    }

    await page.locator('#Features').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => window.animationEvents.has('e-102'));
    await page.locator('.collaborante-image-holder').first().scrollIntoViewIfNeeded();
    await page.waitForFunction(() => window.animationEvents.has('e-98'));
    const assets = await page.locator('.captured-page img').evaluateAll(nodes => Promise.all(nodes.map(async node => {
      node.loading = 'eager';
      await node.decode();
      return node.naturalWidth;
    })));
    assert.equal(assets.length, 10);
    assert.ok(assets.every(width => width > 0));
    assert.deepEqual(errors, []);
    results.push({ width, images: assets.length, events: await page.evaluate(() => [...window.animationEvents].sort()) });
    await page.close();
    console.log(`Verified viewport ${width}px`);
  }

  const apk = await fetch(release.url, { headers: { Range: 'bytes=0-3' }, signal: AbortSignal.timeout(20000) });
  assert.equal(apk.status, 206);
  assert.equal(apk.headers.get('content-range'), `bytes 0-3/${release.bytes}`);
  assert.equal(Buffer.from(await apk.arrayBuffer()).toString('hex'), '504b0304');
  await writeFile(new URL('results.json', evidence), JSON.stringify({ viewports: results, apkBytes: release.bytes, apkVersion: release.version }, null, 2) + '\n');
} finally {
  await browser?.close();
  server.httpServer.close();
}
