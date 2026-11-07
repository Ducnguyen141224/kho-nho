import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { PNG } from 'pngjs';
import { preview } from 'vite';

const compare = process.argv.includes('--compare');
const output = new URL('../evidence/checks/', import.meta.url);
await mkdir(output, { recursive: true });
const manifest = JSON.parse(await readFile(new URL('../evidence/asset-manifest.json', import.meta.url)));
const server = await preview({ preview: { host: '127.0.0.1', port: 4178, strictPort: true } });
const local = 'http://127.0.0.1:4178';
const results = { routes: [], screenshots: [], assets: manifest.assets.length };
let browser;

function comparePixels(a, b) {
  const left = PNG.sync.read(a);
  const right = PNG.sync.read(b);
  assert.equal(left.width, right.width);
  assert.equal(left.height, right.height);
  let changed = 0;
  let delta = 0;
  for (let i = 0; i < left.data.length; i += 4) {
    const distance = Math.abs(left.data[i] - right.data[i]) + Math.abs(left.data[i + 1] - right.data[i + 1]) + Math.abs(left.data[i + 2] - right.data[i + 2]);
    if (distance > 12) changed++;
    delta += distance;
  }
  const pixels = left.width * left.height;
  return { changedPercent: +(100 * changed / pixels).toFixed(2), meanChannelDelta: +(delta / (3 * pixels)).toFixed(3) };
}

async function ready(page, url, isLocal = true) {
  const response = await page.goto(url, { waitUntil: 'load' });
  assert.equal(response.status(), 200);
  await page.waitForFunction(() => !!window.Webflow?.require('ix2')?.store.getState().ixSession.active);
  if (isLocal) await page.waitForFunction(() => document.documentElement.dataset.runtime === 'ready');
  await page.evaluate(() => document.fonts.ready);
}

async function prices(page, tab, expected) {
  const control = page.getByRole('tab', { name: tab });
  await control.click();
  await page.waitForFunction(name => document.querySelector('.w-tab-link[aria-selected="true"]')?.innerText.trim() === name, tab);
  const active = page.getByRole('tabpanel', { name: tab });
  await active.waitFor({ state: 'visible' });
  assert.deepEqual((await active.innerText()).match(/\$\d+/g), expected);
}

try {
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
  const viewport = { width: 1440, height: 900 };
  const page = await browser.newPage({ viewport });
  const external = [];
  const errors = [];
  page.on('request', request => { if (!request.url().startsWith(local) && /^https?:/.test(request.url())) external.push(request.url()); });
  page.on('pageerror', error => errors.push(error.message));
  page.on('requestfailed', request => { if (request.failure()?.errorText !== 'net::ERR_ABORTED') errors.push(`${request.url()} ${request.failure()?.errorText}`); });
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });

  for (const { route } of manifest.pages) {
    await ready(page, local + route);
    results.routes.push({ route, title: await page.title() });
  }

  for (const size of [viewport, { width: 390, height: 844 }]) {
    const clonePage = await browser.newPage({ viewport: size });
    await ready(clonePage, local + '/');
    assert.equal(await clonePage.locator('h1').innerText(), 'Say Hello 👋');
    await clonePage.waitForTimeout(1700);
    const clone = await clonePage.screenshot();
    await writeFile(new URL(`local-${size.width}.png`, output), clone);
    await clonePage.close();
    if (compare) {
      const original = await browser.newPage({ viewport: size });
      await ready(original, `${manifest.source}/`, false);
      await original.waitForTimeout(1700);
      const reference = await original.screenshot();
      await writeFile(new URL(`original-${size.width}.png`, output), reference);
      await original.close();
      results.screenshots.push({ width: size.width, ...comparePixels(reference, clone) });
    }
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page, local + '/');
  const mobileMenu = page.getByRole('button', { name: 'menu' });
  await mobileMenu.click();
  await page.waitForFunction(() => document.querySelector('.w-nav-button')?.getAttribute('aria-expanded') === 'true');
  await page.locator('.w-nav-menu .w-nav-link[href="#Pricing"]').click();
  await page.waitForURL('**/#Pricing');
  await page.waitForFunction(() => document.querySelector('.w-nav-button')?.getAttribute('aria-expanded') === 'false');
  await prices(page, 'Monthly', ['$0', '$12', '$16']);
  await prices(page, 'Annually', ['$0', '$3', '$8']);

  await page.getByRole('link', { name: 'Licensing', exact: true }).click();
  await page.waitForURL('**/template/licensing');
  await page.waitForFunction(() => document.documentElement.dataset.runtime === 'ready');
  await ready(page, `${local}/#Power`);
  await page.waitForFunction(() => Math.abs(document.getElementById('Power').getBoundingClientRect().top) < 150);

  await page.setViewportSize(viewport);
  await ready(page, local + '/');
  const heroPhone = page.locator('.hero-phone-holder').first();
  const originalTransform = await heroPhone.evaluate(el => getComputedStyle(el).transform);
  await page.evaluate(() => window.scrollTo(0, 360));
  await page.waitForFunction(transform => getComputedStyle(document.querySelector('.hero-phone-holder')).transform !== transform, originalTransform);
  const feature = page.locator('.collaborante-image-holder').first();
  const featureChild = feature.locator('.collaborate-image').first();
  const beforeReveal = await featureChild.evaluate(el => getComputedStyle(el).transform);
  await feature.scrollIntoViewIfNeeded();
  await page.waitForFunction(transform => getComputedStyle(document.querySelector('.collaborante-image-holder .collaborate-image')).transform !== transform, beforeReveal);
  results.interactions = ['mobile navbar', 'anchor scrolling', 'monthly and annual tabs', 'template navigation', 'direct anchor', 'hero scroll transform', 'feature reveal on scroll'];

  const form = page.getByRole('form', { name: 'Early Access Emails' });
  await form.getByRole('textbox').fill('demo@example.com');
  await form.getByRole('button').click();
  await page.getByText('Demo: your email was saved in this browser only. No email was sent.').waitFor();
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('khonho-demo-signups'))[0].email), 'demo@example.com');
  results.interactions.push('local demo form');
  assert.deepEqual(errors, []);
  assert.deepEqual(external, []);
  results.errors = errors;
  results.externalRequests = external;
  console.log(JSON.stringify(results, null, 2));
  await writeFile(new URL('results.json', output), JSON.stringify(results, null, 2) + '\n');
} finally {
  await browser?.close();
  server.httpServer.close();
}
