// Usage: node shots-tool/compare.mjs <screenshotsRoot>   (expects before/ after/ [diff/] inside)
// Writes <root>/compare.html (all screens, before | after | diff) and <root>/compare/<name>.png
// side-by-side montages for every screen that changed, rendered with Playwright (no ImageMagick needed).
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch { pw = require('/opt/node22/lib/node_modules/playwright'); }
const root = path.resolve(process.argv[2] ?? 'screenshots');
const files = fs.readdirSync(path.join(root, 'before')).filter((f) => f.endsWith('.png')).sort();
const changed = (f) => fs.existsSync(path.join(root, 'diff', f));
const cell = (dir, f, label) => fs.existsSync(path.join(root, dir, f))
  ? `<figure><figcaption>${label}</figcaption><img src="${dir}/${f}"></figure>` : `<figure><figcaption>${label}</figcaption><p>—</p></figure>`;
const row = (f) => `<section id="${f}"><h2>${f.replace('.png', '')} ${changed(f) ? '<b>changed</b>' : '<i>identical</i>'}</h2>
  <div class="row">${cell('before', f, 'Before')}${cell('after', f, 'After')}${changed(f) ? cell('diff', f, 'Diff') : ''}</div></section>`;
const css = `body{background:#111;color:#eee;font:14px system-ui;margin:16px}h2{font-size:15px}b{color:#f66}i{color:#8a8}
  .row{display:flex;gap:12px;align-items:flex-start}figure{margin:0;flex:1;min-width:0}img{width:100%;border:1px solid #333}figcaption{margin-bottom:4px;color:#aaa}`;
const page = (body) => `<!doctype html><meta charset="utf-8"><title>Screenshot comparison</title><style>${css}</style>${body}`;
fs.writeFileSync(path.join(root, 'compare.html'), page(`<h1>Before / after</h1>${files.map(row).join('\n')}`));
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
