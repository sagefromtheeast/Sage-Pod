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

// SHOTS_EMPTY=1: a fresh install, no seed, so the screens show their empty states.
const EMPTY = process.env.SHOTS_EMPTY === '1';
const EMPTY_ROUTES = [
  ['home', '/'], ['queue', '/queue'], ['inbox', '/inbox'], ['library', '/library'], ['episodes', '/episodes'],
  ['downloads', '/downloads'], ['favorites', '/list/favorites'], ['history', '/list/history'], ['stats', '/stats'],
].filter(([n]) => !only || only.includes(n));

// SHOTS_SCALE multiplies every viewport's pixel density, e.g. 2.5 for store
// mockups (tool/store_mockups.py). Leave it unset for before/after diffs.
const SCALE = Number(process.env.SHOTS_SCALE ?? 1);
const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844, deviceScaleFactor: 2 * SCALE, isMobile: true, hasTouch: true },
  { name: 'tablet', width: 800, height: 1280, deviceScaleFactor: 1 * SCALE, isMobile: true, hasTouch: true },
  { name: 'tablet-land', width: 1280, height: 800, deviceScaleFactor: 1 * SCALE, isMobile: true, hasTouch: true },
];
// Long-press the first episode row of a list (RN-web Pressable needs a held pointer).
async function longPressFirstEpisode(page, title = /^120\. /) {
  const row = page.getByText(title).first();
  const box = await row.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(700);
  await page.mouse.up();
  await page.getByText('Share…').first().waitFor({ timeout: 10000 });
}

// A finger drag (real touch events via CDP): swipe rows only respond to touch, not the mouse.
async function touchDrag(page, x, y, dx, dy, steps = 15) {
  const cdp = await page.context().newCDPSession(page);
  const point = (i) => [{ x: x + (dx * i) / steps, y: y + (dy * i) / steps }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point(0) });
  for (let i = 1; i <= steps; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: point(i) });
    await page.waitForTimeout(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

// Starts a finger drag and doesn't lift it, to capture a swipe mid-gesture.
async function touchHold(page, x, y, dx, steps = 12) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (let i = 1; i <= steps; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + (dx * i) / steps, y }] });
    await page.waitForTimeout(16);
  }
  await page.waitForTimeout(250);
}

// [name, route, optional interaction run after the screen settles]
// A day inside Echo's window, for the Home card and the Statistics menu entry.
const ECHO_NOW = Date.UTC(2026, 11, 15, 15, 0, 0);

