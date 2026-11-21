# Sage Pod — AntennaPod parity

Source of truth for progress. Tick an item only once it's verified (tests,
checks, screenshot diff). Add anything you discover. Full detail per phase:
`docs/PARITY-PLAN.md`. Settled decisions: `docs/DECISIONS.md`. How to work:
`docs/HANDOVER.md`.

**Rules:** one Conventional Commit per step; each step has a `node:test` test
or a screenshot diff; SQL only in `src/db`; colours and sizes via theme tokens;
update `shots-tool/seed.mjs` with every migration. One phase = one PR = one
release (D-002).
**Stop and ask:** spending (EAS builds), merging to `main`, a new native
dependency, a visible design change beyond AntennaPod placement, anything
destructive.

## Phase 0 — setup ✅
- [x] Base branch: restarted from `main` after PR 9 merged (v0.3.0)
- [x] Baseline green: typecheck, test, expo-doctor, android export

## Phase 1 — defects (fix:) ✅
- [x] D1 queue queries return per-podcast speed / skip-intro (shared `src/db/columns.ts`)
- [x] D2 sleep timer counts only while playing; "end of episode" pauses at the real end
- [x] D3 rewind on every resume, AntennaPod's pause-scaled amounts (setting becomes on/off, legacy migrated)
- [x] D4 skip-intro "Global" option removed (it meant Off)
- [x] D5 every enqueue path clears the inbox flag
- [x] D6 podcast page pages 150 at a time + "Load older episodes" for paged feeds
- [x] Device check of D1–D3 on the end-of-parity EAS build (D-011)

## Phase 2 — screenshot harness ✅
- [x] `npm run shots -- <name>`, `npm run shots:diff`, `shots-tool/README.md`
- [x] Two runs identical; android export + typecheck still green
- [x] Before (v0.3.0) vs after (Phase 1) diff shows only the intended changes
- [x] Extend routes (+add-feed, feed settings, downloads, history), light (`SHOTS_SCHEME=light`) and empty-state (`SHOTS_EMPTY=1`) sets

## Phase 3 — shared building blocks ✅
- [x] Typed `EpisodeAction` + pure, tested `episodeActionsFor` / `rowButtonFor` / selection helpers (`src/actions/`)
- [x] ActionSheet, UndoToast, OverflowMenu, SelectionBar, EpisodeRow long-press, state button + progress ring, status glyphs, playing highlight
- [x] Undo for remove from inbox / queue, mark played/unplayed, reset position; confirmed delete
- [x] Multi-select on the podcast page and Favourites / Downloads / History
- [x] Podcast page ⋯ menu replaces the one-tap Unsubscribe; Downloads trash icon confirms
- [x] "Prefer streaming" setting (D-010)
- [x] PR Checks workflow (typecheck, test, expo-doctor, android bundle)
- [x] Screenshot harness: interaction shots (long-press sheet, selection, ⋯ menu)
- [x] No migration needed (types per phase instead: FeedOverride/FeedState → Phase 10, EnqueuePosition → Phase 5, HomeSectionId → Phase 7)
- [x] Fix nested-Pressable button-in-button on Home cards (done in Phase 7: open and play are sibling buttons)

