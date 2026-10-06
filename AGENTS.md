# Sage Pod

A React Native + Expo podcast player. See `README.md` for the architecture.

**Taking over or continuing work?** Read `docs/HANDOVER.md` first (role,
authority, workflow), then `TASKS.md` (what's next), `docs/DECISIONS.md`
(what's settled) and `docs/PARITY-PLAN.md` (the AntennaPod parity roadmap).

## Expo has changed

This project is on **Expo SDK 57**. Several APIs moved recently — check the
installed type definitions in `node_modules` or the versioned docs at
https://docs.expo.dev/versions/v57.0.0/ before writing code against them.
In particular:

- `expo-router` no longer depends on React Navigation. `Tabs`, `BottomTabBar`
  and `BottomTabBarProps` come from **`expo-router/js-tabs`**, not
  `@react-navigation/bottom-tabs` (which is not installed). `Stack` still comes
  from `expo-router`.
- Audio is **`expo-audio`**, not `expo-av`. It provides lock-screen and
  notification controls directly via `setActiveForLockScreen()`.
- `expo-file-system` uses the `File` / `Directory` / `Paths` classes.

## Conventions

- Imports use the `@/*` alias for `src/*`. Keep them extensionless.
- Database access goes through a repository in `src/db/`, never raw SQL in a
  screen.
- Screens re-render from SQLite change events via `useQuery`. Do not add manual
  cache invalidation.
- Colours, spacing and type come from `src/ui/theme.ts` via `useTheme()`. No
  hard-coded hex values in screens.

## Commits and releases

Releases are automated from commit messages, so **commit messages are load
bearing** — use [Conventional Commits](https://www.conventionalcommits.org/):
`feat:` (minor), `fix:` / `perf:` (patch), `feat!:` or a `BREAKING CHANGE:`
body (major). `docs/chore/ci/refactor/test/style/build` do not release.

Never hand-edit a version. `expo.version`, `android.versionCode`,
`ios.buildNumber` and `package.json` are all written by
`tool/set_app_version.sh` during the release. If you add a file that carries the
version, add it to that script **and** to `git.assets` in `.releaserc.json`, or
it will silently drift out of sync with the tags.

`.releaserc.json` uses the `conventionalcommits` preset, not `angular` — the
`presetConfig.types` section names only take effect under that preset, and the
preset package must stay listed in the workflow's `extra_plugins`.

## Checks

```bash
npm run typecheck   # app + tests
npm test            # node:test suites in src/**/__tests__
npx expo-doctor     # must pass every check
npx expo export --platform android   # catches Metro resolution errors
npm run shots -- before|after && npm run shots:diff   # UI changes: before/after screenshots
```

UI changes need a before/after screenshot diff (`shots-tool/README.md`). After
a schema migration, update `shots-tool/seed.mjs` in the same commit.