const ROUTES = [
  ['home', '/'], ['queue', '/queue'], ['inbox', '/inbox'], ['discover', '/discover'], ['library', '/library'],
  ['player', '/player'], ['feed', '/feed/1'], ['episode', '/episode/3'], ['settings', '/settings'], ['stats', '/stats'],
  ['favorites', '/list/favorites'], ['history', '/list/history'],
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
  ['queue-menu', '/queue', async (page) => {
    await page.getByRole('button', { name: 'More options' }).first().click();
    await page.getByText('Lock queue').first().waitFor({ timeout: 10000 });
  }],
  ['queue-sort', '/queue', async (page) => {
    await page.getByRole('button', { name: 'More options' }).first().click();
    await page.getByText('Sort…').first().click();
    await page.getByText('Keep sorted').waitFor({ timeout: 10000 });
  }],
  ['queue-select', '/queue', async (page) => {
    await longPressFirstEpisode(page, /^118\. A billion years/);
    await page.getByText('Select multiple').first().click();
    await page.getByText(/^118\. The art of doing less/).first().click();
    await page.getByText('2 selected').waitFor({ timeout: 10000 });
  }],
  ['queue-search', '/queue', async (page) => {
    await page.getByRole('button', { name: 'Search the queue' }).first().click();
    await page.getByPlaceholder('Search the queue').fill('river');
    await page.getByText(/No queued episodes match|river/i).first().waitFor({ timeout: 10000 });
  }],
  ['inbox-menu', '/inbox', async (page) => {
    await page.getByRole('button', { name: 'More options' }).first().click();
    await page.getByText('Remove all from inbox').first().waitFor({ timeout: 10000 });
  }],
  ['inbox-sort', '/inbox', async (page) => {
    await page.getByRole('button', { name: 'More options' }).first().click();
    await page.getByText('Sort…').first().click();
    await page.getByText('Shortest first').waitFor({ timeout: 10000 });
  }],
  ['inbox-select', '/inbox', async (page) => {
    await longPressFirstEpisode(page);
    await page.getByText('Select multiple').first().click();
    await page.getByText('1 selected').waitFor({ timeout: 10000 });
  }],
  ['home-menu', '/', async (page) => {
    await page.getByRole('button', { name: 'More options' }).first().click();
    await page.getByText('Configure home screen').first().waitFor({ timeout: 10000 });
  }],
  ['home-configure', '/', async (page) => {
    await page.getByRole('button', { name: 'More options' }).first().click();
    await page.getByText('Configure home screen').first().click();
    await page.getByText('Reset to default').waitFor({ timeout: 10000 });
  }],
  ['search', '/search', async (page) => {
    await page.getByPlaceholder('Search podcasts and episodes').fill('quiet');
    await page.getByText('PODCASTS').waitFor({ timeout: 10000 });
  }],
  ['search-select', '/search', async (page) => {
    await page.getByPlaceholder('Search podcasts and episodes').fill('interview');
    await longPressFirstEpisode(page, /Interview: a lighthouse keeper/);
    await page.getByText('Select multiple').first().click();
    await page.getByText('1 selected').waitFor({ timeout: 10000 });
  }],
  ['discover-search', '/discover', async (page) => {
    await page.getByPlaceholder('Search podcasts').fill('history');
    await page.getByText('Results from Apple Podcasts and fyyd').waitFor({ timeout: 10000 });
  }],
  ['discover-country', '/discover', async (page) => {
    await page.getByLabel(/Chart country/).click();
    await page.getByText("For the charts and Apple's search results").waitFor({ timeout: 10000 });
  }],
  ['add-feed', '/add-feed'],
  ['opml-import', '/settings/import-export', async (page) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base });
    await page.evaluate((xml) => navigator.clipboard.writeText(xml), OPML);
    await page.getByText('Import OPML from clipboard').click();
    await page.getByText('Import 3 podcasts').waitFor({ timeout: 10000 });
  }],
  ['library-display', '/library', async (page) => {
    await page.getByLabel('More options').click();
    await page.getByText('Display…').click();
    await page.getByText('NUMBER ON EACH PODCAST').waitFor({ timeout: 10000 });
  }],
  ['library-tag', '/library', async (page) => {
    await page.getByText('Science', { exact: true }).click();
    await page.getByText('Deep Time').waitFor({ timeout: 10000 });
  }],
  ['library-select', '/library', async (page) => {
    const tile = page.getByLabel(/^Deep Time/).first();
    const box = await tile.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.width / 2);
    await page.mouse.down();
    await page.waitForTimeout(700);
    await page.mouse.up();
    await page.getByText('1 selected').waitFor({ timeout: 10000 });
  }],
  ['archive', '/archive'],
  ['feed-archived', '/feed/8'],
  ['episodes', '/episodes'],
  ['episodes-filter', '/episodes', async (page) => {
    await page.getByLabel('More options').click();
    await page.getByText('Filter…').click();
    await page.getByText('Saved for this screen').waitFor({ timeout: 10000 });
  }],
  ['downloads', '/downloads'],
  ['downloads-log', '/downloads', async (page) => {
    await page.getByLabel('More options').click();
    await page.getByText('Download log').click();
    await page.getByText('4 entries').waitFor({ timeout: 10000 });
  }],
  ['downloads-log-entry', '/downloads', async (page) => {
    await page.getByLabel('More options').click();
    await page.getByText('Download log').click();
    await page.getByText('The podcast file was not found on the server (404/410).').first().click();
    await page.getByText('Copy details').waitFor({ timeout: 10000 });
  }],
  ['downloads-search', '/downloads', async (page) => {
    await page.getByLabel('Search downloads').click();
    await page.getByPlaceholder('Search downloads').fill('signal');
    await page.getByText('DOWNLOADED · 2 of 5', { exact: false }).waitFor({ timeout: 10000 });
  }],
  ['episode-menu', '/episode/3', async (page) => {
    await page.getByRole('button', { name: 'More options' }).first().click();
    await page.getByText('Share audio file link').first().waitFor({ timeout: 10000 });
  }],
  ['episode-swipe', '/episode/3', async (page) => {
    const title = page.getByText(/^118\. A billion years in a pebble$/).first();
    const box = await title.boundingBox();
    await touchDrag(page, box.x + box.width * 0.8, box.y + box.height / 2, -box.width * 0.7, 0);
    await page.getByText(/^117\. What inflation really feels like$/).first().waitFor({ state: 'visible', timeout: 10000 });
    await page.waitForTimeout(800);
  }],
  ['feed-filter', '/feed/1', async (page) => {
    await page.getByRole('button', { name: 'Filter' }).first().click();
    await page.getByText('Saved for this podcast').waitFor({ timeout: 10000 });
  }],
  ['feed-info', '/feed/info/1'],
  ['feed-settings', '/feed/settings/1'],
  ['settings-interface', '/settings/interface'],
  ['settings-swipes', '/settings/swipes'],
  ['settings-swipe-choice', '/settings/swipes', async (page) => {
    await page.getByLabel(/^Swipe left: /).first().click();
    await page.getByText('Add to / remove from favourites').last().waitFor({ timeout: 10000 });
  }],
  ['settings-playback', '/settings/playback'],
  ['settings-downloads', '/settings/downloads'],
  ['settings-import-export', '/settings/import-export'],
  ['settings-about', '/settings/about'],
  ['settings-notifications', '/settings/notifications'],
  ['settings-downloads-auto', '/settings/downloads', async (page) => {
    await page.getByText('Only while charging').first().scrollIntoViewIfNeeded();
  }],
  ['feed-settings-auth', '/feed/settings/1', async (page) => {
    await page.getByText('AUTHENTICATION').first().scrollIntoViewIfNeeded();
    await page.getByText('Password').first().waitFor({ timeout: 10000 });
  }],
  ['stats-years', '/stats', async (page) => {
    await page.getByRole('tab', { name: 'Years' }).click();
    await page.getByText('BY YEAR').waitFor({ timeout: 10000 });
  }],
  ['stats-downloads', '/stats?tab=downloads', async (page) => {
    await page.getByText(/^\d+ episodes$/).first().waitFor({ timeout: 10000 });
  }],
  ['stats-range', '/stats', async (page) => {
    await page.getByLabel('Date range: All time').click();
    await page.getByText('Last 12 months').waitFor({ timeout: 10000 });
  }],
  ['stats-feed', '/stats/feed/1', async (page) => {
    await page.getByText('RELEASE SCHEDULE').waitFor({ timeout: 10000 });
  }],
  ['feed-settings-automation', '/feed/settings/1', async (page) => {
    await page.getByText('AUTOMATION').first().scrollIntoViewIfNeeded();
    await page.getByText('Auto-delete').first().waitFor({ timeout: 10000 });
  }],
  ['feed-banner', '/feed/6'],
  ['feed-preview', '/feed/7'],
  // Sage Pod's own dialogs (D-031): a destructive one and a plain one.
  ['queue-clear-dialog', '/queue', async (page) => {
    await page.getByRole('button', { name: 'More options' }).first().click();
    await page.getByText('Clear queue').first().click();
    await page.getByText('Clear queue?').waitFor({ timeout: 10000 });
  }],
  ['settings-reset-dialog', '/settings', async (page) => {
    await page.getByText('Reset settings').first().click();
    await page.getByText('Reset settings?').waitFor({ timeout: 10000 });
  }],
  // A swipe held past the commit point: the strip names the action in its colour.
  ['queue-swipe-hold', '/queue', async (page) => {
    const row = page.getByText(/^118\. The art of doing less/).first();
    const box = await row.boundingBox();
    await page.clock.setSystemTime(NOW);
    await touchHold(page, box.x + box.width / 2, box.y + box.height / 2, -170);
  }],
  ['inbox-swipe-hold', '/inbox', async (page) => {
    const row = page.getByText(/^120\. Inside the chip shortage/).first();
    const box = await row.boundingBox();
    await page.clock.setSystemTime(NOW);
    await touchHold(page, box.x + box.width / 2, box.y + box.height / 2, 90);
  }],
  ['feed-menu', '/feed/1', async (page) => {
    await page.getByRole('button', { name: 'More options' }).first().click();
    await page.getByText('Refresh complete podcast').first().waitFor({ timeout: 10000 });
  }],
  // These last ones change the seeded data (a saved filter, the inbox, the queue order, the statistics filter).
  ['stats-marked', '/stats', async (page) => {
    await page.getByText('Include marked played').click();
    await page.getByText(/Played episodes count in full/).waitFor({ timeout: 10000 });
  }],
  ['feed-filtered', '/feed/1', async (page) => {
    await page.getByRole('button', { name: 'Filter' }).first().click();
    await page.getByText('Unplayed', { exact: true }).first().click();
    await page.getByRole('button', { name: 'Close menu' }).first().click();
    await page.getByText('Filtered: Unplayed').waitFor({ timeout: 10000 });
  }],
  // Swiping left removes from the inbox, with Undo.
  ['inbox-swipe', '/inbox', async (page) => {
    const row = page.getByText(/^120\. Inside the chip shortage/).first();
    const box = await row.boundingBox();
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    // RN's spring animations step by Date.now(), which setFixedTime freezes, so
    // the swipe would never finish opening. Let time flow from here on.
    await page.clock.setSystemTime(NOW);
    await touchDrag(page, x, y, -240, 0);
    await page.getByText('Removed from inbox').waitFor({ timeout: 10000 });
    await page.getByText('Undo').first().waitFor({ timeout: 10000 });
  }],
  // Reorders the seeded queue. Drags row 1 to row 3 by its handle.
  ['queue-drag', '/queue', async (page) => {
    const handle = page.getByLabel('Reorder, position 1 of 5').first();
    const box = await handle.boundingBox();
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    // Rows are ~102 px: 176 px passes row 3's midpoint but not row 4's.
    for (let i = 1; i <= 8; i++) await page.mouse.move(x, y + i * 22);
    await page.mouse.up();
    await page.waitForFunction(() => {
      const t = document.body.innerText;
      const at = (s) => t.indexOf(s);
      return at('The art of doing less') < at('The comet that came back') &&
        at('The comet that came back') < at('A billion years in a pebble') &&
        at('A billion years in a pebble') < at('Why we stopped writing letters');
    }, null, { timeout: 10000 });
  }],
  // Phase 20: Echo's seven cards, timer stopped.
  ...['intro', 'hours', 'queue', 'delay', 'hoarder', 'thanks', 'top'].map((card, i) => [
    `echo-${card}`, `/echo?still=1&card=${i}`, async (page) => {
      await page.getByRole('button', { name: 'Close Echo' }).first().waitFor({ timeout: 10000 });
    },
  ]),
  // Last, because they move the clock to the Echo window (10–31 December).
  ['home-echo', '/', async (page) => {
    await page.clock.setFixedTime(ECHO_NOW);
    await page.reload();
    await page.getByText('Review the year').first().waitFor({ timeout: 30000 });
  }],
  ['stats-echo', '/stats', async (page) => {
    await page.clock.setFixedTime(ECHO_NOW);
    await page.reload();
    await page.getByRole('button', { name: 'More options' }).first().click();
    await page.getByText('Your year in podcasts').first().waitFor({ timeout: 10000 });
  }],
].filter(([n]) => !only || only.includes(n));

