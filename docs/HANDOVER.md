# Sage Pod — lead developer handover

**Give this file to any AI coding agent (or new developer) taking over Sage Pod.**
It explains what the app is, how it's built, how work is planned and shipped,
which decisions are already made, and which decisions you may make yourself.
You are the lead developer: decide within the rules below, record what you
decided, and keep the owner informed in plain language.

Read in this order: this file → `AGENTS.md` (repo rules) → `TASKS.md` (what's
next) → `docs/DECISIONS.md` (what's settled) → `docs/PARITY-PLAN.md` (the
full roadmap and the AntennaPod comparison behind it).

---

## 1. What Sage Pod is

A podcast player for Android and iOS, built with React Native + Expo, modelled
on [AntennaPod](https://github.com/AntennaPod/AntennaPod): open RSS, no
account, local-first, OPML in and out.

**The product goal right now:** feature parity with AntennaPod while keeping
Sage Pod's own visual design. Features go where AntennaPod puts them (Home
sections, the Queue toolbar, the Now Playing layout); the look stays Sage Pod's
(dark green theme, rounded cards, Sage the Owl branding).

| | |
|---|---|
| Repo | `sagefromtheeast/Sage-Pod` (GitHub, private) |
| Stack | Expo SDK 57, React Native 0.86 (New Architecture), expo-router, expo-audio, expo-sqlite, TypeScript strict |
| Node | 22+ (the test runner uses `--experimental-strip-types`) |
| EAS project | `@sag3-technologies/sage-pod` (projectId in `app.json` → `extra.eas.projectId`) |
| Releases | semantic-release on every push to `main`; tags `vX.Y.Z`; version stamped into `app.json`/`package.json` |
| Current version | see the latest `chore(release)` commit on `main` |

## 2. Your authority

