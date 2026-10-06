// Usage: node shots-tool/diff.mjs <beforeDir> <afterDir> <diffDir>  -> prints changed-pixel counts, writes red-highlight diffs
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
const [a, b, out] = process.argv.slice(2);
// Start from an empty diff dir: compare.mjs treats an existing diff PNG as
// "changed", so a stale one from an earlier run would report a false change.
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const rows = [];
const pngs = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.png')) : []);
// The union of both sets, so a screen added (or removed) by the change is reported too.
for (const f of [...new Set([...pngs(a), ...pngs(b)])].sort()) {
  if (!fs.existsSync(path.join(a, f))) { rows.push([f, 'new in after']); continue; }
  if (!fs.existsSync(path.join(b, f))) { rows.push([f, 'missing in after']); continue; }
  const A = PNG.sync.read(fs.readFileSync(path.join(a, f))), B = PNG.sync.read(fs.readFileSync(path.join(b, f)));
  if (A.width !== B.width || A.height !== B.height) { rows.push([f, `size ${A.width}x${A.height} vs ${B.width}x${B.height}`]); continue; }
  const D = new PNG({ width: A.width, height: A.height });
  const n = pixelmatch(A.data, B.data, D.data, A.width, A.height, { threshold: 0.1 });
  if (n) fs.writeFileSync(path.join(out, f), PNG.sync.write(D));
  rows.push([f, n ? `${n} px (${((100 * n) / (A.width * A.height)).toFixed(2)}%)` : 'identical']);
}
for (const [f, r] of rows) console.log(f.padEnd(28), r);