const CHART = Array.from({ length: 12 }, (_, i) => ({
  collectionId: 1000 + i, collectionName: ['Morning Brief', 'Tiny Histories', 'The Long Read', 'Science Hour', 'Comedy Bang', 'Startup Diaries'][i % 6] + (i >= 6 ? ' II' : ''),
  // The first two are podcasts the seed already follows: hidden from the charts, marked in search.
  artistName: 'Demo Network', feedUrl: i < 2 ? `https://feeds.sagepod.test/${i + 1}.xml` : `https://feeds.sagepod.test/chart-${i}.xml`,
  artworkUrl600: `https://art.sagepod.test/${(i % 6) + 1}.svg`, primaryGenreName: 'Society & Culture', trackCount: 100 + i,
}));

// fyyd's extra finds: one copy of an Apple result (merged away) and one podcast only fyyd knows.
const FYYD = { status: 1, msg: 'ok', data: [
  { id: 1, title: 'Science Hour', author: 'Demo Network', xmlURL: 'http://feeds.sagepod.test/chart-3.xml/', imgURL: 'https://art.sagepod.test/4.svg', episode_count: 101 },
  { id: 2, title: 'Allotment Radio', author: 'Small Garden Co.', xmlURL: 'https://feeds.sagepod.test/fyyd-2.xml', imgURL: 'https://art.sagepod.test/4.svg', episode_count: 64 },
] };

