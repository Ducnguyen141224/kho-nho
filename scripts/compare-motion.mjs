import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { preview } from 'vite';

const manifest = JSON.parse(await readFile(new URL('../evidence/asset-manifest.json', import.meta.url)));
const original = manifest.source;
const local = 'http://127.0.0.1:4179';
const server = await preview({ preview: { host: '127.0.0.1', port: 4179, strictPort: true } });
const report = { source: original, webflowBundleIdentical: false, viewports: [], templatePages: [] };
const viewportSizes = [[1440, 900], [820, 900], [600, 850], [390, 844]];
let browser;

function observeMotion() {
  const entries = [];
  const startup = [];
  const cssAnimations = new Set();
  let phase = 'startup';
  let start;
  let logosStart;
  const selectors = ['.navbar', '.animate-on-load-01', '.animate-on-load-02', '.hero-section-phone-holder-2', '.blured-bg', '.reviews-logos-container'];
  document.addEventListener('ix2-animation-started', event => {
    const instance = window.Webflow?.require('ix2')?.store.getState().ixInstances[event.detail];
    if (!instance?.eventId || instance.immediate) return;
    if (instance.eventId === 'e-3') start ??= performance.now();
    if (instance.eventId === 'e-4') logosStart ??= performance.now();
    entries.push({ phase, event: instance.eventId, action: instance.actionItem.id, key: instance.eventStateKey ?? '', time: performance.now() });
  }, true);
  function capture(now) {
    if (!start || now < start || !document.querySelector(selectors[1])) {
      if (now > 10000) return;
      requestAnimationFrame(capture);
      return;
    }
    const t = now - start;
    if (t > 3400) return;
    const values = selectors.map(selector => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const style = getComputedStyle(el);
      const matrix = new DOMMatrixReadOnly(style.transform === 'none' ? undefined : style.transform);
      return { opacity: +style.opacity, blur: +(style.filter.match(/blur\(([\d.]+)/)?.[1] ?? 0), x: matrix.m41 };
    });
    for (const animation of document.getAnimations()) {
      if (animation.animationName) cssAnimations.add(animation.animationName);
    }
    startup.push({ t, values });
    requestAnimationFrame(capture);
  }
  requestAnimationFrame(capture);
  window.motionProbe = {
    phase: name => { phase = name; },
    read: () => ({ entries, startup, logosOffset: logosStart - start, cssAnimations: [...cssAnimations].sort() }),
  };
}