## Phase 4 — Now Playing & mini player ✅
- [x] Mini player on podcast, episode and list screens (hidden while selecting)
- [x] 5-button transport; speed sheet replaces the chip row (slider 0.5–4×, editable presets, saved to the podcast's speed if set, else global) — D-003.3
- [x] Long-press skip amounts; total/remaining toggle
- [x] Chapter row + chapters sheet, seek-bar chapter gaps + scrub bubble, chapter art, cover tap, chapters cached
- [x] Header favourite/sleep + ⋯; sleep sheet (minutes, episodes, extend, fade, shake, vibrate, auto-enable)
- [x] Show notes button (D-012); shots: player, speed / sleep / chapters sheets, mini player on stack screens
- [x] On device: shake-to-reset threshold, fade volume, seek-bar drag inside the scroll view, chapter art from real feeds

## Phase 5 — Queue ✅
- [x] Pinned, speed-aware info line; header Search + ⋯ (Sort, Lock, Refresh, Clear)
- [x] Sort sheet (date, duration, time left, titles, smart shuffle, random; both directions) + Keep sorted (re-sorts on enqueue, disables drag)
- [x] Drag handles (in-house `DraggableList`, D-013); undo on swipe, move to top/bottom and Clear; multi-select; pull-to-refresh; inbox-aware empty state
- [x] Enqueue location setting (back / front / after current / random), pure `enqueueIndex` + tests
- [x] Shots: queue, menu, sort, select, search, and a real drag (`queue-drag`)
- [x] On device: drag inside the list on iOS and Android (handle vs scroll vs swipe), edge auto-scroll speed

## Phase 6 — Inbox ✅
- [x] Search; ⋯ Sort (date / duration, saved) + Remove all (confirm, "Don't ask again", undo, follows the podcast chip)
- [x] Swipes swapped to AntennaPod's (right = queue, left = remove) with undo (D-003.2); Add to queue is undoable everywhere
- [x] Multi-select; ≥25 selected asks first on every screen (`needsBulkConfirm`, tested); paging by 100
- [x] Drop the now-redundant dismiss after enqueue in `inbox.tsx` (done in Phase 1 review)
- [x] Shots: inbox menu, sort, select, and a real touch swipe (`inbox-swipe`)
- [x] Sort also feeding Home's "See what's new" (done in Phase 7)

## Phase 7 — Home ✅
- [x] Fix nested-Pressable button-in-button on Home cards (web a11y warning)
- [x] Section chrome + empty texts; queue section; See what's new (inbox sort, swipeable); Classics (3 y); Manage downloads; keep in-progress shelf (D-003.6, now only unqueued episodes)
- [x] Header Search (new local `search` route, every word must match) + ⋯ Refresh / Configure home (show, hide, reorder; `HomeSectionId[]` saved)
- [x] AGENTS.md: PRs merge with a merge commit, so PR titles need no Conventional prefix
- [x] Search: "Search online" (Phase 11); the queue and each podcast page search in place (their 🔍), standing in for AntennaPod's chips

## Phase 8 — Episode details ✅
- [x] ⋯ menu (skip, inbox, reset, website, open podcast, share link / from position / audio file)
- [x] Inline links (anchors + bare URLs) with long-press Open / Copy / Share; Links list removed (D-003.5); timecode disambiguation by duration, out-of-range times plain (`parseShowNotes`, tested); long-press copy title / podcast; swipe between the podcast's episodes
- [x] On device: long-press on inline links (react-native-web doesn't route it, so no shot); pager swipe vs vertical scroll
- [x] Pager follows the list you came from (`src/episode/pagerList`, `EpisodeList`); a deep link falls back to the podcast's episodes

## Phase 9 — Podcast page / info / preview ✅
- [x] Icon row (Info / Filter / Settings); real ⋯ menu (sort, refresh, refresh complete, website, share, remove all from inbox, mark played, unsubscribe); search; pull-to-refresh; saved filter (include/exclude pairs) + sort; refresh-failed / updates-off / filtered banners
- [x] feed/info/[id] (stats, funding via `podcast:funding`, description with links, feed URL copy); preview state + Subscribe CTA; Discover and Add-by-URL open a preview (D-003.4); previews kept out of Library, refresh, search and Home; startup cleanup after 24 h (D-016)
- [x] Migration 4 (feeds.state, last_refresh_error, episode_filter, episode_sort, funding) + seed
- [x] Unsubscribe → Archive (done in Phase 12: unsubscribing asks Archive or Delete)
- [ ] Share with an app subscribe link (no deep links until Phase 17; shares the feed address for now)

## Phase 10 — Per-podcast settings ✅
- [x] Display/Playback/Automation/Advanced groups; "Global (x)" choice wherever a global value exists (D-017)
- [x] Rename, tags, skip ending, volume reduction, new-episodes action (inbox / queue / nothing), auto-download tri-state with include/exclude words and a minimum length, auto-delete tri-state, edit feed address (migration 5)
- [x] Episode filter: already per podcast since Phase 9
- [x] Shots: podcast settings top and automation
- [x] Password-protected feeds (Phase 17a, D-024)
- [x] On device: skip ending hands over to the next episode; volume reduction level

## Phase 11 — Search & Discovery ✅
- [x] Library search: "Search online" handoff, up to 300 episodes, multi-select; search icons on Library and the Downloads / Favourites / History lists; "Search all podcasts" from the Queue, Inbox and podcast searches (D-018)
- [x] Discover: Apple + fyyd merged (D-007), chart country picker, "Subscribed" marks, subscribed shows hidden from the charts
- [x] Add by URL: clipboard prefill, website autodiscovery (one feed opens, several are offered), password-protected feeds explained
- [x] OPML file import with a checklist and progress (Discover and Settings; Settings also from the clipboard); fixture-based fyyd and query-builder tests
- [x] Shots: discover, discover-search, discover-country, search, search-select, add-feed, opml-import
- [x] On device: the system file picker for .opml files on Android and iOS; clipboard prefill (iOS shows a paste prompt)

## Phase 12 — Library ✅
- [x] Header: Search, Add, ⋯ (Display, Sort, Filter, Refresh, Archived podcasts, Statistics, Settings) (D-019)
- [x] Display: grid or list, columns (Auto, 2–5), titles, the number on each podcast (unplayed, inbox, downloaded, downloaded and unplayed, none); saved sort including most played; saved filter
- [x] Tag row (replaces the sort chips); long-press a tag to rename or delete it everywhere; refresh-failed mark on tiles
- [x] Long-press multi-select: keep updated, auto-download, auto-delete, speed, add tag, remove from inbox, unsubscribe
- [x] Unsubscribe asks Archive or Delete; Archived podcasts screen; archived podcast page with Subscribe again and Delete
- [x] Episodes screen (shortcut): every subscribed episode, saved filter and order, multi-select, paging
- [x] Shots: library, library-display, library-tag, library-select, archive, feed-archived, episodes, episodes-filter
- [x] On device: long-press on tiles vs scrolling; tag chip long-press

## Phase 13 — Downloads ✅
- [x] Own screen (D-020): in progress (waiting, running, failed with Retry) above finished; saved sort (date, title, duration, size, both ways); search; size total; multi-select
- [x] Delete played (confirm, keeps favourites); delete confirmation on each row (existing action)
- [x] Download log kept across restarts (migration 6, newest 200), details copyable, Retry for failed entries
- [x] Manual downloads on mobile data ask first when "Download on Wi-Fi only" is on
- [x] Shots: downloads, downloads-search, downloads-log, downloads-log-entry
- [x] On device: progress while downloading; the mobile-data prompt; retry from the log

## Phase 14 — Settings ✅
- [x] Settings split into pages (D-021): User interface, Playback, Downloads, Import and export, About; Reset on the first page
- [x] User interface: theme, show remaining time, adjust times to speed, prefer streaming, default episode order, swipe actions
- [x] Swipe actions per list (Inbox and Home's inbox, Queue, Episodes, Downloads); Episodes and Downloads gain swipes
- [x] Playback: skip amounts, default speed, editable speed presets, rewind on resume, enqueue location, play next, remove finished, smart mark as played (default 30 s), keep skipped episodes
- [x] Downloads: refresh interval, new episodes, refresh now; mobile data for downloads, refresh and streaming (asks first); automatic download; limit, episode cleanup, delete when finished, delete removes from queue
- [x] About: version from expo-constants, privacy, licences
- [x] Settings schema test (every default is an offered choice); swipe, played-rule and cleanup tests
- [x] Shots: settings, settings-interface, settings-swipes, settings-swipe-choice, settings-playback, settings-downloads, settings-import-export, settings-about
- [x] Download only when charging (Phase 17a, D-024)
- [x] On device: swipe each list's pairs; the streaming prompt on mobile data; skipping near the end marks played

## Phase 15 — Statistics ✅
- [x] Subscriptions / Years / Downloads tabs (D-022), charts drawn with react-native-svg
- [x] Date range filter and "include marked played", saved as settings
- [x] Reset statistics with a confirmation (counts from the reset; history kept for Home)
- [x] Per-podcast statistics with a release schedule guess, also on the podcast info page
- [x] Tests: grouping by podcast, month and year; ranges; donut slices; release schedule
- [x] Shots: stats, stats-years, stats-downloads, stats-range, stats-marked, stats-feed
- [x] On device: listen for a while and check the totals; reset and check they read zero

## Phase 16 — Backup ✅
- [x] Import and export page in AntennaPod's order (D-023): Database (export, import), OPML export, Copy OPML, HTML export, favourites export, OPML import
- [x] Exports saved to a folder the listener picks (no expo-sharing); dated file names
- [x] Database export via SQLite's backup API; import staged, checked (Sage Pod database, intact, not newer), confirmed, then replaced in one step, migrated and restarted
- [x] OPML import progress (already in the Phase 11 checklist)
- [x] Tests: file names, HTML escaping and grouping, non-web links stay text, backup check
- [x] Shots: settings, settings-import-export
- [x] On device: export each file to Downloads and a cloud drive; export, change something, import, and check feeds, queue and positions come back; import an AntennaPod .db and a random file (both refused)

## Phase 17a — Native, Expo modules (D-024) ✅
- [x] Notifications: new episodes per podcast (migration 7), refresh and download errors, Settings › Notifications, taps open the screen
- [x] Background refresh at the refresh interval; automatic backup every 3 days keeping 5 (picked folder on Android, Files app on iOS)
- [x] Feed username and password in secure storage, sent only to the feed's host; login prompt on 401
- [x] itpc / pcast / feed / podcast links open Add podcast
- [x] Share a downloaded episode's audio file
- [x] Automatic downloads only while charging
- [x] Tests: notification content, backup schedule and pruning, credentials, podcast links
- [x] Shots: settings, settings-notifications, settings-downloads-auto, settings-import-export, feed-settings-auth
- [x] On device: each notification and its tap; a background refresh overnight; automatic backup lands and prunes; a protected feed (add, refresh, stream, download); an itpc:// link from a browser; share a file; unplug and check auto-downloads wait

## Phase 17b — expo-audio patch (D-025) ✅
- [x] Route: patch-package on expo-audio 57.0.5, built from source on Android
- [x] Lock screen and notification use the listener's skip amounts; a Next button plays the next queued episode
- [x] Skip silence (speed sheet and Settings › Playback; Android)
- [x] Volume adaptation: light/medium/heavy boost besides the reductions (Android)
- [x] Pause when headphones are unplugged (Android)
- [x] iOS: remote-command targets no longer pile up on each load
- [x] Tests: volume factors, boost gains
- [x] Shots: feed-settings, settings-playback
- [x] On device: lock-screen skips at 30 s / 15 s; Next from lock screen and notification; skip silence on a talk show; each boost level; unplug wired and Bluetooth headphones; iOS build compiles the patched Swift

## Phase 18a — Widget and Quick Settings tile (D-026) ✅
- [x] Android home-screen widget: cover, title, podcast, time left, progress; skip back, play/pause, skip forward; tap opens the player
- [x] Widget buttons work when the app isn't running (the last episode is restored first)
- [x] Quick Settings tile: play/pause through the media session; opens the app when nothing is loaded
- [x] Correct the audio patch's binder mismatch: the internal player uses a separate binding action from Media3 controllers (D-026)
- [x] Media notification artwork badge uses Sage Pod's configured notification icon instead of Media3's generic play icon (D-026)
- [x] Rounded, larger-intrinsic-size skip/Next vectors for notification controls; 5/10/15/30-second labels retained; Android resource build passes (D-026)
- [x] Compile the corrected audio patch: verified by the EAS builds from 0.23.1 on (most recently 0.24.1)
- [x] Tests: widget model and change check
- [x] On device: add the widget, resize it, light and dark; each button with the app open, backgrounded and swiped away; add the tile, toggle it while playing, paused and after a reboot
- [x] On a new APK: cold-start playback shows notification metadata and play/pause, configured skips and Next; controls work in the background and on the lock screen; switch episodes; open the tile before and after starting playback; no "invalid binder type" errors; another music app still pauses Sage Pod
- [x] On a new APK: media notification badge shows Sage Pod's owl during service startup and playback, including on the lock screen
- [x] On Redmi Pad SE / Android 15: compare rounded controls with the previous APK in portrait and landscape; verify 5/10/15/30 skips and a nonstandard amount; Next advances the queue; system play/pause still works

## Phase 18b — Embedded chapters (D-027) ✅
- [x] ID3 CHAP (title, link, picture) and MP4 chapters (QuickTime track, Nero) read from the audio file when the feed gives no chapters
- [x] Streams read with HTTP ranges (only the tag or `moov`); downloads read from disk
- [x] On a device: a streamed MP3 and a downloaded M4A with chapters show them in the player

## Phase 19 — Background downloads (D-029) ✅
- [x] 19a: the download log records size, time, speed, resume and background share ("Transfer"); `transferSummary` tests
- [x] 19b: local Expo module `modules/episode-downloads`: WorkManager worker (unique per episode, expedited taps, unmetered / charging for auto, foreground `dataSync`, Wi-Fi lock, `.part` + Range / If-Range resume, 3 runs, fail fast 401/403/404/410 and HTML, restart on 416), shared progress notification that opens Downloads
- [x] 19c: downloads.ts uses the module on Android; held list and JS queue bypassed there; WorkInfo reconciled into SQLite live, at startup and in the background refresh; Expo Go, iOS and web keep the JS path (tests: `pickWork`, `reconcileAction`)
- [x] 19d: iOS keeps its background URLSession; a relaunch restarts the file (recorded in D-029)
- [x] On device: start 3 downloads, lock the screen; switch apps; swipe the app away; airplane mode mid-download resumes (log says "resumed from"); reboot with auto downloads pending on Wi-Fi + charging; tap the notification; a protected feed; a 404 (fails once, logged); cancel mid-download (partial file gone)

## Phase 20 — Echo, the year in review (D-030) ✅
- [x] 20a: `src/echo/` pure helpers (window, queue outlook, median delay, listener type, hoarder verdict, thanks line, top 5) + `getEchoYear` repository + tests
- [x] 20b: `/echo` story screen: 7 cards, 10 s auto-advance, tap forward/back, hold to pause, progress bar, animated SVG backgrounds (still with reduce motion)
- [x] 20c: Home card (10–31 Dec, ≥ 10 h, hide for the year) + Statistics menu entry
- [x] 20d: share as text (`Share` API); image sharing is a separate native proposal
- [x] 20e: harness shots (7 cards via `/echo?still=1&card=n`, Home card and Statistics entry at 15 Dec; the seed's year of history already qualifies), checks, Android fingerprint unchanged (e6bc…) → ships over the air
- [x] On device after the update: Home card from 10 Dec; tap, hold and back on the cards; Share; reduce motion keeps the timer but stills the shapes; TalkBack stops auto-advance

## Phase 21 — Solid bars, Sage Pod's own dialogs, rebuilt swipes (D-031) ✅
- [x] 21a: solid docked tab bar (`TabBar`, Material 3 pill) and player bar; glass opt-in (Settings › User interface › Glass effects, `glassEffects`)
- [x] 21b: `showDialog` replaces all 34 `Alert.alert` calls (themed card, Cancel/confirm/destructive buttons, Back = Cancel, queued); `dialogModel` tests
- [x] 21c: swipes rebuilt on Reanimated (`swipeMath` tests): labelled strip, commit point with colour fill and haptic tick, slide-off, spring back, screen-reader actions
- [x] 21d: Move to bottom and Share swipes (AntennaPod 3.13); undo toast slides in and out
- [x] 21e: harness shots for both dialogs and a held swipe; every screen re-shot (`screenshots/before` → `after`)
- [ ] On device: tab bar and player bar on phone and tablet; each list's swipes (strip, tick, Undo); clear the queue, unsubscribe, reset settings; Glass effects on and off
- [x] Released as v0.26.0 (21 Nov 2026), with the clean-up before going public: `fast-xml-parser` 5.12.1 (GHSA-474x-hrwr-fgx4), personal agent files removed, `.gitignore` covers secrets and built packages

## Phase 22 — Fixes from the Discovered list
- [x] 22a: "Load older episodes" cursor (`src/feed/pageCursor.ts`, node:sqlite test): a refresh no longer rewinds it to page 2; `''` marks the last page; only "Refresh complete podcast" starts over
- [x] 22b: leaving an episode in the smart-mark tail (another episode, Stop) finishes it like the real end: played, out of the queue, download deleted per settings (`afterLeaving`); a pause there only marks it played; a skip there now also deletes the download, as in AntennaPod
- [x] 22c: Podlove Simple Chapters (`<psc:chapters>`) from the feed, stored in `episodes.chapters_json` (schema 8); the chapters file wins, the audio's chapters are the fallback
- [ ] On device: leave an episode 10 s before the end with Delete after finished on; a Podlove feed (e.g. Freak Show) shows chapters

## Phase 23 — Ogg, Opus and FLAC chapters (D-027)
- [x] 23a: `src/player/embedded/vorbis.ts` reads `CHAPTERxxx` / `CHAPTERxxxNAME` / `CHAPTERxxxURL` Vorbis comments from the Ogg comment header (Vorbis and Opus, across pages) and FLAC's VORBIS_COMMENT block; cover art in the comments is skipped unread; tests build Ogg and FLAC files
- [ ] On device: an Opus podcast with chapters, downloaded and streamed

## Phase 24 — Expo SDK 58 and a taller widget (D-032)
- [x] 24a: Expo SDK 58 (React Native 0.88, Gesture Handler 3, expo-router 58); type fixes for RN 0.88 and the new tab bar props; expo-doctor clean
- [x] 24b: expo-audio patch rewritten for 58.0.12 (161 lines, was 973): single-player Next → `remoteNext`, skip silence, volume boost, iOS skip forward kept; 58's own skip intervals, Next button and unplug pause used instead of ours; Kotlin compiled locally
- [x] 24c: widget resizable up to 260 dp tall; two-row layout with Next episode from 120 × 250 dp (`src/widget/layout.ts`, tests)
- [ ] One EAS production build (owner approved: SDK 58 and widget together)
- [ ] On device: lock-screen and notification skip amounts and Next; skip silence; volume boost; unplug pauses; swipes, queue drag and seek bar on Gesture Handler 3; widget resized taller, Next from the widget
- [x] Move `Gesture.*` to Gesture Handler 3's hook API (`usePanGesture`, `useTapGesture`, `useCompetingGestures`): swipe rows, queue drag handles, seek bar, glass segmented control

## Open source and Google Play
- [x] GPL-3.0-or-later licence; CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, PRIVACY; issue and PR templates
- [x] CI: actions pinned to commits, `permissions: {}` by default, CodeQL (public repos only), Dependabot (Expo/RN excluded)
- [x] Play listing in `fastlane/metadata/android/en-US` (texts, icon, feature graphic, screenshots via `tool/store_assets.py`); `docs/PLAY-STORE.md`
- [x] Owner: replace `SUPPORT_EMAIL` in PRIVACY, SECURITY and CODE_OF_CONDUCT (faithsoul.feed@gmail.com)
- [x] Owner: make the repository public (21 Nov 2026; the 5 early commits with the owner's email kept, by choice)
- [x] Owner: Code security, Actions and merge settings from `docs/GOING-PUBLIC.md`, email privacy, and Vercel › Ignored Build Step (21 Nov 2026; previews now report "Ignored" when the site is unchanged)
- [ ] Owner: set the "protect main" ruleset (block deletion and force pushes) from Disabled to Active
- [x] Owner: Play developer account, create the app, first internal-testing upload (versionCode 2501, 7 Nov 2026). Build `8d24cea5` re-signed with the new upload key (SHA-1 `CB:CF:CF:C7:…:AD:5D`), which is now in EAS — see `docs/PLAY-STORE.md` › Upload key
- [x] Next EAS production build: 0.25.2 (versionCode 2502, build `e2b2d60a`) signed with the upload key `CB:CF:CF:C7:…:AD:5D`, accepted on internal testing; drops `ACTIVITY_RECOGNITION` so the Health apps form no longer applies
- [ ] Owner: closed test with at least 12 testers for 14 days before production (new personal accounts). Set up on 21 Nov 2026 with v0.29.0 (versionCode 2900); then Dashboard › Apply for production
- [ ] Before the first iOS build (needs a paid Apple developer account): change `ios.bundleIdentifier` in `app.json` to `com.sagefromtheeast.sagepodplayer` to match Android. Apple fixes it at registration.
- [x] EAS Submit: `eas-submit` service account (Play: release to testing tracks) and its JSON key in EAS (owner, 21 Nov 2026)
- [ ] First `eas submit` with the next release build: internal track, draft; confirm it appears in Play Console
- [x] `decode-uri-component` advisory (via expo-router): fixed by the SDK 58 upgrade (Phase 24)
- [ ] Consider R8 minification and EAS Update code signing for release builds (each needs a device test)

## Phase 18 — Optional (one proposal each)
- [x] Echo (Phase 20, D-030)
- [ ] Sync, Cast, Auto/Wear, video, nav customisation, parental control (3.13 adds a password on the Add podcast screen)
- [ ] Podcast Index and gPodder.net as extra Discover search sources (Podcast Index needs an API key; both add a host to PRIVACY.md)
- [x] Resizable home-screen widget (AntennaPod 3.13): Phase 24c

## Discovered (not yet scheduled)
- [x] expo-doctor failed after Expo's SDK 57 patch releases (expo 57.0.32 and 15 more): fixed with `npx expo install --fix`, which changes the runtime, so it ships in a build
- [x] "Publish OTA update" never ran: fixed by the owner reconnecting the repo on expo.dev (6 Nov); the PR #35 merge started the first run
- [x] Confirm the first "Publish OTA update" runs succeed: 6 Nov, PR #35 at 16:53 UTC and v0.25.0 at 17:26 UTC, for runtime `f069fcd…` (the 0.24.1 APK). Each run waits roughly 20 minutes in the EAS queue
- [ ] iOS home-screen widget (expo-widgets can show what's playing, but its buttons can't reach the player; D-026)
- [ ] Hardware headset next/previous buttons seek instead of changing episode (AntennaPod's "Hardware forward button skips" setting). Blocked: expo-audio sends the headset's and the notification's Next as the same `remoteNext` event, so telling them apart needs the expo-audio patch (D-025) extended
- [ ] Skip silence and volume boost on iOS (needs an audio tap; D-025)
- [x] Ogg / Opus chapters (Vorbis comments) (D-027): Phase 23
- [x] Podlove Simple Chapters in the feed (Phase 22c)
- [x] `flushPosition` marks an episode played inside the smart-mark tail but doesn't dequeue or delete it like `onFinished` does (Phase 22b)
- [x] A speed chosen in the player isn't saved (fixed by Phase 4's speed sheet)
- [x] Refresh interval is only checked when the app opens (fixed by Phase 17a's background refresh)
- [x] `fetchOlderFeedEpisodes`: a later refresh restores the first page's `next_page_url` (COALESCE), so older pages can be re-fetched (Phase 22a)