const OPML = `<?xml version="1.0"?><opml version="2.0"><head><title>Export</title></head><body>
<outline text="Podcasts">
  <outline type="rss" text="Morning Brief" xmlUrl="https://feeds.sagepod.test/chart-2.xml"/>
  <outline type="rss" text="The Long Read" xmlUrl="https://feeds.sagepod.test/chart-3.xml"/>
  <outline type="rss" text="Allotment Radio" xmlUrl="https://feeds.sagepod.test/fyyd-2.xml"/>
</outline>
<outline type="rss" text="Already followed" xmlUrl="https://feeds.sagepod.test/1.xml"/>
</body></opml>`;

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
    if (url.hostname === 'api.fyyd.de') return route.fulfill({ json: FYYD });
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
// SHOTS_CHROMIUM points at a preinstalled Chromium when Playwright's own build isn't there.
const browser = await chromium.launch(process.env.SHOTS_CHROMIUM ? { executablePath: process.env.SHOTS_CHROMIUM } : {});
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
  if (!EMPTY) { log(vpName, 'seeding'); await page.evaluate((sql) => globalThis.__SQLITE_DBS__['sagepod.db'].execAsync(sql), seedSql()); }

  for (const [name, url, act] of EMPTY ? EMPTY_ROUTES : ROUTES) {
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
      // Keep a picture of the failing state, so a timeout can be diagnosed.
      const failed = path.join(outDir, `FAILED-${name}--${vpName}.png`);
      await page.screenshot({ path: failed }).catch(() => {});
      console.error(`[${vpName}/${name}] failure screenshot: ${failed}`);
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
