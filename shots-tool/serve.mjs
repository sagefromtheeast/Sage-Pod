// Static server for `expo export --platform web` output, with SPA fallback and
// the COOP/COEP headers expo-sqlite (wa-sqlite + SharedArrayBuffer) needs.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(process.argv[2] ?? 'dist-web');
const port = Number(process.argv[3] ?? 8081);
const types = { '.html':'text/html', '.js':'application/javascript', '.wasm':'application/wasm', '.json':'application/json',
  '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.ttf':'font/ttf', '.ico':'image/x-icon', '.css':'text/css' };
http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  let file = path.join(root, url);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'index.html');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  res.setHeader('Content-Type', types[path.extname(file)] ?? 'application/octet-stream');
  fs.createReadStream(file).on('error', () => { res.statusCode = 503; res.end('rebuilding'); }).pipe(res);
}).listen(port, () => console.log(`serving ${root} on http://localhost:${port}`));
