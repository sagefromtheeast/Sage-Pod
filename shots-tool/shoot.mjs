// Usage: node shots-tool/shoot.mjs <outDir> [baseUrl] [scheme=dark|light] [only=comma,list,of,route,names]
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { NOW, seedSql, artSvg, CHAPTERS } from './seed.mjs';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch { pw = require('/opt/node22/lib/node_modules/playwright'); }
const { chromium } = pw;

const outDir = process.argv[2] ?? 'screenshots/current';
const base = process.argv[3] ?? 'http://localhost:8081';
const scheme = process.argv[4] ?? 'dark';
const only = process.argv[5]?.split(',');

const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  { name: 'tablet', width: 800, height: 1280, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
  { name: 'tablet-land', width: 1280, height: 800, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
];
// Long-press the first episode row of a list (RN-web Pressable needs a held pointer).
async function longPressFirstEpisode(page) {
  const row = page.getByText(/^120\. /).first();
  const box = await row.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(700);
  await page.mouse.up();
  await page.getByText('Share…').first().waitFor({ timeout: 10000 });
}

// [name, route, optional interaction run after the screen settles]
const ROUTES = [
  ['home', '/'], ['queue', '/queue'], ['inbox', '/inbox'], ['discover', '/discover'], ['library', '/library'],
  ['player', '/player'], ['feed', '/feed/1'], ['episode', '/episode/3'], ['settings', '/settings'], ['stats', '/stats'],
  ['favorites', '/list/favorites'],
  ['feed-actions', '/feed/1', longPressFirstEpisode],
  ['feed-select', '/feed/1', async (page) => {
    await longPressFirstEpisode(page);
    await page.getByText('Select multiple').first().click();
    await page.getByText(/^119\. /).first().click();
    await page.getByText('2 selected').waitFor({ timeout: 10000 });
  }],
  ['player-speed', '/player', async (page) => {
    await page.getByRole('button', { name: /Change speed/ }).first().click();
    await page.getByText('Saved for all podcasts').waitFor({ timeout: 10000 });
  }],
  ['player-sleep', '/player', async (page) => {
    await page.getByRole('button', { name: 'Sleep timer' }).first().click();
    await page.getByText('MINUTES').waitFor({ timeout: 10000 });
  }],
  ['player-chapters', '/player', async (page) => {
    await page.getByRole('button', { name: /Show all chapters/ }).first().click();
    await page.getByText('5 chapters').waitFor({ timeout: 10000 });
  }],
  ['feed-menu', '/feed/1', async (page) => {
    await page.getByRole('button', { name: 'More options' }).first().click();
    await page.getByText('Unsubscribe').first().waitFor({ timeout: 10000 });
  }],
].filter(([n]) => !only || only.includes(n));

const CHART = Array.from({ length: 12 }, (_, i) => ({
  collectionId: 1000 + i, collectionName: ['Morning Brief', 'Tiny Histories', 'The Long Read', 'Science Hour', 'Comedy Bang', 'Startup Diaries'][i % 6] + (i >= 6 ? ' II' : ''),
  artistName: 'Demo Network', feedUrl: `https://feeds.sagepod.test/chart-${i}.xml`,
  artworkUrl600: `https://art.sagepod.test/${(i % 6) + 1}.svg`, primaryGenreName: 'Society & Culture', trackCount: 100 + i,
}));

// Silent 8-bit mono WAV whose length matches the episode's seeded duration (?d=seconds), so the
// player's restored position/remaining time match the DB instead of "Playback error" or "0:00 / -0:01".
// Served as HTTP 206 slices of a *virtual* file (header + 0x80 bytes), so a 75-minute episode costs a
// few KB per request instead of pushing tens of MB through Playwright's route handler.
function wavSlice(seconds, rangeHeader) {
  const rate = 4000, n = rate * seconds, total = 44 + n;
  const m = /bytes=(\d+)-(\d*)/.exec(rangeHeader ?? '');
  const start = m ? Number(m[1]) : 0;
  const end = Math.min(total - 1, m && m[2] ? Number(m[2]) : total - 1, start + 65535);
  const b = Buffer.alloc(end - start + 1, 128);
  if (start < 44) {
    const h = Buffer.alloc(44);
    h.write('RIFF', 0); h.writeUInt32LE(36 + n, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20);
    h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate, 28); h.writeUInt16LE(1, 32); h.writeUInt16LE(8, 34);
    h.write('data', 36); h.writeUInt32LE(n, 40);
    h.copy(b, 0, start, Math.min(44, end + 1));
  }
  return { status: 206, body: b, headers: { 'Content-Type': 'audio/wav', 'Accept-Ranges': 'bytes',
    'Content-Range': `bytes ${start}-${end}/${total}`, 'Content-Length': String(b.length) } };
}

