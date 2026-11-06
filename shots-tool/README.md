# Screenshot harness

Before/after screenshots of every main screen, with seeded demo data, at three
viewports (phone 390×844, tablet 800×1280, tablet landscape 1280×800). Use it
to show what a change did, and to catch screens a change shouldn't have touched.

```bash
npm run shots -- before            # on the base commit (e.g. before your change)
# …make the change…
npm run shots -- after             # same command, after the change
npm run shots:diff                 # pixel diff + screenshots/compare.html
npm run shots -- after home,player # only some screens
```

Output lands in `screenshots/` (git-ignored): `before/`, `after/`, `diff/`
(changed pixels in red), `compare/` (side-by-side PNGs of changed screens) and
`compare.html` (every screen, before | after | diff).

## How it works

1. `npx expo export --platform web` builds the real app for the browser.
2. `serve.mjs` serves it; `shoot.mjs` drives headless Chromium via Playwright.
3. On first load it seeds demo data through the app's own SQLite handle
   (`seed.mjs`: 6 podcasts, 48 episodes, a queue, 14 days of history, a
   restored Now Playing episode), then visits each route.
4. Everything is deterministic: fixed clock (`NOW` in `seed.mjs`), seeded
   `Math.random`, reduced motion, transitions off, and all non-localhost
   network stubbed (generated cover art, fixture iTunes results, a silent
   audio file). Two runs of the same code are pixel-identical.

## Web-only shims (`shims/`, wired in `metro.config.js`)

These apply **only** to web bundles and only to imports from `app/` and `src/`;
native builds are untouched.

| Shim | Why |
|---|---|
| `expo-sqlite.web.js` | expo-sqlite's web `openDatabaseSync` deadlocks (it spins on the main thread waiting for a worker that can't start). The app only uses async methods, so the shim proxies them to `openDatabaseAsync`, and exposes the handle for seeding. |
| `AccessibilityInfo.web.js` | react-native-web lacks the iOS-only `isReduceTransparencyEnabled` that the glass components call. |
| `expo-network.web.js` | Reports a cellular connection so startup auto-download (native-only file APIs) skips. |

## Caveats

- **Layout, not native look.** Glass/blur render as solid surfaces, fonts are
  the browser's, there are no safe-area insets, and headers are the JS ones.
  Use an EAS preview build on a device to judge native visuals.
- **The seed SQL is tied to the schema.** After a migration in
  `src/db/schema.ts`, update `seed.mjs` to match or seeding fails.
- New screens: add a `[name, route]` pair to `ROUTES` in `shoot.mjs`.
- Playwright is pinned to the version whose Chromium is installed
  (`playwright@1.56.1`). On a fresh machine run `npx playwright install chromium` once,
  or point `SHOTS_CHROMIUM` at an installed Chromium (`SHOTS_CHROMIUM=/opt/pw-browsers/chromium npm run shots -- after`).
