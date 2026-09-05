# Sage Pod

A podcast player for Android and iOS, built with React Native and Expo.

Sage Pod follows the model set by [AntennaPod](https://github.com/AntennaPod/AntennaPod):
open podcasting over plain RSS, no account, no lock-in. Subscriptions live in a
local SQLite database, episodes download to the device for offline listening,
and your subscription list exports as OPML whenever you want to leave.

## Status

Working end to end: search and subscribe, refresh feeds, queue, background
playback with lock-screen controls, downloads, and per-podcast settings.

## Requirements

- Node 20 or newer
- A **development build** for playback. Background audio and lock-screen
  controls need the `expo-audio` config plugin's native changes, which Expo Go
  does not include. Everything else runs in Expo Go.

## Getting started

```bash
npm install
npm start          # Metro, for use with a development build or Expo Go
```

To make a development build (needed for real playback):

```bash
npx expo prebuild          # generates ios/ and android/
npx expo run:android       # or: npx expo run:ios  (macOS + Xcode)
```

Other scripts:

```bash
npm run typecheck   # app and test type checking
npm test            # feed-parser test suite
```

## How it is put together

```
app/                     Screens (expo-router file-based routes)
  (tabs)/                Queue, Inbox, Discover, Library, Settings
  feed/[id].tsx          One podcast: description, actions, episode list
  episode/[id].tsx       Show notes, links, per-episode actions
  list/[kind].tsx        Favourites / Downloads / History
  player.tsx             Full-screen player (modal)
  add-feed.tsx           Subscribe by pasting an RSS URL

src/
  db/                    SQLite schema, migrations, typed repositories
  feed/                  RSS/Atom parsing, fetching, sync, OPML
  discover/              Podcast search and charts (iTunes Search API)
  player/                Playback engine, React bindings, download manager
  ui/                    Theme tokens and shared components
  util/                  Time and HTML helpers
```

### Data

Everything is local. `src/db/schema.ts` owns the schema and a `user_version`
migration ladder; bump `LATEST_SCHEMA_VERSION` and append to `MIGRATIONS` to
change it.

Screens do not invalidate caches by hand. `useQuery` (`src/db/useQuery.ts`)
subscribes to SQLite's own change notifications, so a write from anywhere — a
background feed refresh, the player saving a position, a download finishing —
repaints whatever is on screen.

### Playback

`src/player/service.ts` is a module singleton, not React state: playback
outlives any screen, keeps running in the background, and is driven from the
lock screen where no component is mounted. React subscribes to it, never the
reverse.

It saves position every five seconds and on every pause, seek and track change,
so a force-quit loses at most a few seconds. An episode within 20 seconds of the
end counts as finished, because nobody sits through the credits.

List rows use `useEpisodePlayback(id)` rather than the full player state — every
episode that isn't playing shares one frozen snapshot object, so a fifty-row
queue re-renders one row per tick instead of fifty.

### Feeds

`src/feed/parser.ts` handles RSS 2.0 and Atom, the iTunes namespace, and Media
RSS. Real feeds are inconsistent, so it tolerates missing GUIDs, relative URLs,
single items that aren't arrays, three different duration formats, and video
enclosures alongside audio. `npm test` covers those cases.

Refreshes send `If-None-Match` / `If-Modified-Since`, so checking an unchanged
feed costs one small 304 rather than a full re-download.

### Discovery

Podcast search uses Apple's public iTunes Search API, which needs no API key or
account, so the app works the moment it is installed. Any RSS URL can also be
pasted directly.

## Releases

Releases are automated. You never bump a version by hand — **the commit
messages decide it**.

Pushing to `main` runs `.github/workflows/semantic-release.yml`, which
typechecks, runs the tests, then lets
[semantic-release](https://semantic-release.gitbook.io/) read every commit since
the last tag and:

1. pick the next version from the [Conventional Commit](https://www.conventionalcommits.org/)
   types in that range,
2. prepend the notes to `CHANGELOG.md`,
3. stamp that version into `app.json` (`expo.version`, plus
   `android.versionCode` and `ios.buildNumber`) and `package.json`,
4. tag the commit and publish a GitHub Release,
5. commit the changed files back as `chore(release): X.Y.Z [skip ci]`.

So the tag, the GitHub Release, the CHANGELOG and the shipped app version
always carry the same number.

| Commit prefix | Release |
|---|---|
| `fix: …` | patch — `1.2.3` → `1.2.4` |
| `feat: …` | minor — `1.2.3` → `1.3.0` |
| `perf: …` | patch |
| `feat!: …`, or `BREAKING CHANGE:` in the body | major — `1.2.3` → `2.0.0` |
| `docs/chore/ci/refactor/test/style/build: …` | **none** — appears in the notes only |

A branch of only `chore`/`docs`/`ci` commits merges without releasing. That is
deliberate, not a failure.

Preview what the next push would release, without publishing:

```bash
npx semantic-release --dry-run --no-ci
```

### One-time setup still outstanding

The pipeline is deliberately held at pre-1.0, which needs a baseline tag that
does not exist on the remote yet. **Until you create it, the release workflow
fails on purpose** rather than publishing 1.0.0:

```bash
git tag -a v0.1.0 $(git rev-list --max-parents=0 HEAD) -m "Baseline v0.1.0"
git push origin v0.1.0
```

With that tag in place the first release is `0.2.0`, and `feat:` keeps bumping
the minor within `0.x`. When you are ready to declare 1.0, delete the
"Require a version baseline" step from the workflow and land a commit with a
`BREAKING CHANGE:` body.

### Store build numbers

`tool/set_app_version.sh` derives `versionCode` / `buildNumber` as
`major*10000 + minor*100 + patch` (so `1.4.0` → `10400`). App Store Connect and
Google Play both require this integer to strictly increase, which it does for
any ascending semver. Note the ceiling: minor and patch are capped at 99 each.

## Licence

Sage Pod is its own implementation and shares no code with AntennaPod; it
borrows the product model, not the source.