async function routeNetwork(context) {
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === 'localhost' || url.protocol === 'blob:' || url.protocol === 'data:') return route.continue();
    if (url.hostname === 'art.sagepod.test') {
      return route.fulfill({ contentType: 'image/svg+xml', body: artSvg(path.basename(url.pathname, '.svg')) });
    }
    if (url.hostname === 'chapters.sagepod.test') return route.fulfill({ json: CHAPTERS });
    if (url.hostname === 'rss.applemarketingtools.com') {
      return route.fulfill({ json: { feed: { results: CHART.map((c) => ({ id: String(c.collectionId) })) } } });
    }
    if (url.hostname === 'media.sagepod.test') return route.fulfill(wavSlice(Number(url.searchParams.get('d')) || 60, route.request().headers()['range']));
    if (url.hostname === 'itunes.apple.com') return route.fulfill({ json: { resultCount: CHART.length, results: CHART } });
    return route.abort(); // feeds, audio, anything else: never touch the real network
  });
}

async function settle(page) {
  // No networkidle: the restored episode's <audio> keeps fetching ranges, so the network never idles.
  await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    await Promise.race([document.fonts.ready, sleep(5000)]);
    const inView = [...document.images].filter((i) => {
      const r = i.getBoundingClientRect();
      return r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
    });
    await Promise.race([sleep(5000), Promise.all(inView.map((i) => (i.complete ? 0 : new Promise((r) => {
      i.addEventListener('load', r); i.addEventListener('error', r);
    }))))]);
    // DOM quiescence: wait until nothing has mutated for 400 ms (capped at 5 s).
    await new Promise((resolve) => {
      const done = () => { mo.disconnect(); clearTimeout(hard); clearTimeout(quiet); resolve(); };
      let quiet = setTimeout(done, 400);
      const hard = setTimeout(done, 5000);
      const mo = new MutationObserver(() => { clearTimeout(quiet); quiet = setTimeout(done, 400); });
      mo.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
    });
  });
  await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important;caret-color:transparent!important}' });
  await page.waitForTimeout(300);
}

const log = (...a) => console.error(new Date().toISOString().slice(11, 19), ...a);
const browser = await chromium.launch();
fs.mkdirSync(outDir, { recursive: true });
let failed = false;
for (const vp of VIEWPORTS) {
  const { name: vpName, ...ctxOpts } = vp;
  const context = await browser.newContext({ ...ctxOpts, viewport: { width: vp.width, height: vp.height }, colorScheme: scheme, reducedMotion: 'reduce', locale: 'en-US', timezoneId: 'UTC' });
  await routeNetwork(context);
  // Seeded Math.random so "Surprise Me" (and anything else random) is identical run to run.
  await context.addInitScript(() => { let s = 42; Math.random = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646; });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.clock.setFixedTime(NOW);

  // Boot once, seed through the app's own DB handle, then reload so every screen and the player read it.
  log(vpName, 'boot'); await page.goto(base + '/');
  await page.waitForFunction(() => globalThis.__SQLITE_DBS__?.['sagepod.db'], null, { timeout: 30000 });
  await page.getByText('Library', { exact: true }).first().waitFor({ timeout: 30000 });
  log(vpName, 'seeding'); await page.evaluate((sql) => globalThis.__SQLITE_DBS__['sagepod.db'].execAsync(sql), seedSql());

  for (const [name, url, act] of ROUTES) {
    log(vpName, name);
    try {
      await page.goto(base + url);
      await page.waitForFunction(() => document.body.innerText.trim().length > 0, null, { timeout: 30000 });
      await settle(page);
      if (act) {
        await act(page);
        await settle(page);
      }
    } catch (error) {
      // Say why a screen never rendered (usually a page error) before failing.
      if (errors.length) console.error(`[${vpName}/${name}] page errors:`, [...new Set(errors)].join(' | '));
      throw error;
    }
    const file = path.join(outDir, `${name}--${vpName}.png`);
    await page.screenshot({ path: file });
    console.log('wrote', file);
  }
  // A screen that throws may still render a shell, so a page error fails the
  // run instead of quietly producing a screenshot of a broken screen.
  if (errors.length) {
    failed = true;
    console.error(`[${vpName}] page errors:`, [...new Set(errors)].join(' | '));
  }
  await context.close();
}
await browser.close();
if (failed) {
  console.error('Screenshot run failed: page errors above.');
  process.exit(1);
}
