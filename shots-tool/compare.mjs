// Usage: node shots-tool/compare.mjs <screenshotsRoot>   (expects before/ after/ [diff/] inside)
// Writes <root>/compare.html (all screens, before | after | diff) and <root>/compare/<name>.png
// side-by-side montages for every screen that changed, rendered with Playwright (no ImageMagick needed).
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch { pw = require('/opt/node22/lib/node_modules/playwright'); }
const root = path.resolve(process.argv[2] ?? 'screenshots');
const pngs = (dir) => (fs.existsSync(path.join(root, dir)) ? fs.readdirSync(path.join(root, dir)).filter((f) => f.endsWith('.png')) : []);
// Union of before and after, so screens that exist on only one side still show up.
const files = [...new Set([...pngs('before'), ...pngs('after')])].sort();
const inBoth = (f) => fs.existsSync(path.join(root, 'before', f)) && fs.existsSync(path.join(root, 'after', f));
const changed = (f) => fs.existsSync(path.join(root, 'diff', f)) || !inBoth(f);
const cell = (dir, f, label) => fs.existsSync(path.join(root, dir, f))
  ? `<figure><figcaption>${label}</figcaption><img src="${dir}/${f}"></figure>` : `<figure><figcaption>${label}</figcaption><p>—</p></figure>`;
const status = (f) => (!fs.existsSync(path.join(root, 'before', f)) ? '<b>new</b>' : !fs.existsSync(path.join(root, 'after', f)) ? '<b>removed</b>' : changed(f) ? '<b>changed</b>' : '<i>identical</i>');
const row = (f) => `<section id="${f}"><h2>${f.replace('.png', '')} ${status(f)}</h2>
  <div class="row">${cell('before', f, 'Before')}${cell('after', f, 'After')}${fs.existsSync(path.join(root, 'diff', f)) ? cell('diff', f, 'Diff') : ''}</div></section>`;
const css = `body{background:#111;color:#eee;font:14px system-ui;margin:16px}h2{font-size:15px}b{color:#f66}i{color:#8a8}
  .row{display:flex;gap:12px;align-items:flex-start}figure{margin:0;flex:1;min-width:0}img{width:100%;border:1px solid #333}figcaption{margin-bottom:4px;color:#aaa}`;
const page = (body) => `<!doctype html><meta charset="utf-8"><title>Screenshot comparison</title><style>${css}</style>${body}`;
fs.writeFileSync(path.join(root, 'compare.html'), page(`<h1>Before / after</h1>${files.map(row).join('\n')}`));
fs.rmSync(path.join(root, 'compare'), { recursive: true, force: true });
fs.mkdirSync(path.join(root, 'compare'), { recursive: true });
const browser = await pw.chromium.launch();
const p = await browser.newPage({ viewport: { width: 1600, height: 900 } });
for (const f of files.filter(changed)) {
  const tmp = path.join(root, `.montage.html`);
  fs.writeFileSync(tmp, page(row(f)));
  await p.goto('file://' + tmp);
  await p.evaluate(() => Promise.all([...document.images].map((i) => i.decode().catch(() => {}))));
  await p.locator('section').screenshot({ path: path.join(root, 'compare', f) });
  fs.unlinkSync(tmp);
  console.log('montage', path.join(root, 'compare', f));
}
await browser.close();
console.log('index', path.join(root, 'compare.html'));
