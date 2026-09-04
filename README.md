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

## Licence

Sage Pod is its own implementation and shares no code with AntennaPod; it
borrows the product model, not the source.
