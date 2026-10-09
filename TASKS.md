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
- [ ] Device check of D1–D3 on the end-of-parity EAS build (D-011)

## Phase 2 — screenshot harness ✅
- [x] `npm run shots -- <name>`, `npm run shots:diff`, `shots-tool/README.md`
- [x] Two runs identical; android export + typecheck still green
- [x] Before (v0.3.0) vs after (Phase 1) diff shows only the intended changes
- [ ] Extend routes (+add-feed, feed settings, downloads, history), light and empty-state sets

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
- [ ] Fix nested-Pressable button-in-button on Home cards (moved to Phase 7, Home)

## Phase 4 — Now Playing & mini player ✅
- [x] Mini player on podcast, episode and list screens (hidden while selecting)
- [x] 5-button transport; speed sheet replaces the chip row (slider 0.5–4×, editable presets, saved to the podcast's speed if set, else global) — D-003.3
- [x] Long-press skip amounts; total/remaining toggle
- [x] Chapter row + chapters sheet, seek-bar chapter gaps + scrub bubble, chapter art, cover tap, chapters cached
- [x] Header favourite/sleep + ⋯; sleep sheet (minutes, episodes, extend, fade, shake, vibrate, auto-enable)
- [x] Show notes button (D-012); shots: player, speed / sleep / chapters sheets, mini player on stack screens
- [ ] On device: shake-to-reset threshold, fade volume, seek-bar drag inside the scroll view, chapter art from real feeds

## Phase 5 — Queue ✅
- [x] Pinned, speed-aware info line; header Search + ⋯ (Sort, Lock, Refresh, Clear)
- [x] Sort sheet (date, duration, time left, titles, smart shuffle, random; both directions) + Keep sorted (re-sorts on enqueue, disables drag)
- [x] Drag handles (in-house `DraggableList`, D-013); undo on swipe, move to top/bottom and Clear; multi-select; pull-to-refresh; inbox-aware empty state
- [x] Enqueue location setting (back / front / after current / random), pure `enqueueIndex` + tests
- [x] Shots: queue, menu, sort, select, search, and a real drag (`queue-drag`)
- [ ] On device: drag inside the list on iOS and Android (handle vs scroll vs swipe), edge auto-scroll speed

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
- [ ] Search: Queue/feed chips and "Search online" (search phase)

## Phase 8 — Episode details ✅
- [x] ⋯ menu (skip, inbox, reset, website, open podcast, share link / from position / audio file)
- [x] Inline links (anchors + bare URLs) with long-press Open / Copy / Share; Links list removed (D-003.5); timecode disambiguation by duration, out-of-range times plain (`parseShowNotes`, tested); long-press copy title / podcast; swipe between the podcast's episodes
- [ ] On device: long-press on inline links (react-native-web doesn't route it, so no shot); pager swipe vs vertical scroll
- [ ] Pager follows the list you came from (currently the podcast's episodes)

## Phase 9 — Podcast page / info / preview ✅
- [x] Icon row (Info / Filter / Settings); real ⋯ menu (sort, refresh, refresh complete, website, share, remove all from inbox, mark played, unsubscribe); search; pull-to-refresh; saved filter (include/exclude pairs) + sort; refresh-failed / updates-off / filtered banners
- [x] feed/info/[id] (stats, funding via `podcast:funding`, description with links, feed URL copy); preview state + Subscribe CTA; Discover and Add-by-URL open a preview (D-003.4); previews kept out of Library, refresh, search and Home; startup cleanup after 24 h (D-016)
- [x] Migration 4 (feeds.state, last_refresh_error, episode_filter, episode_sort, funding) + seed
- [ ] Unsubscribe → Archive (needs Library to show archived podcasts: Phase 12)
- [ ] Share with an app subscribe link (no deep links until Phase 17; shares the feed address for now)

## Phase 10 — Per-podcast settings ✅
- [x] Display/Playback/Automation/Advanced groups; "Global (x)" choice wherever a global value exists (D-017)
- [x] Rename, tags, skip ending, volume reduction, new-episodes action (inbox / queue / nothing), auto-download tri-state with include/exclude words and a minimum length, auto-delete tri-state, edit feed address (migration 5)
- [x] Episode filter: already per podcast since Phase 9
- [x] Shots: podcast settings top and automation
- [ ] Password-protected feeds → Phase 17 (needs secure storage, a native module; D-017)
- [ ] On device: skip ending hands over to the next episode; volume reduction level

## Phase 11 — Search & Discovery ✅
- [x] Library search: "Search online" handoff, up to 300 episodes, multi-select; search icons on Library and the Downloads / Favourites / History lists; "Search all podcasts" from the Queue, Inbox and podcast searches (D-018)
- [x] Discover: Apple + fyyd merged (D-007), chart country picker, "Subscribed" marks, subscribed shows hidden from the charts
- [x] Add by URL: clipboard prefill, website autodiscovery (one feed opens, several are offered), password-protected feeds explained
- [x] OPML file import with a checklist and progress (Discover and Settings; Settings also from the clipboard); fixture-based fyyd and query-builder tests
- [x] Shots: discover, discover-search, discover-country, search, search-select, add-feed, opml-import
- [ ] On device: the system file picker for .opml files on Android and iOS; clipboard prefill (iOS shows a paste prompt)

## Phase 12 — Library ✅
- [x] Header: Search, Add, ⋯ (Display, Sort, Filter, Refresh, Archived podcasts, Statistics, Settings) (D-019)
- [x] Display: grid or list, columns (Auto, 2–5), titles, the number on each podcast (unplayed, inbox, downloaded, downloaded and unplayed, none); saved sort including most played; saved filter
- [x] Tag row (replaces the sort chips); long-press a tag to rename or delete it everywhere; refresh-failed mark on tiles
- [x] Long-press multi-select: keep updated, auto-download, auto-delete, speed, add tag, remove from inbox, unsubscribe
- [x] Unsubscribe asks Archive or Delete; Archived podcasts screen; archived podcast page with Subscribe again and Delete
- [x] Episodes screen (shortcut): every subscribed episode, saved filter and order, multi-select, paging
- [x] Shots: library, library-display, library-tag, library-select, archive, feed-archived, episodes, episodes-filter
- [ ] On device: long-press on tiles vs scrolling; tag chip long-press

## Phase 13 — Downloads
- [ ] Running + completed; saved sort; search; delete played (confirm); multi-select; persisted download log with retry; Wi-Fi rule for manual downloads

## Phase 14 — Settings
- [ ] UI, Playback, Downloads, About sections; swipe-action config per screen

## Phase 15 — Statistics
- [ ] Subscriptions / Years / Downloads tabs; filter; reset; per-feed detail + release guess

## Phase 16 — Backup
- [ ] OPML/DB/HTML/favourites export + DB import; OPML import progress

## Phase 17 — Native (EAS build; ask before each)
- [ ] Notifications; background refresh + auto backup; deep links; sharing; secure store (+ feed username/password, from Phase 10)
- [ ] expo-audio gaps via local Expo modules (D-004): lock-screen amounts/buttons, skip silence, volume boost, headset unplug

## Phase 18 — Optional (one proposal each)
- [ ] Sync, Cast, Auto/Wear, widget/tile, video, Echo, binary chapters, nav customisation, parental control

## Discovered (not yet scheduled)
- [ ] `flushPosition` marks an episode played inside the 20 s tail but doesn't dequeue or delete it like `onFinished` does
- [x] A speed chosen in the player isn't saved (fixed by Phase 4's speed sheet)
- [ ] Refresh interval is only checked when the app opens (Phase 17 background refresh)
- [ ] `fetchOlderFeedEpisodes`: a later refresh restores the first page's `next_page_url` (COALESCE), so older pages can be re-fetched; harmless (upserts dedupe) but wasteful
