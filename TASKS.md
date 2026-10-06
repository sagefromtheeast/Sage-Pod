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

## Phase 5 — Queue
- [ ] Pinned speed-aware info line; ⋯ Sort/Lock/Clear; Search icon
- [ ] Sort sheet + Keep sorted; drag handles; undo on swipe; pull-to-refresh; inbox-aware empty state
- [ ] Enqueue location setting (back / front / after current / random)

## Phase 6 — Inbox
- [ ] Search; ⋯ Sort + Remove all (confirm); swipes swapped to AntennaPod's + undo (D-003.2); multi-select; paging
- [x] Drop the now-redundant dismiss after enqueue in `inbox.tsx` (done in Phase 1 review)

## Phase 7 — Home
- [ ] Fix nested-Pressable button-in-button on Home cards (web a11y warning)
- [ ] Section chrome + empty texts; queue section; See what's new; Classics; Manage downloads; keep in-progress shelf (D-003.6)
- [ ] Header Search + ⋯ Refresh / Configure home

## Phase 8 — Episode details
- [ ] ⋯ menu (skip, inbox, reset, website, open podcast, share options)
- [ ] Inline links + long-press, Links list removed (D-003.5); timecode disambiguation; copy; swipe between episodes

## Phase 9 — Podcast page / info / preview
- [ ] Icon row; real ⋯ menu (no more one-tap Unsubscribe); search; pull-to-refresh; saved filter + sort; banners
- [ ] feed/info/[id] (stats, funding, URL copy); preview state + Subscribe CTA, Discover opens preview (D-003.4)

## Phase 10 — Per-podcast settings
- [ ] Display/Playback/Automation/Advanced groups with FeedOverride everywhere
- [ ] Rename, tags, skip ending, volume reduction, auto-delete, new-episodes action, auto-download tri-state, episode filter, auth, edit URL

## Phase 11 — Search & Discovery
- [ ] Local search route + entry icons (wire up `searchEpisodes()`); fyyd (D-007); country; subscribed marks; clipboard; autodiscovery; OPML file import

## Phase 12 — Library
- [ ] Display ⋯ (columns, titles, counter, sort); filter; tags; archive; error badge; multi-select; "+"; Episodes screen

## Phase 13 — Downloads
- [ ] Running + completed; saved sort; search; delete played (confirm); multi-select; persisted download log with retry; Wi-Fi rule for manual downloads

## Phase 14 — Settings
- [ ] UI, Playback, Downloads, About sections; swipe-action config per screen

## Phase 15 — Statistics
- [ ] Subscriptions / Years / Downloads tabs; filter; reset; per-feed detail + release guess

## Phase 16 — Backup
- [ ] OPML/DB/HTML/favourites export + DB import; OPML import progress

## Phase 17 — Native (EAS build; ask before each)
- [ ] Notifications; background refresh + auto backup; deep links; sharing; secure store
- [ ] expo-audio gaps via local Expo modules (D-004): lock-screen amounts/buttons, skip silence, volume boost, headset unplug

## Phase 18 — Optional (one proposal each)
- [ ] Sync, Cast, Auto/Wear, widget/tile, video, Echo, binary chapters, nav customisation, parental control

## Discovered (not yet scheduled)
- [ ] `flushPosition` marks an episode played inside the 20 s tail but doesn't dequeue or delete it like `onFinished` does
- [x] A speed chosen in the player isn't saved (fixed by Phase 4's speed sheet)
- [ ] Refresh interval is only checked when the app opens (Phase 17 background refresh)
- [ ] `fetchOlderFeedEpisodes`: a later refresh restores the first page's `next_page_url` (COALESCE), so older pages can be re-fetched; harmless (upserts dedupe) but wasteful
