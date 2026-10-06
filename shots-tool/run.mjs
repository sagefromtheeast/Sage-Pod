// Usage: node shots-tool/run.mjs <name> [only=home,queue,...]
//   Builds the production web export, serves it, captures every screen at
//   phone / tablet / tablet-landscape into screenshots/<name>/, then stops.
//   SHOTS_SCHEME=light switches the colour scheme (default dark).
//   SHOTS_SKIP_BUILD=1 reuses an existing dist-web/ (faster when iterating on shoot.mjs).
import { execFileSync, spawn } from 'node:child_process';

const name = process.argv[2] ?? 'current';
const only = process.argv[3];
const scheme = process.env.SHOTS_SCHEME ?? 'dark';
const port = Number(process.env.SHOTS_PORT ?? 8091);
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

if (!process.env.SHOTS_SKIP_BUILD) {
  // The production export, not `expo start --web`: dev mode overlays LogBox
  // warnings that change the pictures.
  execFileSync(npx, ['expo', 'export', '--platform', 'web', '--output-dir', 'dist-web'], {
    stdio: 'inherit',
    env: { ...process.env, CI: '1' },
  });
}

const server = spawn(process.execPath, ['shots-tool/serve.mjs', 'dist-web', String(port)], {
  stdio: ['ignore', 'pipe', 'inherit'],
});
await new Promise((resolve, reject) => {
  server.stdout.on('data', (chunk) => String(chunk).includes('serving') && resolve());
  server.on('exit', (code) => reject(new Error(`static server exited (${code})`)));
});

try {
  const args = ['shots-tool/shoot.mjs', `screenshots/${name}`, `http://localhost:${port}`, scheme];
  if (only) args.push(only);
  execFileSync(process.execPath, args, { stdio: 'inherit' });
} finally {
  // Kill by PID — a pattern-based kill would also match this script's own command line.
  server.kill();
}
