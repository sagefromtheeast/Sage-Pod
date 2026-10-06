<div align="center">

<img src="assets/icon.png" alt="Sage Pod" width="120" height="120" />

# Sage Pod

**A local-first podcast player for iOS & Android — built with React Native and Expo.**

[![Expo SDK](https://img.shields.io/badge/Expo_SDK-57-000020?logo=expo&logoColor=white)](https://expo.dev)
[![React Native](https://img.shields.io/badge/React_Native-0.86-61DAFB?logo=react&logoColor=black)](https://reactnative.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![New Architecture](https://img.shields.io/badge/New_Arch-Fabric-4ADE80)](https://reactnative.dev/architecture/landing-page)
![Platforms](https://img.shields.io/badge/platforms-iOS_·_Android-16A34A?logo=apple&logoColor=white)
![Status](https://img.shields.io/badge/status-pre--1.0-E9B764)

</div>

Sage Pod follows the model set by [AntennaPod](https://github.com/AntennaPod/AntennaPod):
open podcasting over plain RSS, no account, no lock-in. Subscriptions live in a
local SQLite database, episodes download to the device for offline listening,
and your subscription list exports as OPML whenever you want to leave.

---

## ✨ Features

- 🔎 **Discover** — full-text podcast search and charts via Apple's public iTunes API (no key, no account), or subscribe by pasting any RSS URL.
- 📥 **Inbox & queue** — newest episodes across every subscription, a continue-listening shelf, and a reorderable play queue.
- ▶️ **Background playback** — lock-screen and notification controls, resume-from-position, variable speed, skip intervals, and a sleep timer.
- ⬇️ **Offline downloads** — a throttled queue with Wi-Fi-only enforcement, per-podcast auto-download, and a storage cap.
- 🦉 **Themed to the bone** — light / dark / OLED palettes, plus the Sage the Owl icon across every appearance.

## 🚀 Quick start

```bash
npm install
npm start            # Metro — for a dev build or Expo Go
```

Real playback (background audio + lock-screen controls) needs a **development
build** — the `expo-audio` config plugin ships native changes that Expo Go
doesn't include. Everything else runs in Expo Go.

```bash
npx expo prebuild --clean     # generate ios/ and android/
npx expo run:ios              # or: npx expo run:android
```

## 🧰 Scripts

| Command | What it does |
|---|---|
| `npm start` | Start the Metro dev server |
| `npm run typecheck` | Type-check the app **and** the test sources |
| `npm test` | Run the feed-parser / util test suite |
| `npx expo prebuild --clean` | Regenerate the native `ios/` and `android/` projects |
| `npm run shots -- <name>` | Screenshot every screen at phone/tablet sizes into `screenshots/<name>/` |
| `npm run shots:diff` | Compare `screenshots/before` vs `after` (pixel diff + `compare.html`) |

> **Node 22+** is required — the test runner uses `node --experimental-strip-types`.

## 🧩 Tech stack

- **Expo SDK 57** · **React Native 0.86** · **New Architecture (Fabric)**
- **expo-router** for file-based navigation
- **expo-audio** for playback + lock-screen controls
- **expo-sqlite** for local, offline-first storage
- **TypeScript (strict)** throughout

## 🗂 Project structure

```text
app/                     Screens (expo-router file-based routes)
  (tabs)/                Home, Queue, Inbox, Discover, Library
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
  ui/                    Theme tokens, glass surfaces, shared components
  util/                  Time and HTML helpers

assets/                  App icon, adaptive/monochrome layers, splash
  branding/              Source art for the Sage the Owl appearances
```

## 🏛 Architecture

### 🗃 Data

Everything is local. `src/db/schema.ts` owns the schema and a `user_version`
migration ladder; bump `LATEST_SCHEMA_VERSION` and append to `MIGRATIONS` to
change it.

Screens don't invalidate caches by hand. `useQuery` (`src/db/useQuery.ts`)
subscribes to SQLite's own change notifications, so a write from anywhere — a
background feed refresh, the player saving a position, a download finishing —
repaints whatever is on screen.

### 🔊 Playback

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

### 📡 Feeds

`src/feed/parser.ts` handles RSS 2.0 and Atom, the iTunes namespace, and Media
RSS. Real feeds are inconsistent, so it tolerates missing GUIDs, relative URLs,
single items that aren't arrays, three different duration formats, and video
enclosures alongside audio. `npm test` covers those cases.

Refreshes send `If-None-Match` / `If-Modified-Since`, so checking an unchanged
feed costs one small 304 rather than a full re-download.

### 🧭 Discovery

Podcast search uses Apple's public iTunes Search API, which needs no API key or
account, so the app works the moment it is installed. Any RSS URL can also be
pasted directly.

## 🗺 Roadmap & handover

- [`TASKS.md`](TASKS.md): phase-by-phase progress toward AntennaPod parity
- [`docs/PARITY-PLAN.md`](docs/PARITY-PLAN.md): the feature audit and full plan
- [`docs/DECISIONS.md`](docs/DECISIONS.md): settled decisions
- [`docs/HANDOVER.md`](docs/HANDOVER.md): guide for whoever (or whatever AI) leads development next

## 📄 License

Sage Pod is its own implementation and shares no code with AntennaPod; it
borrows the product model, not the source.