**Decide yourself (then record it in `docs/DECISIONS.md` if it's not obvious):**
- Implementation approach, file structure, naming, refactors inside a phase.
- Which AntennaPod behaviour to copy when the plan doesn't say, preferring
  AntennaPod's defaults and placement.
- Splitting or reordering steps inside a phase; adding small fixes you find.
- Whether a change needs a migration, a new pure helper, or a test.
- Library choices for pure-JS needs that are already in the Expo SDK.

**Stop and ask the owner first:**
- **Spending money**: EAS builds and sandboxes are metered. Always ask for a
  usage budget, and show the cost preview, before triggering one.
- **Merging to `main` is delegated to you** (D-002): merge each phase PR once
  the Checks workflow is green and every review thread is addressed, with a
  merge commit (never squash), then confirm the release tag appeared.
  The Codex bot reviews each PR when it is opened. If it is out of quota (it
  says so in a comment), run `/code-review high origin/main...HEAD` yourself,
  fix what is real, and merge only then.
- A **new native dependency** (anything that needs a new EAS build), or a
  change to the audio engine (see decision D-004).
- A **visible design change** beyond moving features into AntennaPod's places
  (new colours, typography, navigation structure).
- Anything **destructive**: deleting user data paths, force-pushing,
  rewriting `main`, changing release tooling, secrets.
- Requirements that contradict this guide, `AGENTS.md` or `DECISIONS.md`.

When you stop, ask one clear question with a recommended answer.

## 3. How to work (Opus 5.5 workflow)

1. **Know what "done" means before you start.** Each phase in `TASKS.md` and
   `docs/PARITY-PLAN.md` has testable done-criteria. If a task doesn't, write
   them first.
2. **Small, verifiable steps.** One logical change per commit, each proven by a
   `node:test` unit test (for pure logic) or a screenshot diff (for UI), plus
   the standard checks. Look at the actual data and screenshots, not just
   green ticks.
3. **Keep `TASKS.md` as the source of truth.** Tick items when verified, add
   anything you discover. Re-read it after long tool outputs or a context reset.
4. **Mark what you couldn't confirm** as `[UNVERIFIED]` and say where you looked.
5. **Keep going** when a step doesn't need the owner; put status notes in the
   same message as the next action. Don't ask "shall I continue?"
6. **End every working session with three headings:** **Blocked on Me** (what
   the owner must decide or do), **Changed** (files, commits, PRs), **Found**
   (bugs, debt, surprises). Write for a non-technical owner: plain words, short.
7. Don't pad prompts or replies with "think step by step"; just do the work.

### Engineering principles

- **Types first.** Model states as discriminated unions so invalid states can't
  be represented (see `SleepTimer` in `src/player/sleepTimer.ts`). Keep logic in
  pure functions with tests (`src/ui/layout.ts`, `src/player/resumeRewind.ts`,
  `src/discover/surpriseSeed.ts` are the pattern).
- **One source of truth.** Shared SQL column lists live in `src/db/columns.ts`;
  size tokens in `src/ui/theme.ts`; never duplicate them.
- **Read before you write.** When porting an AntennaPod feature, read its source
  first, cite the file, and copy its defaults (thresholds, page sizes, order).
- **Expo SDK 57 specifics**: follow `AGENTS.md`. In particular `Tabs` come from
  `expo-router/js-tabs`, audio is `expo-audio`, files use `File`/`Directory`/`Paths`.

## 4. The phase loop (how every phase ships)

One phase = one PR = one release.

```bash
git fetch origin main
git checkout -B <your-branch> origin/main   # start from the latest main
npm ci
npm run shots -- before                     # screenshots of the starting point
# … implement the phase in small Conventional Commits …
npm run typecheck && npm test && npx expo-doctor
npx expo export --platform android          # catches Metro resolution errors
npm run shots -- after && npm run shots:diff
# open screenshots/compare.html and check every changed screen is intended
git push -u origin <your-branch>            # then open a PR to main
```

The PR description lists what changed, the checks you ran, the before/after
screenshots of changed screens, and an "On device" test list for the owner.
After the owner merges, semantic-release publishes the release automatically;
confirm the new tag exists.

If a PR from your branch has already been merged, start the next phase by
resetting the branch to the latest `main` (it's a fast-forward; never
force-push over unmerged work).

## 5. Commits and releases

Conventional Commits are **load-bearing**: they decide the version.
- `feat:` → minor release · `fix:`/`perf:` → patch · `feat!:` or a
  `BREAKING CHANGE:` footer → major.
- `docs:`, `chore:`, `build:`, `ci:`, `refactor:`, `test:`, `style:` → no release.
- A phase PR containing at least one `feat:` or `fix:` produces exactly one
  release when merged; that's the intended "release per phase".
- **Merge phase PRs with a merge commit, never squash.** semantic-release
  reads every commit since the last tag, so the `feat:`/`fix:` commits inside
  the PR decide the version and the plain "Merge pull request" commit is
  ignored. A squash would collapse them into the PR title, which isn't a
  Conventional Commit, and no release would be cut.
- Give phase PRs a `feat:`-style title anyway (e.g. "feat: Phase 10 —
  per-podcast settings"). The title never reaches `main`, but review bots
  flag non-conventional titles every time.
- Never hand-edit versions. `tool/set_app_version.sh` stamps them on release.
- Don't put bare `#123`-style or `#hex` tokens in commit bodies; the changelog
  turns them into bogus issue links.
- End commit messages with the attribution lines your harness requires.

## 6. Architecture in one page

```
index.ts             entry: expo-router, plus the headless background task and widget handler
app/                 expo-router screens (file-based routes)
  (tabs)/            Home, Queue, Inbox, Discover, Library (+ _layout.tsx tab bar & mini player)
  player.tsx         Now Playing (modal)
  feed/[id].tsx      podcast page   · feed/settings/[id].tsx per-podcast settings
  episode/[id].tsx   episode details · list/[kind].tsx favourites/downloads/history
src/db/              SQLite schema + migrations (schema.ts), repositories, useQuery
src/feed/            RSS/Atom parser, fetch, sync, OPML
src/player/          playback singleton (service.ts), downloads, sleep timer, rewind, chapters
src/discover/        iTunes search/charts, Surprise Me seed
src/ui/              theme tokens, layout helpers, shared components, glass surfaces
shots-tool/          screenshot harness (see its README)
```

- **Data**: everything is local SQLite. Screens read via `useQuery(query,
  tables, deps)`, which re-runs when those tables change; never add manual
  cache invalidation. All SQL lives in `src/db/` repositories.
- **Migrations**: bump `LATEST_SCHEMA_VERSION` and append to `MIGRATIONS` in
  `src/db/schema.ts`; one migration per phase that needs it. Update
  `shots-tool/seed.mjs` in the same commit.
- **Playback**: `src/player/service.ts` is a module singleton (not React state)
  so playback survives screens and is driven from the lock screen. React
  subscribes to it. It saves position every 5 s and on pause/seek/track change.
- **Settings**: `src/db/settings.ts` keeps an in-memory cache read
  synchronously by the player; add new keys to `Settings` + `DEFAULT_SETTINGS`,
  and handle legacy values in `loadSettings()` when a setting changes shape.
- **Layout**: `useLayout()` gives compact / medium / expanded window classes,
  grid columns and size tokens; never hard-code phone sizes in screens.

## 7. Checks and tools

| Command | Use |
|---|---|
| `npm run typecheck` | app + tests, must be clean |
| `npm test` | node:test suites in `src/**/__tests__` |
| `npx expo-doctor` | must report all checks passing |
| `npx expo export --platform android` | catches Metro resolution errors |
| `npm run shots -- <name>` / `npm run shots:diff` | before/after screenshots (web; layout, not native look) |
| EAS `preview` build | installable APK for the owner's device (costs money; ask first) |

The CI release workflow runs typecheck, tests and the version stamper before
releasing, so a red check on `main` blocks the release.

## 8. Builds on a device

- `eas.json` has `development` (dev client), `preview` (sideloadable APK) and
  `production` profiles.
- Builds run on EAS from the GitHub branch (`build_run` with `gitRef` = branch
  name; short SHAs are rejected). Ask the owner to approve a build budget first.
- A finished preview build gives an `.apk` URL the owner opens on their phone.
- Native config changes (`app.json` plugins, orientation, permissions, new
  native packages) only take effect in a new build.

## 9. Known pitfalls

- `expo-router` has no React Navigation dependency in SDK 57; don't import
  `@react-navigation/*`.
- expo-audio 57 limits: lock-screen seek is fixed at 10 s; no next/previous or
  custom lock-screen buttons; no skip-silence; volume can't exceed 1.0; no
  buffered-position API. Don't promise these without native work (D-004).
- The web screenshot build needs the shims in `metro.config.js`; native builds
  ignore them. After a schema migration, update `shots-tool/seed.mjs`.
- Don't kill processes with `pkill -f <pattern>` that also matches your own
  shell command; kill by PID.
- Don't wait for `networkidle` in Playwright: the audio element keeps fetching.
- Swipe rows only answer touch: drive them with `touchDrag` (CDP touch events)
  in `shots-tool/shoot.mjs`. RN spring animations step by `Date.now()`, which
  the harness freezes; call `page.clock.setSystemTime(NOW)` first. A failing
  route leaves `FAILED-<route>--<viewport>.png` in the output folder.
- react-native-web doesn't deliver long-press to nested `<Text>` (inline
  links), with mouse or touch. Check those on a device instead.
- For a "before" set, put the release's `app/` and `src/` into the main tree
  (`git checkout <tag> -- app src`, then delete the files the phase added) and
  keep the new `shots-tool/`; restore with `git checkout HEAD -- app src`. A git
  worktree with a symlinked `node_modules` mixes modules from both trees and
  breaks the web build. List only routes that existed at the release.
- The owner usually works from a phone. Prefer EAS builds and links over
  "run this on your laptop".

## 10. Where things stand

- **Done**: Phases 0–4 of `TASKS.md`: six defects fixed (v0.3.1), the
  screenshot harness, the shared building blocks (long-press action sheet,
  undo toast, overflow menu, multi-select bar, smart row button, status
  markers; v0.4.0), Now Playing (speed / sleep / chapters sheets, chapter
  seek bar, mini player on pushed screens; v0.5.0), the Queue (drag,
  sort / keep sorted, lock, search, enqueue location; v0.6.0), and the
  Inbox (AntennaPod swipes with undo, search, sort, remove all, paging;
  v0.7.0), Home (configurable sections, library search; v0.8.0), Episode
  details (menu, inline links, timestamps, pager; v0.9.0), and the podcast
  page (preview, saved filter and sort, banners, info page; v0.10.0), and
  per-podcast settings (rename, tags, skip ending, volume reduction,
  new-episode action, auto-download rules, auto-delete; v0.11.0), and
  search and discovery (fyyd, chart country, subscribed marks, feed
  autodiscovery, OPML file import with a checklist; v0.12.0), and the
  Library (display, sort, filter, tags, archive, multi-select, Episodes
  screen; v0.13.0), and Downloads (in progress, sort, search, delete
  played, a stored download log; v0.14.0), and Settings (sub-pages, swipe
  actions per list, smart mark as played, cleanup, mobile data; v0.15.0),
  and Statistics (Subscriptions / Years / Downloads tabs, filter, reset,
  per-podcast numbers, release schedule guess; v0.16.0), and Backup
  (database export and restore, OPML / HTML / favourites exports to a
  picked folder; v0.17.0), and Phase 17a (notifications, background
  refresh, automatic backup, protected feeds, podcast links, file sharing,
  charging-only downloads; v0.18.0; D-024), and Phase 17b (patched
  expo-audio: lock-screen skip amounts and Next, skip silence, volume
  boost, pause on unplug; v0.19.0; D-025), and Phase 18a (Android
  home-screen widget and Quick Settings tile; v0.20.0; D-026), and Phase 18b
  (chapters read from MP3 / M4A files when the feed has none; v0.21.0;
  D-027), OTA updates (D-028), and Phase 19 (Android downloads in
  WorkManager jobs from the local module `modules/episode-downloads`;
  D-029).
  Earlier: EAS device builds, stable Surprise Me, tablet layouts.
- **Phase 20 (Echo, D-030)**: `src/echo/` (pure: window, queue outlook, median delay, verdicts, card text, share text), `src/db/echo.ts` (`getEchoYear`, hidden-year meta), `app/echo.tsx` (story screen; `?card=n&still=1`), `src/ui/echo/EchoBackdrop.tsx`, `echoPalette` in theme. JavaScript only: ships over the air.
- **Builds**: the latest Android preview is v0.24.1 (EAS build `010f7f23`, runtime `f069fcd…`); over-the-air updates for JavaScript-only changes target that runtime.
- **Next**: the device checks in TASKS.md (Phases 19 and 20). Over-the-air updates: the owner reconnected the GitHub repo on 6 Nov; confirm a "Publish OTA update" run follows the next push to `main` (TASKS.md, Discovered). Other Phase 18 items are optional, one proposal each. Schema is at version 7; feeds.state can be 'subscribed',
  'preview' or 'archived'.
  Building blocks to reuse: `openEpisodeActions`, `runEpisodeAction`,
  `showToast`, `OverflowMenu`, `BottomSheet` / `ActionSheet`,
  `useEpisodeSelection` + `SelectionBar`, `MiniPlayerDock`, `DraggableList`, `NoMatches`, `TextPromptSheet`, `askToUnsubscribe`,
  `SwipeableEpisodeRow` (pass a `screen`), `SettingsLink` / `SettingsChoice`,
  `SegmentedTabs`, `DonutChart` / `BarChart` (`src/ui/stats/charts.tsx`) (see
  `src/actions/` and `src/ui/`). New settings go in `src/db/settingsSchema.ts`;
  multiple-choice ones also list their choices in `src/settings/options.ts`.
- **Device build**: one EAS build at the end (D-011).
- **expo-audio is patched** (D-025, `patches/expo-audio+57.0.5.patch`).
  To change the patch: edit `node_modules/expo-audio`, then
  `npx patch-package expo-audio`. To compile the Android half locally:
  install the Android SDK (platform 36, build-tools 36.0.0 and 35.0.0),
  `npx expo prebuild --platform android --no-install`, put
  `sdk.dir=/path/to/sdk` in `android/local.properties`, then
  `cd android && ./gradlew :expo-audio:compileReleaseKotlin`. If Maven
  Central answers 429, a Gradle init script in `~/.gradle/init.d/` that
  puts Google's Maven Central mirror first (and keeps `google()` and
  `gradlePluginPortal()`) gets round it. The log must not show expo-audio
  as prebuilt. The Swift half is only compiled by the EAS build.
- **The owner's preferences** (learned): keep the existing design; match
  AntennaPod's placement; release per phase, merged by you; show before/after screenshots;
  explain results in plain language with clear next steps; ask before spending
  money; the six AntennaPod behaviour changes in `DECISIONS.md` are approved.
