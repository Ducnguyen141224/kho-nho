import { load } from 'cheerio';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const origin = 'https://ovo-messenger.webflow.io';
const out = path.join(root, 'public/assets');
const originals = path.join(root, 'evidence/original-pages');
await Promise.all([mkdir(out, { recursive: true }), mkdir(originals, { recursive: true }), mkdir(path.join(root, 'src/content'), { recursive: true })]);
const assets = new Map();
const pages = new Map();
const failures = [];
const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const digest = data => createHash('sha256').update(data).digest('hex');

async function get(url) {
  let error;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { headers: { 'User-Agent': ua }, signal: AbortSignal.timeout(45000) });
      if (!response.ok) throw new Error(`${response.status} ${url}`);
      return { bytes: Buffer.from(await response.arrayBuffer()), type: response.headers.get('content-type') || '' };
    } catch (err) { error = err; }
  }
  throw error;
}

function assetUrl(value, base) {
  if (!value || /^(data:|blob:|#|mailto:|tel:)/i.test(value)) return null;
  try {
    const url = new URL(value, base);
    return /^(https?:)$/.test(url.protocol) ? url.href : null;
  } catch { return null; }
}

function register(value, base) {
  const url = assetUrl(value, base);
  if (!url) return;
  if (!assets.has(url)) {
    const parsed = new URL(url);
    let name = decodeURIComponent(parsed.pathname.split('/').pop() || 'asset').replace(/[^\w.-]/g, '-');
    if (!path.extname(name)) name += parsed.hostname === 'fonts.googleapis.com' ? '.css' : '.bin';
    name = `${digest(url).slice(0, 10)}-${name}`;
    assets.set(url, { url, local: `/assets/${name}`, file: path.join(out, name), downloaded: false });
  }
}

function scanCss(css, base) {
  for (const match of css.matchAll(/url\(\s*['"]?([^'"\s)]+)['"]?\s*\)/g)) register(match[1], base);
  for (const match of css.matchAll(/@import\s+['"]([^'"]+)['"]/g)) register(match[1], base);
}

async function crawl(route) {
  if (pages.has(route)) return;
  const url = origin + route;
  const { bytes } = await get(url);
  const html = bytes.toString('utf8');
  const $ = load(html);
  const page = { route, url, html, $, sha256: digest(bytes) };
  pages.set(route, page);
  console.log(`PAGE ${route}`);
  await writeFile(path.join(originals, route === '/' ? 'home.html' : route.slice(1).replaceAll('/', '-') + '.html'), html);
  const fontMatch = html.match(/families:\s*(\[[^\]]+\])/);
  if (fontMatch) {
    const families = JSON.parse(fontMatch[1]);
    const fontUrl = 'https://fonts.googleapis.com/css?family=' + families.join('%7C');
    $('<link rel="stylesheet">').attr('href', fontUrl).appendTo('head');
  }
  $('img,source,video,audio,script[src],link').each((_, el) => {
    const node = $(el);
    for (const attr of ['src', 'poster']) if (node.attr(attr)) register(node.attr(attr), url);
    if (el.tagName === 'link' && /stylesheet|icon/.test(node.attr('rel') || '')) register(node.attr('href'), url);
    if (node.attr('srcset')) for (const item of node.attr('srcset').split(',')) register(item.trim().split(/\s+/)[0], url);
  });
  $('[style],style').each((_, el) => scanCss($(el).attr('style') || $(el).text(), url));
  // Webflow/Lottie resources can be referenced by data attributes or script config.
  for (const match of html.matchAll(/https:\/\/[^\s"'<>]+\.(?:json|mp4|webm|woff2?|ttf|otf)(?:\?[^\s"'<>]*)?/g)) register(match[0], url);
  const routes = new Set();
  $('a[href]').each((_, el) => {
    const value = $(el).attr('href');
    const dest = assetUrl(value, url);
    if (!dest) return;
    const u = new URL(dest);
    if (u.origin === origin && u.pathname !== route && !path.extname(u.pathname)) routes.add(u.pathname.replace(/\/$/, '') || '/');
  });
  for (const next of routes) await crawl(next);
}

await crawl('/');
// Also retain published sitemap routes, including pages absent from the nav.
try {
  const sitemap = (await get(origin + '/sitemap.xml')).bytes.toString('utf8');
  await writeFile(path.join(root, 'evidence/sitemap.xml'), sitemap);
  for (const [, location] of sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const u = new URL(location);
    if (u.origin === origin && !path.extname(u.pathname)) await crawl(u.pathname.replace(/\/$/, '') || '/');
  }
} catch (error) { console.log(`Sitemap unavailable: ${error.message}`); }

// Dependencies discovered in CSS are downloaded in subsequent passes.
while ([...assets.values()].some(asset => !asset.downloaded)) {
  const pending = [...assets.values()].filter(asset => !asset.downloaded);
  let index = 0;
  await Promise.all(Array.from({ length: Math.min(6, pending.length) }, async () => {
    while (index < pending.length) {
      const asset = pending[index++];
      asset.downloaded = true;
      try {
        const { bytes, type } = await get(asset.url);
        asset.bytes = bytes;
        asset.type = type;
        asset.sha256 = digest(bytes);
        if (/css/i.test(type) || asset.file.endsWith('.css')) scanCss(bytes.toString('utf8'), asset.url);
        console.log(`ASSET ${asset.local} (${bytes.length})`);
      } catch (error) {
        asset.failed = true;
        failures.push({ url: asset.url, error: error.message });
      }
    }
  }));
}

function localize(text, base) {
  return text.replace(/url\(\s*(['"]?)([^'"\s)]+)\1\s*\)/g, (whole, quote, value) => {
    const asset = assets.get(assetUrl(value, base));
    return asset && !asset.failed ? `url("${asset.local}")` : whole;
  });
}

for (const asset of assets.values()) {
  if (asset.failed) continue;
  let bytes = asset.bytes;
  if (/css/i.test(asset.type) || asset.file.endsWith('.css')) {
    let css = localize(bytes.toString('utf8'), asset.url);
    for (const dependency of assets.values()) if (!dependency.failed) css = css.replaceAll(dependency.url, dependency.local);
    bytes = Buffer.from(css);
  }
  await writeFile(asset.file, bytes);
  asset.localSha256 = digest(bytes);
  asset.size = bytes.length;
}

const manifestPages = [];
for (const page of pages.values()) {
  const { $, url, route } = page;
  const scripts = [];
  $('script').each((_, el) => {
    const node = $(el);
    const source = node.attr('src');
    if (source) {
      const asset = assets.get(assetUrl(source, url));
      if (asset && !asset.failed) scripts.push({ src: asset.local, original: source });
    }
    node.remove();
  });
  // Fonts are already mirrored as CSS/WOFF2; WebFont's remote loader is unnecessary.
  const runtime = scripts.filter(script => !script.original.includes('/webfont/'));
  $('[src],[poster],[href],[srcset],[style]').each((_, el) => {
    const node = $(el);
    for (const attr of ['src', 'poster', 'href']) {
      const value = node.attr(attr);
      if (!value) continue;
      const absolute = assetUrl(value, url);
      const asset = assets.get(absolute);
      if (asset && !asset.failed) node.attr(attr, asset.local);
      else if (attr === 'href' && absolute && new URL(absolute).origin === origin) {
        const target = new URL(absolute);
        node.attr(attr, target.pathname + target.search + target.hash);
      }
    }
    if (node.attr('srcset')) node.attr('srcset', node.attr('srcset').split(',').map(item => {
      const [source, ...rest] = item.trim().split(/\s+/);
      const asset = assets.get(assetUrl(source, url));
      return [asset && !asset.failed ? asset.local : source, ...rest].join(' ');
    }).join(', '));
    if (node.attr('style')) node.attr('style', localize(node.attr('style'), url));
  });
  $('style').each((_, el) => $(el).text(localize($(el).text(), url)));
  const stylesheet = $('link[rel="stylesheet"]').map((_, el) => $(el).attr('href')).get();
  const data = {
    route, originalUrl: url, title: $('title').text(),
    description: $('meta[name="description"]').attr('content') || '',
    htmlAttributes: $('html').attr(), bodyAttributes: $('body').attr(),
    stylesheets: stylesheet, scripts: runtime,
    body: $('body').html(),
  };
  const filename = route === '/' ? 'home.json' : route.slice(1).replaceAll('/', '-') + '.json';
  await writeFile(path.join(root, 'src/content', filename), JSON.stringify(data, null, 2) + '\n');
  manifestPages.push({ route, file: filename, originalSha256: page.sha256 });
}

const manifest = {
  source: origin, capturedAt: new Date().toISOString(),
  pages: manifestPages,
  assets: [...assets.values()].map(({ url, local, sha256, localSha256, size, type, failed }) => ({ url, local, originalSha256: sha256, localSha256, size, type, failed: !!failed })),
  failures,
};
await writeFile(path.join(root, 'evidence/asset-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
await writeFile(path.join(root, 'src/content/routes.json'), JSON.stringify(manifestPages.map(({ route, file }) => ({ route, file })), null, 2) + '\n');
console.log(JSON.stringify({ pages: pages.size, assets: assets.size, failures }, null, 2));
if (failures.length) process.exitCode = 1;