async function openPage(origin, route, viewport) {
  const page = await browser.newPage({ viewport, reducedMotion: 'no-preference' });
  await page.addInitScript(observeMotion);
  await page.goto(origin + route, { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => window.Webflow?.require('ix2')?.store.getState().ixSession.active, undefined, { timeout: 10000 });
  if (origin === local) await page.waitForFunction(() => document.documentElement.dataset.runtime === 'ready');
  await page.evaluate(() => document.fonts.ready);
  return page;
}

async function pageState(page) {
  return page.evaluate(() => {
    const { ixData, ixSession } = Webflow.require('ix2').store.getState();
    const active = Object.values(ixData.events).filter(event => event.mediaQueries.includes(ixSession.mediaQueryKey));
    const matching = active.map(event => {
      const { id, selector } = event.target;
      const [pageId, element] = id?.split('|') ?? [];
      const count = selector ? document.querySelectorAll(selector).length : pageId !== document.documentElement.dataset.wfPage ? 0 : element ? document.querySelectorAll(`[data-w-id="${element}"]`).length : 1;
      return [event.id, count];
    }).filter(([, count]) => count > 0);
    return { breakpoint: ixSession.mediaQueryKey, matching, height: document.documentElement.scrollHeight, data: JSON.stringify(ixData) };
  });
}

async function tour(page, mobile, route) {
  await page.waitForTimeout(route === '/' ? 3500 : 300);
  const motions = await page.evaluate(async () => {
    window.motionProbe.phase('scroll');
    const positions = [];
    const step = Math.round(innerHeight * 0.38);
    const selectors = ['.hero-phone-holder', '.collaborate-image', '.sticky-phone', '.pricing-table._01', '.cta-phone-holder'];
    for (let y = 0; y <= document.documentElement.scrollHeight - innerHeight + step; y += step) {
      scrollTo({ top: y, behavior: 'instant' });
      await new Promise(resolve => setTimeout(resolve, 155));
      positions.push({ scroll: scrollY, styles: selectors.map(selector => {
        const el = document.querySelector(selector);
        if (!el) return null;
        const { transform, opacity } = getComputedStyle(el);
        const matrix = new DOMMatrixReadOnly(transform === 'none' ? undefined : transform);
        return [matrix.m41, matrix.m42, +opacity];
      }) });
    }
    return positions;
  });
  await page.waitForTimeout(1750);
  const settledHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  let tabs;
  let menu;
  if (route === '/') {
    await page.evaluate(() => window.motionProbe.phase('pricing-tabs'));
    const readTab = async label => {
      const control = page.getByRole('tab', { name: label });
      await control.click({ timeout: 8000 });
      await page.waitForFunction(name => document.querySelector('.w-tab-link[aria-selected="true"]')?.innerText.trim() === name, label);
      const pane = page.getByRole('tabpanel', { name: label });
      await pane.waitFor();
      return (await pane.innerText()).match(/\$\d+/g);
    };
    tabs = { monthly: await readTab('Monthly'), annually: await readTab('Annually') };
    await page.evaluate(() => { window.motionProbe.phase('navigation'); scrollTo({ top: 0, behavior: 'instant' }); });
    if (mobile) {
      const button = page.locator('.w-nav-button');
      await button.click();
      await page.waitForFunction(() => document.querySelector('.w-nav-button').getAttribute('aria-expanded') === 'true');
      const config = await page.locator('.w-nav').first().evaluate(el => ({ animation: el.dataset.animation, duration: el.dataset.duration, easing: el.dataset.easing, easing2: el.dataset.easing2 }));
      await page.locator('.w-nav-menu .w-nav-link[href="#Pricing"]').click();
      await page.waitForFunction(() => document.querySelector('.w-nav-button').getAttribute('aria-expanded') === 'false');
      menu = { config, hash: new URL(page.url()).hash };
    } else {
      const link = page.locator('.w-nav-link[href="#Features"]');
      await page.waitForFunction(() => scrollY === 0);
      await link.hover();
      await page.waitForTimeout(1000);
      const hoverBackground = await link.evaluate(el => getComputedStyle(el).backgroundColor);
      await link.click();
      await page.waitForURL('**/#Features');
      await page.waitForFunction(() => Math.abs(document.querySelector('#Features').getBoundingClientRect().top) < 2);
      menu = { hoverBackground, hash: new URL(page.url()).hash };
    }
  }
  return { ...await page.evaluate(() => window.motionProbe.read()), motions, settledHeight, tabs, menu };
}

function compare(a, b, route, width) {
  const keys = trace => new Set(trace.entries.map(item => [item.event, item.action, item.key].join(':')));
  const originalKeys = keys(a.trace);
  const localKeys = keys(b.trace);
  const eventIds = trace => [...new Set(trace.entries.map(entry => entry.event))].sort();
  const originalOnly = [...originalKeys].filter(key => !localKeys.has(key));
  const localOnly = [...localKeys].filter(key => !originalKeys.has(key));
  const counts = trace => Object.fromEntries(eventIds(trace).map(id => [id, trace.entries.filter(entry => entry.event === id).length]));
  const aCounts = counts(a.trace);
  const bCounts = counts(b.trace);
  const repeatDifferences = [...new Set([...Object.keys(aCounts), ...Object.keys(bCounts)])].filter(id => (aCounts[id] ?? 0) !== (bCounts[id] ?? 0)).map(id => ({ id, original: aCounts[id] ?? 0, local: bCounts[id] ?? 0 }));
  const nearest = (samples, t) => samples.reduce((best, candidate) => Math.abs(candidate.t - t) < Math.abs(best.t - t) ? candidate : best);
  const startup = a.trace.startup.length && b.trace.startup.length ? [100, 400, 800, 1400, 2200, 3200].map(t => {
    const left = nearest(a.trace.startup, t).values;
    const right = nearest(b.trace.startup, t).values;
    return { t, maxOpacityDelta: +Math.max(...left.map((value, i) => Math.abs((value?.opacity ?? 0) - (right[i]?.opacity ?? 0)))).toFixed(3), maxBlurDelta: +Math.max(...left.map((value, i) => Math.abs((value?.blur ?? 0) - (right[i]?.blur ?? 0)))).toFixed(3), logoXDelta: +Math.abs((left[5]?.x ?? 0) - (right[5]?.x ?? 0)).toFixed(3) };
  }) : [];
  const logoOffsets = [a.trace.logosOffset, b.trace.logosOffset].map(Math.round);
  const logoPhaseDelta = startup.length ? [500, 1200, 2000].map(t => {
    const left = nearest(a.trace.startup, t + a.trace.logosOffset).values[5].x;
    const right = nearest(b.trace.startup, t + b.trace.logosOffset).values[5].x;
    return { t, deltaPx: +Math.abs(left - right).toFixed(3) };
  }) : [];
  const menuMatch = JSON.stringify(a.trace.menu) === JSON.stringify(b.trace.menu);
  const matchingScroll = a.trace.motions.flatMap(left => {
    const right = b.trace.motions.find(candidate => candidate.scroll === left.scroll);
    return right ? [[left, right]] : [];
  });
  const scrollMotion = ['heroPhone', 'featureImage', 'stickyPhone', 'pricingCard', 'ctaPhone'].map((target, index) => {
    const samples = matchingScroll.map(([left, right]) => [left.styles[index], right.styles[index]]).filter(([left, right]) => left && right);
    if (!samples.length) return null;
    const xYDelta = ([left, right]) => Math.hypot(left[0] - right[0], left[1] - right[1]);
    return {
      target,
      samples: samples.length,
      maxTranslateDeltaPx: +Math.max(...samples.map(xYDelta)).toFixed(2),
      maxOpacityDelta: +Math.max(...samples.map(([left, right]) => Math.abs(left[2] - right[2]))).toFixed(3),
    };
  }).filter(Boolean);
  return {
    route, width, breakpoint: a.state.breakpoint,
    matchingEvents: a.state.matching.map(([id]) => id), observedEvents: eventIds(a.trace),
    targetCountsMatch: JSON.stringify(a.state.matching) === JSON.stringify(b.state.matching),
    configMatch: a.state.data === b.state.data,
    initialPageHeightDelta: a.state.height - b.state.height,
    settledPageHeightDelta: a.trace.settledHeight - b.trace.settledHeight,
    originalOnly, localOnly, repeatDifferences, startup, logoOffsets, logoPhaseDelta,
    scrollMotion,
    cssAnimationsMatch: JSON.stringify(a.trace.cssAnimations) === JSON.stringify(b.trace.cssAnimations),
    tabsMatch: JSON.stringify(a.trace.tabs) === JSON.stringify(b.trace.tabs), menuMatch,
    ...(!menuMatch ? { originalMenu: a.trace.menu, localMenu: b.trace.menu } : {}),
  };
}

async function compareRoute(route, width, height) {
  const viewport = { width, height };
  const pages = await Promise.all([openPage(original, route, viewport), openPage(local, route, viewport)]);
  try {
    const states = await Promise.all(pages.map(pageState));
    const traces = await Promise.all(pages.map(page => tour(page, width < 992, route)));
    return compare({ state: states[0], trace: traces[0] }, { state: states[1], trace: traces[1] }, route, width);
  } finally { await Promise.all(pages.map(page => page.close())); }
}

try {
  const originalBundle = manifest.assets.find(asset => /\/webflow\.[\w]+\.js$/.test(asset.url));
  const remote = await fetch(originalBundle.url);
  if (!remote.ok) throw new Error(`Reference bundle returned ${remote.status}`);
  const [a, b] = [Buffer.from(await remote.arrayBuffer()), await readFile(new URL(`../public${originalBundle.local}`, import.meta.url))];
  report.webflowBundleSha256 = createHash('sha256').update(a).digest('hex');
  report.webflowBundleIdentical = a.equals(b);
  const stylesheet = manifest.assets.find(asset => /\/ovo-messenger\.webflow\..+\.css$/.test(asset.url));
  const cssResponse = await fetch(stylesheet.url);
  if (!cssResponse.ok) throw new Error(`Reference stylesheet returned ${cssResponse.status}`);
  const cssWithoutUrls = css => css.replace(/url\(\s*(['"]?)[^'"\s)]+\1\s*\)/g, 'url()');
  const [originalCss, localCss] = await Promise.all([cssResponse.text(), readFile(new URL(`../public${stylesheet.local}`, import.meta.url), 'utf8')]);
  report.webflowStylesIdenticalExceptAssetUrls = cssWithoutUrls(originalCss) === cssWithoutUrls(localCss);
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
  for (const [width, height] of viewportSizes) {
    const result = await compareRoute('/', width, height);
    report.viewports.push(result);
    console.log(JSON.stringify({ route: result.route, width, matchingEvents: result.matchingEvents.length, observedEvents: result.observedEvents.length, onlyOriginal: result.originalOnly.length, onlyLocal: result.localOnly.length, initialPageHeightDelta: result.initialPageHeightDelta, settledPageHeightDelta: result.settledPageHeightDelta, tabsMatch: result.tabsMatch, menuMatch: result.menuMatch }));
  }
  for (const { route } of manifest.pages.filter(page => page.route !== '/')) {
    const result = await compareRoute(route, 1440, 900);
    report.templatePages.push(result);
    console.log(JSON.stringify({ route, configMatch: result.configMatch, settledPageHeightDelta: result.settledPageHeightDelta, matchingEvents: result.matchingEvents, observedEvents: result.observedEvents }));
  }
  const output = new URL('../evidence/checks/', import.meta.url);
  await mkdir(output, { recursive: true });
  await writeFile(new URL('motion-comparison.json', output), JSON.stringify(report, null, 2) + '\n');
} finally {
  await browser?.close();
  server.httpServer.close();
}
