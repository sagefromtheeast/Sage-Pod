# Fix six defects, then port AntennaPod screen by screen

> **Status (kept current by the lead developer):** Phases 0–2 are done — the
> six defects D1–D6 are fixed and the screenshot harness is in `shots-tool/`.
> The owner's answers to the "Blocked on Me" questions below are recorded in
> `docs/DECISIONS.md` (D-002 to D-007); that file wins where they differ.
> Progress is tracked in `TASKS.md`. To reproduce `AP/` citations:
> `git clone https://github.com/AntennaPod/AntennaPod && git -C AntennaPod checkout 9c7ffa1`.


Sage Pod already has the skeleton of AntennaPod: the same five main destinations, a queue, an inbox with a badge, per-podcast speed and skip-intro, chapters, a sleep timer, downloads, OPML and listening stats. What it lacks is depth, and it lacks it in the same places on almost every screen. There is **no long-press menu anywhere, no multi-select, no undo, no search of your own library, no overflow ("⋯") menus, no preview before subscribing, and settings that are never saved (sort, filter, speed chosen in the player)**. Before any new feature, six bugs in features Sage Pod already ships should be fixed. The worst is verified in code: **episodes played from the Queue tab, or reached by auto-advance, ignore that podcast's own speed and skip-intro settings**. The recommended path has 19 phases. First fix the six defects. Second, add a screenshot harness so every later change comes with before/after pictures; it already works in a scratch copy and makes 33 deterministic screenshots in about 48 seconds. Third, build five shared building blocks: an action sheet, an undo toast, an overflow menu, multi-select and typed episode actions. After that, work screen by screen in order of how much listeners use each screen: Now Playing, Queue, Inbox, Home, episode pages, podcast pages, search/discovery, Library, Downloads, Settings, Stats, backup. Sage Pod's look stays as it is: glass surfaces, cards, chips and theme tokens. Only the position of each feature moves to where AntennaPod puts it. Some of AntennaPod's features cannot be built on Sage Pod's audio library (expo-audio 57) without native work and a new app build. These are custom lock-screen buttons, custom lock-screen skip amounts, skip silence and volume boost. Sync, Chromecast, Android Auto/Wear, widgets and video are large and optional, so they are scheduled last.

All findings come from reading two local checkouts: AntennaPod at commit `9c7ffa1` (cited as `AP/` = the root of an AntennaPod clone checked out at `9c7ffa1`, with `APJ/` = `AP/app/src/main/java/de/danoeh/antennapod/`) and Sage Pod at commit `7c4e860` on branch `claude/sage-pod-player-wx2g3p` (cited as `SP/` = this repository's root). No runtime testing of the native app was done; statuses come from static reading. Surprise Me and the tablet layouts are already done in that commit (PR 9), so this plan does not cover them again.

## Six bugs undermine features Sage Pod already claims

The audit found six places where an existing Sage Pod feature does not do what its label says. They come first because they are cheap and visible to users, and because they shipped as `feat:` work that users already rely on. Each one becomes a single `fix:` commit, which triggers a patch release.

**D1, verified: queue playback drops per-podcast settings.** The shared queue query `QUEUE_JOIN` selects only `feed_title`, `feed_image_url` and `feed_author` ([SP/src/db/queue.ts:4-10](../src/db/queue.ts)). The `nextInQueue` query does the same ([SP/src/db/queue.ts:128-137](../src/db/queue.ts)). The player, however, reads `episode.feed_skip_intro_seconds` and `episode.feed_playback_speed` ([SP/src/player/service.ts:160, 175](../src/player/service.ts)). Only `EPISODE_WITH_FEED` in `SP/src/db/episodes.ts:11-16` includes those columns. So per-podcast speed and skip-intro are silently ignored when you tap play on the Queue tab (`SP/app/(tabs)/queue.tsx:30-34`), on auto-advance and on skip-to-next.

**D2: "End of episode" sleep is a guess on the wall clock.** `startSleepTimerUntilEndOfEpisode` converts `(duration − position)` into minutes of real time ([SP/src/player/service.ts:463-467](../src/player/service.ts)). At 2× speed it fires long after the episode ends, and by then continuous playback has already started the next episode. The minute timer is a `setTimeout`, so paused time also counts down ([SP/src/player/service.ts:470-480](../src/player/service.ts)). AntennaPod counts down only while audio plays and ignores ticks more than 10 s apart (`AP/playback/service/src/main/java/de/danoeh/antennapod/playback/service/internal/ClockSleepTimer.java:36-55`). Its episode timer stops at the end of the episode instead of advancing (`.../internal/EpisodeSleepTimer.java:52-59`).

**D3: "Rewind on resume" never fires on a plain resume.** The rewind is applied only inside `load()`, and only when the gap since the last pause is over 5 minutes ([SP/src/player/service.ts:160-169](../src/player/service.ts)). `play()` never rewinds, and `lastPausedAt` is a single in-memory field, not tracked per episode and not saved ([SP/src/player/service.ts:299-312](../src/player/service.ts)). So pausing for an hour and pressing play resumes exactly where you left off. The fix can use data Sage Pod already stores: `savePosition` writes `played_at = Date.now()` on every save ([SP/src/db/episodes.ts:161-187](../src/db/episodes.ts)), so the time since the last listen is already persisted per episode.

**D4: skip-intro "Global" actually means "Off".** The per-podcast picker offers "Global" (`SP/app/feed/settings/[id].tsx:80`), which stores NULL. The player treats NULL as 0, and the global settings schema has no skip-intro key at all (`SP/src/db/settings.ts:4-31`). AntennaPod has skip-intro only per feed, as part of "Auto skip" with intro and ending (`AP/app/src/main/res/xml/feed_settings.xml:31-35`). The notes found no global skip-intro setting there.

**D5: queueing an episode from anywhere except the Inbox leaves it in the Inbox.** Playback does clear the "new" flag: `savePosition` sets `is_new = 0` on the first position save, about 5 s into playback ([SP/src/db/episodes.ts:171, 180](../src/db/episodes.ts)). The real gap is narrower. `enqueue()` never touches `is_new` ([SP/src/db/queue.ts:57-68](../src/db/queue.ts)). Only the Inbox screen dismisses explicitly after enqueueing (`SP/app/(tabs)/inbox.tsx:60-63`). So queueing from a podcast page, the episode page or a list leaves the episode marked new. AntennaPod clears the flag inside `addQueueItem` itself (`AP/storage/database/src/main/java/de/danoeh/antennapod/storage/database/DBWriter.java:346-362, 400-418`).

**D6: older-episode paging is built but nothing can reach it.** The parser reads RFC 5005 `rel=next` links, schema v3 stores `feeds.next_page_url`, and `fetchOlderFeedEpisodes(feedId)` exists ([SP/src/feed/sync.ts:291-318](../src/feed/sync.ts)). But nothing in `app/` or `src/` calls it. The podcast page also silently stops at the default `limit = 500` (`SP/src/db/episodes.ts:45-49`). AntennaPod pages its local list 150 at a time and shows a "more content" footer that fetches the next remote page (`APJ/ui/screen/feed/FeedItemlistFragment.java:88, 173-178, 231-243`).

## How AntennaPod builds each screen, and where Sage Pod stands

AntennaPod reuses a few patterns everywhere: a toolbar with a Search icon and an overflow menu; a long-press context menu built by one handler (`APJ/ui/episodeslist/FeedItemMenuHandler.java`); per-screen swipe actions with an Undo snackbar; a `FloatingSelectMenu` for multi-select; and sort/filter dialogs whose choices are saved. Sage Pod has none of these shared patterns, so the same gap shows up on every screen. That is why the plan builds them once, in Phase 3, before touching individual screens. In the tables, "Where in Sage Pod" names the placement that matches AntennaPod and still uses Sage Pod's own components (`GlassSurface`, chips, `SettingsSection`, `EpisodeRow`, theme tokens from `useTheme()`).

### Home: five configurable sections versus a fixed stack

AntennaPod's Home is a user-ordered stack of sections, built from saved preferences in `APJ/ui/screen/home/HomeFragment.java:81-93`. In the default order they are: Continue listening (the queue), See what's new (inbox), Get surprised, Check your classics and Manage downloads (`AP/ui/preferences/src/main/res/values/arrays.xml:241-255`). Each section uses `home_section.xml`: a title on the left, a "more" link on the right, and an empty-state text below. The toolbar has Search, and its overflow holds Refresh and "Configure home screen" (`AP/app/src/main/res/menu/home.xml:5-22`). Sage Pod has a fixed order (`SP/app/(tabs)/index.tsx:209-319`): an Inbox banner, then Continue Listening (episodes in progress, not the queue), Surprise Me, and Subscriptions.

| Feature | AntennaPod placement | Sage Pod | Where in Sage Pod |
|---|---|---|---|
| Queue-backed "Continue listening", 8 items, paused first, "Queue" link | Section 1 (`.../home/sections/QueueSection.java:39, 57-58`) | Partial: in-progress shelf, `listInProgressEpisodes(5)`, no link, hidden when empty (`SP/src/db/episodes.ts:101-109`) | Section 1, keep `ContinueCard` style, source = queue, right-aligned "Queue" link |
| "See what's new": count badge, 2 swipeable inbox rows, "Inbox" link | Section 2 (`InboxSection.java:44, 56-70`) | Partial: banner with count and chevron only | Section 2, replaces the banner; reuses `SwipeableEpisodeRow` |
| "Get surprised" with shuffle | Section 3 | Yes (PR 9) | Unchanged; gains shared section chrome only |
| "Check your classics": top 8 feeds by listening time over 3 years | Section 4 (`SubscriptionsSection.java:100-123`) | Partial: all feeds A–Z; "See all" on tablet only | Section 4, ranked from `playback_history`; "Library" link on every layout |
| "Manage downloads": 2 latest downloads with swipes | Section 5 (`DownloadsSection.java:41-69`) | No | New section 5 |
| Configure home (show/hide/reorder/reset) | Toolbar overflow (`HomeSectionsSettingsDialog.java:24-62`) | No | Header ⋯ → sheet; new `homeSections` setting |
| Search icon; Refresh menu item | Toolbar | No; pull-to-refresh only | Header search icon + ⋯ Refresh |
| Empty text per section; welcome screen with arrow | Each section; `home_fragment.xml:24-87` | Sections hidden; plain welcome text | Keep sections visible with AntennaPod's copy |
| Long-press card → episode menu; download ring, date, playing highlight on cards | `HomeSection.java:52-81`, `HorizontalItemViewHolder.java:57-98` | No; cards always show a play-circle icon | Shared action sheet; card glyph reflects state |
| Echo year-in-review card | Top, seasonal | No | Optional, Phase 18 |

### Queue: AntennaPod's toolbar holds what Sage Pod puts in the list header

AntennaPod's queue toolbar (`AP/app/src/main/res/menu/queue.xml:5-31`) holds queue-scoped Search, plus Refresh, a checkable Lock queue, Sort, and Clear queue with a confirmation in the overflow. A pinned info bar reads "12 episodes • 5 hours left", with time divided by playback speed when that option is on (`APJ/ui/screen/queue/QueueFragment.java:502-523`). Rows have a drag handle that hides while the queue is locked or kept sorted (`QueueRecyclerAdapter.java:30-73`). Sage Pod keeps count, time left, jump-to-playing, sort and Clear in a header that scrolls away with the list (`SP/app/(tabs)/queue.tsx:143-182`). Rows reorder with ▲/▼ buttons, and swipes are fixed with no undo (`SP/src/ui/SwipeableQueueRow.tsx:40-75`).

| Feature | AntennaPod placement | Sage Pod | Where in Sage Pod |
|---|---|---|---|
| Queue-scoped Search | Toolbar icon | No | Header icon → search screen with Queue chip |
| Sort dialog: title/podcast/duration/date/random/smart shuffle, asc/desc, saved "Keep sorted" | Overflow (`QueueFragment.java:582-628`) | Partial: one-shot Alert, nothing saved (`SP/src/player/queueSorting.ts:3-60`) | ⋯ → sort sheet; keep Sage's "Shortest remaining" |
| Lock queue with first-time warning | Overflow | No | ⋯ toggle; hides drag handles |
| Clear queue with confirmation | Overflow | Yes, in the list header | Move into ⋯ |
| Info bar "N • X left", pinned, speed-aware | Under toolbar | Partial: scrolls away, raw duration | Pinned line under header, divided by speed |
| Drag to reorder | Drag handle on each row | No (▲▼ buttons) | Drag handle left of artwork |
| Move to top/bottom | Context menu | Partial: swipe to top only | Action sheet |
| Configurable swipes, default Remove, Undo snackbar | Settings › Swipe actions (`SwipeActionsDialog.java:57-133`) | Partial: fixed, no undo | Undo toast now; config in Phase 14 |
| Multi-select bar (13 actions) | Long-press → bottom bar | No | Shared `SelectionBar` |
| Playing row highlighted; "Skip episode" | Row `activated`; context menu | Partial: pause glyph only | Highlight from an existing theme token |
| Inbox-aware empty state ("Go to inbox") | Empty view (`QueueFragment.java:533-548`) | Partial: "Find podcasts" only | Same empty state, second variant |
| Enqueue location: Back/Front/After current/Random | Settings › Playback › Queue (`preferences_playback.xml:62-95`) | No; `enqueueNext()` exists but nothing calls it | Settings › Playback › Queue |
| Pull to refresh | List | No | Add `refreshControl` |

### Inbox: Sage Pod's chips are a keeper, but swipes are mirrored and unconfirmed

AntennaPod's Inbox toolbar (`AP/app/src/main/res/menu/inbox.xml:5-26`) has Search, plus Refresh, Sort (Date or Duration, each ascending or descending, saved, and it also orders Home's section) and "Remove all from inbox" in the overflow. Remove all shows a confirmation with "don't ask again" (`APJ/ui/screen/InboxFragment.java:77-94, 115-158`). Default swipes are right = Add to queue and left = Remove from inbox, both with Undo. Sage Pod has per-podcast filter chips, which AntennaPod lacks ([SP/app/(tabs)/inbox.tsx:108-167](../app/(tabs)/inbox.tsx)). But its "dismiss all" button runs immediately with no confirmation (`inbox.tsx:65-73`). Its swipe directions are the reverse of AntennaPod's. Dismissing uses a **trash** icon even though it only clears the "new" flag (`SP/src/ui/SwipeableEpisodeRow.tsx:38-70`).

| Feature | AntennaPod placement | Sage Pod | Where in Sage Pod |
|---|---|---|---|
| Search | Toolbar | No | Header icon |
| Sort Date/Duration asc/desc, saved | Overflow | No (fixed newest first) | ⋯ → sort sheet; new `inboxSort` setting |
| Remove all, with confirmation + "don't ask again" | Overflow | Partial: instant, no feedback | ⋯ item + confirm + toast |
| Swipe right = queue, left = remove, Undo | Row | Partial: mirrored, trash icon, no undo | Swap directions, checkmark icon, undo toast |
| Multi-select (confirm when marking ≥25) | Long-press | No | Shared `SelectionBar` |
| Paging (150) | List | Partial: hard 500 cap | Offset paging via `onEndReached` |
| "New episodes action" per feed/global | Feed settings / Downloads | No (new episodes always go to the inbox) | Phase 10 per feed + Phase 14 global |
| Enqueue anywhere clears "new" | `DBWriter.addQueueItem` | Partial (D5) | Phase 1 |
| Per-podcast chips | None | Sage extra | Keep |

### Episode rows and the long-press menu are the shared foundation

AntennaPod's row (`AP/app/src/main/res/layout/feeditemlist_item.xml`) puts a **context-sensitive secondary button** where Sage Pod has its play button. `ItemActionButton.forItem` picks Pause, Play, Stream, Download, Cancel (with a circular progress ring) or Mark played (`APJ/actionbutton/ItemActionButton.java:36-56`). The row also shows inbox, in-queue and video icons, dims played rows to 50%, and highlights the playing row. Long-press opens a menu titled with the episode name. Each item appears only when it applies: Skip, Remove from inbox, Mark played/unplayed, Add/Remove queue, Delete, Favourite, Reset position, Share, Multi select (`AP/app/src/main/res/menu/feeditemlist_context.xml:3-62`). Tapping a row opens a pager you can swipe between episodes (`APJ/ui/episodeslist/EpisodeItemListAdapter.java:88-95`). Sage Pod's `EpisodeRow` always shows Play/Pause and shows download state as passive text (`SP/src/ui/EpisodeRow.tsx:120-164`). **`onLongPress` appears nowhere in the app except the tab bar** (`SP/src/ui/glass/GlassTabBar.tsx:131-142`). Sage Pod does have extras worth keeping: the uppercase podcast name and the S/E badge.

### Now Playing: same transport core, different arrangement

AntennaPod's full player is a bottom sheet with three parts (`AP/app/src/main/res/layout/audioplayer_fragment.xml:25-275`). Along the top is a toolbar with favourite, sleep timer and share icons, plus an overflow (Open podcast, Visit website, Show transcript, Show comments, Cast). In the middle is a two-page swipe pager. The cover page shows the cover, which becomes the current chapter's image and toggles play/pause when tapped; "podcast ・ date" (tap opens the podcast); the episode title; and a row with a "Shownotes" button and prev | Chapters | next (`AP/app/src/main/res/layout/cover_fragment.xml:12-151`). The second page is the shownotes. At the bottom is a fixed block: a seek bar with chapter dividers and a chapter-title bubble while dragging; elapsed time on the left and total-or-remaining on the right, toggled by tap and saved; and one row reading **speed | rewind | play | forward | skip**. Long-pressing rewind or forward changes the skip amount on the spot (`APJ/ui/screen/playback/audio/AudioPlayerFragment.java:190-299, 408-420`).

Sage Pod's player is one scrolling modal ([SP/app/player.tsx:56-308](../app/player.tsx)). It has back | play | forward, then a second row of pills (speed cycles on tap, sleep, next), sleep chips that expand inline, a permanent row of rate chips, and an inline chapter list at the bottom.

| Feature | AntennaPod placement | Sage Pod | Where in Sage Pod |
|---|---|---|---|
| Speed and Skip in the transport row | Left of rewind / right of forward | Partial: second-row pills | Five-button row; keep Sage's accent play button |
| Speed dialog: 0.5–4.0 slider in 0.05 steps, editable presets, skip-silence checkbox; choice saved | Speed button → dialog (`VariableSpeedDialog.java:118-226`) | Partial: cycles 8 fixed rates, not saved (`service.ts:23, 346-360`) | Speed button → glass sheet; the chip row moves inside it |
| Long-press rewind/forward to change amount | Transport | No | Same buttons, `onLongPress` |
| Total ↔ remaining toggle, saved; speed-adjusted times | Right time label | Partial: always −remaining | Tappable right label |
| Chapter dividers and scrub bubble on the seek bar | Seek bar (`ChapterSeekBar.java:52-113`) | No | Overlay on the slider track |
| Chapter row prev / Chapters / next; chapter art | Under title | No (`useChapters` has an `img` field but it is unused) | Under title, above the seek bar |
| Chapters dialog (image, duration, link, refresh) | Chapter label → dialog | Partial: inline list | Sheet from the chapter row |
| Shownotes as second page | Pager page 2 | Partial: separate screen | Horizontal pager or "Shownotes" button |
| Cover tap = play/pause; podcast line opens podcast | Cover page | No | Same |
| Favourite, sleep icon in toolbar; overflow: open podcast, website, transcript, comments | Toolbar | Partial: share + info only | Header icons + ⋯ |
| Share dialog (4 kinds + include position) | Toolbar | Partial: native sheet, `#t=` appended | ⋯ Share → choice sheet |
| Buffered progress / spinner | Seek bar / play button | Partial: ellipsis glyph | Spinner only; expo-audio 57 types expose `isBuffering` but no buffered position (`SP/node_modules/expo-audio/build/AudioModule.types.d.ts:61`) |
| Error dialog | Modal | Partial: inline text | Keep inline (design choice) |

**Mini player.** AntennaPod's mini player is the collapsed sheet, and it stays visible on every screen (`AP/app/src/main/res/layout/main.xml:23-68`). Sage Pod renders its glass capsule inside the tab bar ([SP/app/(tabs)/_layout.tsx:188-204](../app/(tabs)/_layout.tsx)), so **it disappears on podcast, episode, settings and stats pages**. The fix is to hoist it into `SP/app/_layout.tsx`. Sage Pod's extra rewind and forward buttons can stay. Drag-up-to-expand is optional.

### Playback engine: 10 of 45 features fully present

Tallying the playback note's 45-row feature table gives **10 full, 12 partial and 23 missing**. Global speed, background playback, resume position, continuous playback, removal on finish, auto-delete, prefer-local, audio focus, Podcasting 2.0 JSON chapters and listening stats are present. Here is the gap, split by what each item needs:

| Feature | AntennaPod | Sage Pod | Build type |
|---|---|---|---|
| Sleep timer: counts only while playing, episode-count mode, fade-out over 10 s, vibrate, shake only near the end, +5/+10/+30 extend, auto-enable by hour window, custom value | `SleepTimerDialog.java`, `M3S:884-906` | Partial (preset minutes; shake always on) | Pure JS (`player.volume`, expo-haptics, expo-sensors installed) |
| Speed persisted from player; editable presets; per-feed speed for queue loads | `PlaybackSpeedUtils.java:17-35` | No / D1 | Pure JS |
| Graduated rewind after pause (20 s/10 s/3 s/0.8 s) | `RewindAfterPauseUtils.java:12-47` | Partial (D3) | Pure JS |
| Smart mark-as-played threshold 0–600 s; "Keep skipped episodes" | `preferences_playback.xml:81-93` | Fixed 20 s; always keeps | Pure JS |
| Skip ending per feed | `SkipUtils.java:46-66` | No | Pure JS |
| Per-feed auto-delete; keep favourites | `M3S:691-697` | No | Pure JS |
| Transcripts (JSON > VTT > SRT, follow audio, tap to seek) | `TranscriptDialogFragment.java:79-266` | No | Pure JS (parser + sheet) |
| Chapters from ID3/Vorbis/M4A/Podlove, merged | `ChapterUtils.java:51-330` | JSON only, no cache | JS but heavy (ranged binary reads); Podlove is easy |
| Mobile-streaming confirmation | `M3S:753-802` | No | Pure JS (expo-network installed) |
| Lock-screen skip amounts ≠ 10 s; next/chapter/speed/sleep buttons | `MLSC:149-199` | No: expo-audio hard-codes 10 s and strips next/previous | **Native** |
| Skip silence; volume boost > 1.0 | `M3S:610-614, 971-1013` | No: no API in expo-audio | **Native** |
| Android pause on headset unplug; hardware button remap | `ExoPlayerUtils.java:62-68` | iOS yes; Android [UNVERIFIED, likely absent] | **Native** |
| Chromecast, video, widget, Quick Settings tile, Android Auto, Wear OS | various modules | No | **Native, optional** |

The native limits are verified in the installed package. Android uses `SEEK_INTERVAL_MS = 10000L` (`SP/node_modules/expo-audio/android/src/main/java/expo/modules/audio/service/AudioControlsService.kt:91-92`) and iOS uses `preferredIntervals = [10.0]` (`SP/node_modules/expo-audio/ios/MediaController.swift:278`). `AudioLockScreenOptions` offers only `showSeekForward`, `showSeekBackward` and `isLiveStream`. One timing question is open: whether Sage Pod's JS `setTimeout`/`setInterval` timers keep firing while the app is in the background is **[UNVERIFIED]**. The sleep timer rework must be tested on a device with the screen locked.

### Podcast page, info page and per-podcast settings

AntennaPod's podcast page header has three icon buttons: Info, Filter and Settings (`AP/app/src/main/res/layout/feeditemlist_header.xml:32-253`). It also shows status banners: "Last refresh failed", "Filtered" and "Updates disabled". The toolbar has Search, and its overflow holds Sort, Refresh, Refresh complete podcast, Visit website, Share, Remove all from inbox, and Unsubscribe with Archive or Delete (`AP/app/src/main/res/menu/feedlist.xml:5-68`; `APJ/ui/screen/feed/RemoveFeedDialog.java:68-84`). The filter has six include/exclude pairs and the sort has ascending/descending pairs, and both are **saved per feed** (`FeedItemFilterGroup.java:6-18`, `SingleFeedSortDialog.java:22-72`). Sage Pod's header-right "⋯" icon **goes straight to the Unsubscribe confirmation** ([SP/app/feed/[id].tsx:93-143](../app/feed/[id].tsx)). Its filter (4 options) and sort (3 options) live only in component state and reset on every visit. The repo already supports an `inProgressOnly` filter and duration/title sorts that the screen never exposes (`SP/src/db/episodes.ts:22-36, 63-74`).

| Feature | AntennaPod placement | Sage Pod | Where in Sage Pod |
|---|---|---|---|
| Info / Filter / Settings icon buttons | Header | Partial: gear in nav header | Icon row under artwork; Info → new `feed/info/[id]` |
| Search within podcast | Toolbar | No | Header icon → search with feed chip |
| Overflow: Sort, Refresh, Refresh complete, Visit website, Share, Remove all from inbox, Unsubscribe/Archive | Toolbar ⋯ | Mostly no; ⋯ = unsubscribe | Real ⋯ menu |
| Pull to refresh | List | No | `refreshControl` |
| Filter (6 include/exclude groups), saved per feed, "Filtered" banner | Header button → sheet | Partial: 4 options, not saved | Filter sheet; v4 `feeds.item_filter` column |
| Sort asc/desc date/duration/title, saved; global default | ⋯ | Partial: 3 options, not saved | Sort sheet; v4 `feeds.sort_order`; keep Season sort |
| Refresh-failed and updates-disabled banners | Header | No | Banner chips under header |
| Long-press, swipe, multi-select (select all/above/below) | Rows | No | Shared Phase 3 parts |
| Local paging 150 + RFC 5005 "load more" footer | List | No (D6) | Phase 1 |
| Info page: per-feed stats card, funding links, full description, feed URL tap-to-copy, website, share | `AP/app/src/main/res/layout/feedinfo.xml:62-155` | No (inline description only; funding not parsed) | New route `feed/info/[id]` |
| Preview before subscribing (`STATE_NOT_SUBSCRIBED`, Subscribe button, rows playable) | `OnlineFeedViewActivity.java:241-301` | No: tapping a result subscribes immediately (`SP/app/(tabs)/discover.tsx:183-196`) | v4 `feeds.state` column + Subscribe CTA on the feed page |

Per-podcast settings in AntennaPod come in four groups (`AP/app/src/main/res/xml/feed_settings.xml:6-116`). Sage Pod's modal has four controls ([SP/app/feed/settings/[id].tsx:62-96](../app/feed/settings/[id].tsx)).

| AntennaPod setting (group) | Sage Pod | Needs |
|---|---|---|
| Rename (Display) | No; title is overwritten on each refresh | `custom_title` column |
| Tags (Display) | No | `feed_tags` table |
| Speed + per-feed skip silence (Playback) | Partial: speed only | Skip silence is native |
| Skip intro **and** ending (Playback) | Partial: intro only; "Global" = Off (D4) | `skip_ending_seconds` |
| Volume adaptation, reduction/boost (Playback) | No | Reduction is JS (`volume` 0–1); boost is native |
| Keep updated (Automation) | Yes | none |
| New-episode notification (Automation) | No | expo-notifications, native build |
| Auto-delete Global/Always/Never (Automation) | No | `auto_delete` tri-state |
| New episodes action Global/Inbox/Queue/Nothing (Automation) | No | `new_episodes_action` |
| Auto-download Global/On/Off (Automation) | Partial: boolean | tri-state migration |
| Episode filter: include/exclude terms + minimum duration (Automation) | Partial: one hard-coded global rule (`SP/src/player/downloadRules.ts:1-42`) | `include_terms`, `exclude_terms`, `min_duration` |
| Authentication; Edit feed URL (Advanced) | Partial: only `user:pass@` in the URL | `username`/`password` (secure storage [UNVERIFIED which]) |

### Episode details: Sage Pod's action row already beats AntennaPod

Sage Pod's episode page has a large play pill and five visible actions (queue, download, favourite, played, share). It also shows inline download progress and offers "Play this episode?" when you tap a timestamp in an episode that isn't playing ([SP/app/episode/[id].tsx:55-250](../app/episode/[id].tsx)). That is more than AntennaPod's two buttons (`AP/app/src/main/res/layout/feeditem_fragment.xml:11-226`). What is missing is AntennaPod's overflow menu: Skip (while playing), Remove from inbox, Reset playback position, Visit website, Open podcast, and a share dialog with an "include position" option (`AP/app/src/main/res/menu/feeditem_options.xml:5-69`). Also missing: swiping between the episodes of the list you came from, links shown inline in the notes with Open/Copy/Share on long-press (`APJ/ui/view/ShownotesWebView.java:176-197`), MM:SS vs HH:MM timecode disambiguation by duration (`APJ/ui/cleaner/ShownotesCleaner.java:136-183`), copy-on-long-press, and a "not subscribed" label once previews exist. Sage Pod has no way to reset a position: marking an episode unplayed keeps its position (`SP/src/db/episodes.ts:189-199`).

### Library, discovery, search, downloads, settings, stats and backup

These screens show the most gaps measured by count of missing features.

| Screen / feature | AntennaPod placement | Sage Pod | Where in Sage Pod |
|---|---|---|---|
| **Navigation**: Episodes (all), Downloads, History, Favourites, Stats, Add podcast, Settings in "More" | Bottom nav More popup (`APJ/ui/screen/drawer/BottomNavigation.java:96-135`) | Library shortcut row has Favourites/Downloads/History/Stats; **no All Episodes**; gear on Home + Library only | Library row = Sage's "More"; add "Episodes" shortcut + Settings |
| Customise navigation; default start page | More › Customize; Settings › UI | No | Optional (conflicts with the fixed glass tab bar) |
| **Library**: grid/list, user columns 2–5, show titles, counter choice (inbox/unplayed/downloaded/none), sort (counter, A–Z, date, most played) saved | Toolbar overflow (`AP/app/src/main/res/menu/subscriptions.xml`) | Partial: grid/list + 3 sorts, none saved; unplayed badge only (`SP/app/(tabs)/library.tsx:34-63`) | Header ⋯ → display sheet; saved settings |
| Library filter, tags as folders + chip row, archive view, failed-refresh badge | Toolbar / chips above grid | No | Chip row above grid (same glass chips as Inbox) |
| Long-press multi-select with 10 bulk actions; Add FAB; Search | Grid | No | Shared `SelectionBar`; "+" in header |
| **Discovery**: combined/fyyd/Podcast Index search, chart country, hide subscribed from charts, clipboard prefill, OPML file import, add local folder | Add podcast screen (`AP/app/src/main/res/layout/addfeed.xml`) | iTunes only, US hard-coded (`SP/src/discover/itunes.ts:21-23, 87, 123`) | Discover tab; fyyd first (needs no API key) |
| Preview before subscribe; HTML autodiscovery; 401 auth prompt; "Edit URL" retry | `OnlineFeedViewActivity.java` | No | Feed page in preview state |
| Open itpc:/pcast:/feed: links and shared URLs | Manifest intent filters | No (`scheme: "sagepod"` only, `SP/app.json:8`) | `+native-intent` + app.json; **new build** |
| **Local search**: podcasts row + episodes (title and notes, AND across words), "Search online", filter chips | `APJ/ui/screen/SearchFragment.java` | **No UI**; `searchEpisodes()` exists unused (`SP/src/db/episodes.ts:146-159`) | New `search` route reached from header icons |
| **Downloads**: running + completed together, saved sort, search, Delete played, Download log with retry and details | Toolbar (`AP/app/src/main/res/menu/downloads_completed.xml`) | Partial: completed only, sort not saved, log in memory and never shown (`SP/src/player/downloads.ts:34-50`) | `list/downloads` header ⋯; persist log in SQLite |
| Download rules: when not charging, mobile-data per type, confirm mobile download, cleanup algorithm, proxy, data folder | Settings › Downloads | Partial: Wi-Fi-only governs auto downloads only | Settings › Downloads |
| **Settings**: UI (theme, full black, dynamic colours, remaining time, swipe actions ×7, default sort, prefer streaming), Playback, Downloads, Sync, Import/Export, Notifications, Parental control, About, settings search | `AP/ui/preferences/src/main/res/xml/preferences.xml:6-78` | One flat page; theme incl. OLED yes; most others no (`SP/app/settings.tsx:143-277`) | Same flat page, more `SettingsSection` groups |
| Refresh interval in background | WorkManager | Only checked when the app opens (`SP/app/_layout.tsx:37-44`) | expo-background-task; **new build** |
| **Stats**: Subscriptions pie with date filter, Years bar chart, Downloads space pie, reset, per-feed dialog with release-schedule guess, Echo | `AP/ui/statistics/.../StatisticsFragment.java:53-142` | Total hours + per-feed list (`SP/app/stats.tsx:10-51`) | Segmented control (Subscriptions / Years / Downloads) in the modal; per-day `playback_history` already supports it |
| **Backup**: OPML file export/import with checklist, DB export/import, auto DB backup every 3 days keeping 5, HTML and favourites export | Settings › Import/Export (`AP/ui/preferences/src/main/res/xml/preferences_import_export.xml:6-40`) | Partial: OPML via clipboard only, imports everything (`SP/src/feed/opml.ts:22-113`) | Settings › Import/Export section |
| **Sync** gpodder.net / Nextcloud | Settings › Synchronization | No; no change journal in schema | Optional, Phase 18 |

One helpful detail: Sage Pod's installed `expo-file-system` 57 already declares `File.pickFileAsync` and `Directory.pickDirectoryAsync` (`SP/node_modules/expo-file-system/build/ExpoFileSystem.d.ts:22-24`). OPML and database **import** may therefore need no new native module; how it behaves at runtime is **[UNVERIFIED]**. **Exporting** a file to the share sheet needs `expo-sharing`, which is not installed, so it needs a new build.

## A web screenshot harness gives every phase before/after evidence

The harness now lives in `shots-tool/` (adopted in Phase 2; see its README). It was first proven in a scratch copy of the repo. It builds the app with `npx expo export --platform web` (about 20 s), serves it with a static server that falls back to `index.html` for deep links, and drives headless Chromium through the globally installed Playwright 1.56.1. It seeds demo data through the app's own SQLite handle: 6 feeds, 48 episodes, a queue of 5, 12 inbox items, 14 days of history and a restored Now Playing episode. It then shoots 11 routes at three sizes (phone 390×844 @2x, tablet 800×1280, landscape 1280×800). **Two full runs were pixel-identical on all 33 shots.** That comes from a fixed clock, seeded `Math.random`, stubbed network hosts, a silent WAV served in 206 slices, disabled transitions and a DOM-quiet wait instead of `networkidle`. A deliberate one-word change was caught on exactly the 3 Home shots (0.07–0.16% pixels) and on none of the other 30. `pixelmatch` produces the diff images, and Playwright itself renders `compare.html` and the side-by-side montages, so ImageMagick is not needed.

Three web-only problems had to be worked around. Each is fixed by a small shim that a Metro `resolveRequest` hook applies only for web imports coming from `app/` or `src/`, so app code stays untouched. First, `openDatabaseSync` can never succeed on web, because its busy-wait blocks the worker it waits for; the shim swaps in a proxy over `openDatabaseAsync`, and the only sync call in the app is `SP/src/db/index.ts:22`. Second, react-native-web lacks `AccessibilityInfo.isReduceTransparencyEnabled`, which the glass tab bar calls. Third, expo-network must report cellular, or the startup auto-download pass calls native-only `File`/`Directory` APIs. With the same `metro.config.js`, `npx expo export --platform android` still exported and `npm run typecheck` still passed.

Adopting this is a deliberate change to the repo, so the user should approve it first. **Nothing was installed in the real repo during research.** It adds `react-native-web` and `@expo/metro-runtime` (and turns `react-dom` into an exact `19.2.3` pin), plus dev dependencies `pixelmatch@7` and `pngjs@7`. It also adds `metro.config.js` and a `shots-tool/` folder (`serve.mjs`, `seed.mjs`, `shoot.mjs`, `diff.mjs`, `compare.mjs`, `shims/`), and `.gitignore` entries for `dist-web/` and `screenshots/`. None of these files carry a version, so `tool/set_app_version.sh` and `.releaserc.json` need no changes. The commit should be `build:` or `test:` so it does not cut a release. Whether `expo-doctor` objects to the exact `react-dom` pin was not checked **[UNVERIFIED]**.

The caveats matter for how much to trust the pictures. The web build is good for **layout, content, empty states and responsive breakpoints**. It does not show native visuals: liquid glass and blur render as solid fallbacks, headers are the JS stack header, fonts are Linux fallbacks, and there are no safe-area insets. Native-look checks remain a manual step on an EAS build. The seed SQL is written against **schema v3**, so every migration phase must update `seed.mjs` in the same PR. Use the **production export, not the dev server**: in dev mode a LogBox toast about nested `<button>`s on Home changes 1.4–4.5% of pixels. Interactive states (sheets, menus, selection mode) need per-route click steps. Routes not yet shot (`/add-feed`, `/feed/settings/1`, `/list/downloads`, `/list/history`) are expected to work but are unverified. Real downloaded files cannot be shown on web.

The screenshot catalogue grows with each phase. The baseline is the 11 verified routes × 3 viewports in dark theme. Phase 2 extends it with the four unshot routes, a light-theme set, and an unseeded "fresh install" set for empty states. Every later phase adds the interactive states it introduces, such as `queue--menu`, `queue--select`, `player--speed-sheet`, `episode--actions`, `feed--filter`, `search--results` and `home--configure`. Before starting a phase, shoot `before/` from the base commit. After each step, shoot `after/`, run `diff.mjs` and `compare.mjs`, and check that the only changed screens are the ones the step targeted. At the end of each phase, publish `compare.html` for the user.

## The phased plan

The plan follows three engineering principles, adapted because the named skills are not installed. The user named andrej-karpathy, matt-pocock, ponytail and expo skills; none of them exists in this environment, and what "ponytail" means is not assumed here. The Karpathy-style principle is that **every step is small and comes with its own proof**: one Conventional Commit, plus a `node:test` case or a screenshot diff. The Pocock-style principle is **types first, so illegal states can't be written down**, with logic in pure helpers that have tests. The Expo-style principle is to **respect SDK 57 as documented in `SP/AGENTS.md`**: tabs come from `expo-router/js-tabs`, audio from `expo-audio`, files through `File`/`Directory`/`Paths`, screens re-render through `useQuery` change events, all SQL lives in `src/db/` repositories, colours and spacing come from `useTheme()`, and no versions are hand-edited.

Testing has one practical constraint. Tests run under plain Node with `--experimental-strip-types`, and `tsconfig.test.json` includes only `src/**/__tests__`, `src/feed/parser.ts` and `src/util/*.ts` (`SP/tsconfig.test.json`; `SP/package.json` `"test"` script). Anything that imports expo-sqlite or expo-audio cannot be unit-tested. Every rule therefore goes into a pure module, in `src/util/` or in a file added to that include list, and gets tested there. The repository or service only calls it.

These types should exist before the features that need them:

```ts
// One override shape for every per-feed setting: makes the D4 bug class unrepresentable.
type FeedOverride<T> = { kind: 'global' } | { kind: 'value'; value: T };
type SleepTimer =
  | { kind: 'off' }
  | { kind: 'minutes'; remainingMs: number; initialMs: number }   // ticks only while playing
  | { kind: 'episodes'; remaining: number };
type EnqueuePosition = 'back' | 'front' | 'afterCurrent' | 'random';
type FeedState = 'subscribed' | 'preview' | 'archived';
type EpisodeAction =
  | 'skip' | 'removeFromInbox' | 'markPlayed' | 'markUnplayed' | 'enqueue' | 'dequeue'
  | 'download' | 'cancelDownload' | 'deleteDownload' | 'favorite' | 'unfavorite'
  | 'resetPosition' | 'share' | 'moveToTop' | 'moveToBottom' | 'multiSelect';
type ListScreen = 'queue' | 'inbox' | 'feed' | 'downloads' | 'history' | 'favorites' | 'episodes' | 'search';
type HomeSectionId = 'queue' | 'inbox' | 'surprise' | 'classics' | 'downloads';
```

Two pure functions do the deciding. `actionsFor(episode, screen): EpisodeAction[]` encodes AntennaPod's visibility rules, and `secondaryActionFor(episode, playerState)` picks the row button (Pause/Play/Download/Cancel). With both tested, the action sheet, the swipe settings and the selection bar can never offer an action that makes no sense for that row on that screen.

The phases below are ordered by the coordinator's guidance. Defects come first, then the harness, then the shared building blocks, then screens by how much they are used. Native items get their own phase because they need an EAS build. Each phase says what "done" means and when to stop and ask.

### Phase 0: agree and branch (no code)
The user decides the open questions in "Blocked on Me", especially the base branch and the release cadence. **Done** means a working branch exists, `TASKS.md` is pasted into the repo root, and `npm run typecheck && npm test && npx expo export --platform android` pass on the untouched base. **Stop and ask** if the base checks fail before any change.

### Phase 1: fix the six defects (pure JS, `fix:` commits)
| Step | Change | Proof |
|---|---|---|
| 1.1 | D1: add `f.playback_speed AS feed_playback_speed, f.skip_intro_seconds AS feed_skip_intro_seconds` to `QUEUE_JOIN` and `nextInQueue`, preferably by sharing one `FEED_COLUMNS` constant with `EPISODE_WITH_FEED` | `tsc` + a test that the column lists match; manual: per-feed 1.5× applies from Queue |
| 1.2 | D2: replace the wall-clock timer with the `SleepTimer` union. A pure `tickSleepTimer(state, deltaMs, playing)` ignores gaps > 10 s; "End of episode" = `{kind:'episodes', remaining:1}`, checked in `onFinished` before auto-advance | node tests for the tick rules; device check while locked [UNVERIFIED background timers] |
| 1.3 | D3: pure `resumeRewindSeconds(msSinceLastListen, setting)`; apply it in `play()` too, using `episodes.played_at` as the persisted per-episode timestamp | node tests at 1 min / 6 min / 2 h / 2 days |
| 1.4 | D4: relabel the skip-intro "Global" option to "Off" and migrate NULL→0. Behaviour is unchanged, but the label stops lying | screenshot diff of `feed/settings/1` |
| 1.5 | D5: clear `is_new` inside `enqueue`, `enqueueFront` and `enqueueNext`; drop the extra call in `inbox.tsx` | manual + inbox screenshot after enqueue from the feed page |
| 1.6 | D6: offset paging in `listEpisodesForFeed` (pages of 150) via `onEndReached`; footer "Load older episodes" when `next_page_url` is set, calling `fetchOlderFeedEpisodes` | screenshot of the footer; a seeded feed with > 150 episodes scrolls past 150 |

**Done** means every step's proof passes, all three repo checks are green, and each defect is its own `fix:` commit. **Stop and ask** if D3's fix should also adopt AntennaPod's graduated rewind instead of Sage's fixed setting (a behaviour change), or if a migration is needed and the user hasn't approved schema v4 timing.

### Phase 2: adopt the screenshot harness (dev tooling, `build:`/`test:` commit; needs approval)
Copy `metro.config.js` and `shots-tool/` from the scratch copy. Install the four packages, add an `npm run shots` script and the `.gitignore` lines. Extend `ROUTES` to the four unshot routes and add the light and unseeded sets. Then shoot the baseline from the Phase 1 head. **Done** means two consecutive runs show 0 changed shots, `npx expo export --platform android` and `npm run typecheck` still pass, and `compare.html` is published. **Stop and ask** before installing anything; also if `expo-doctor` objects to the new dependencies, or if a run is not deterministic.

### Phase 3: shared building blocks (pure JS, `feat:`; requires schema v4)
This phase adds the types above and the pure `actionsFor` / `secondaryActionFor` / `canMove` helpers, all with tests. The UI pieces are:

- an `ActionSheet` (glass sheet; header is the episode title, items in AntennaPod's order)
- an `UndoToast` (one at a time, about 5 s, which re-inserts at the old queue position or restores `is_new`)
- a header `OverflowMenu`
- a selection-mode store with a bottom `SelectionBar` offering Select all / above / below
- long-press on `EpisodeRow`
- the context-sensitive secondary button, with a progress ring driven by the existing `useDownloadProgress`
- status glyphs (inbox dot, in-queue)
- a playing-row highlight from theme tokens

Schema v4 lands here in one migration. It adds feed columns for state, item filter, sort order, custom title, skip ending, auto-delete, new-episodes action and the tri-state auto-download, plus a `feed_tags` table and a `download_log` table. `seed.mjs` is updated in the same PR. **Done** means the helper tests pass, every list screen shows the sheet on long-press (new `*--actions` shots), the `after/` diff shows only the intended row changes, and the migration runs on a v3 database without data loss. The migration test uses an old export: copy a v3 `sagepod.db` from a device build [requires the user]. **Stop and ask** if the user prefers several small migrations to one v4, or if a row-height change alters every list more than about 2% (a visual design call).

### Phase 4: Now Playing and mini player (mostly pure JS)
Steps:

1. Hoist `MiniPlayer` to `app/_layout.tsx`.
2. Build the five-button transport row.
3. Add a speed sheet with a slider (0.5–4.0 in 0.05 steps) and editable presets, moving the chip row inside it; save the choice as global speed.
4. Long-press rewind and forward to change the skip amount.
5. Make the right-hand time label toggle total and remaining.
6. Add the chapter row (prev | title | next, using a pure `prevChapterTarget` with tests for AntennaPod's 10 s × speed rule).
7. Draw chapter ticks on the seek bar, with a bubble while scrubbing.
8. Show chapter art on the cover.
9. Cover tap toggles play/pause; the podcast line opens the podcast.
10. Header favourite and sleep icons, plus ⋯ (open podcast, visit website).
11. Turn the sleep chips into a sheet: custom value, minutes or episodes, extend buttons, fade (`player.volume` ramp to 0.1 over 10 s), vibrate, shake only in the last 10 s, auto-enable by hour window.
12. Cache chapters.

**Done** means `player--*` and new `player--speed-sheet` / `player--sleep-sheet` shots match the intended placement, the mini player appears on `feed--*` and `episode--*` shots, and the pure helpers have tests. **Stop and ask** before removing the permanent rate-chip row from the main screen (a visible design change), and on whether shownotes become a swipe page or stay a button.

### Phase 5: Queue
Steps:

1. Pin the info line and divide its time by speed.
2. Move Sort, Lock and Clear into ⋯; add a Search icon.
3. Build the sort sheet: AntennaPod's options plus Sage's "Shortest remaining", asc/desc, and a saved "Keep sorted" that re-sorts on enqueue (pure comparator tests).
4. Add drag handles, replacing ▲▼. This needs a gesture-handler/reanimated draggable list built in-house, because `react-native-draggable-flatlist` is not installed [UNVERIFIED SDK 57 support].
5. Add Lock with a first-time warning.
6. Wire the swipes to the undo toast.
7. Add pull-to-refresh and the inbox-aware empty state.
8. Add "Enqueue location", using a pure `enqueueIndex(position, queue, currentId, rng)` with tests.

**Done** means the `queue--*`, `queue--menu`, `queue--select` and `queue--sort` shots and the comparator tests pass, and drag works on a device. **Stop and ask** if a drag library would be a new native dependency.

### Phase 6: Inbox
Steps: add a Search icon. Add ⋯ with Sort (Date/Duration asc/desc, saved, also feeding Home) and Remove all (confirmation, "don't ask again", toast). Swap swipe directions to AntennaPod's defaults and use a checkmark icon with undo. Add multi-select with a confirmation at 25 or more items. Add offset paging. Keep the chips. **Done** means the `inbox--*` shots show the new header and the swipe icons, and a test covers the ≥25 confirmation threshold. **Stop and ask** before reversing the swipe directions, because it changes muscle memory for existing users.

### Phase 7: Home
Steps:

1. Add shared section chrome: title, right-aligned link, empty text in AntennaPod's copy.
2. Make section 1 queue-backed, paused items first, with a "Queue" link.
3. Make section 2 "See what's new": badge plus 2 swipeable rows.
4. Keep Surprise.
5. Make section 4 "Check your classics", ranked by `playback_history` over 3 years, with a "Library" link on all layouts.
6. Add section 5 "Manage downloads".
7. Add a header Search icon and ⋯ with Refresh and "Configure home screen" (a reorder/hide sheet stored as `HomeSectionId[]`).

**Done** means the `home--*` and `home--configure` shots plus the fresh-install empty set show every section in the default order. **Stop and ask** on whether to keep Sage's in-progress shelf as an optional sixth section. AntennaPod has no such section, but users may like it.

### Phase 8: Episode details and swipe-between-episodes
Steps: add a header ⋯ menu (Skip, Remove from inbox, Reset position, Visit website, Open podcast, Share choices with or without position, media URL). Show links inline in the notes, with long-press Open/Copy/Share; this replaces the separate Links list. Add MM:SS vs HH:MM disambiguation by duration (a pure test in `src/util/timestamps.ts`). Add long-press copy of the title and podcast name. Add a horizontal pager: the caller passes an ordered id list, rendered with a JS `FlatList` using `pagingEnabled` so that `react-native-pager-view` is not needed. **Done** means `episode--*` and `episode--menu` shots and the timestamp tests pass. **Stop and ask** if removing the Links list is unwanted.

### Phase 9: Podcast page, info page and preview
Steps:

1. Add an Info / Filter / Settings icon row under the header.
2. Make ⋯ a real menu: Sort, Refresh, Refresh complete podcast, Visit website, Share with a subscribe link, Remove all from inbox, Unsubscribe → Archive or Delete.
3. Add Search within the podcast.
4. Add pull-to-refresh.
5. Build the filter sheet with include/exclude pairs, saved per feed, plus a "Filtered" banner.
6. Save the sort per feed.
7. Add refresh-failed and updates-disabled banners; this needs a stored `last_refresh_error`.
8. Add the `feed/info/[id]` route: stats card, funding (parse `podcast:funding`), full description, feed URL tap-to-copy via `expo-clipboard`.
9. Add a preview state. Discover and Add-by-URL insert with `state='preview'`; Library, refresh-all and the Inbox filter on `state='subscribed'`; the feed page shows a Subscribe button instead of the chips.

**Done** means the `feed--*`, `feed--menu`, `feed--filter`, `feed-info--*` and `feed--preview` shots look right, a parser test for funding passes, and query tests show previews kept out of Library and the Inbox. **Stop and ask** on how long previews are kept (AntennaPod's cleanup was not traced), and before changing the Discover tap from subscribe to preview.

### Phase 10: Per-podcast settings
Regroup the modal into AntennaPod's sections: Display, Playback, Automation, Advanced. Apply `FeedOverride<T>` to every row. Add Rename, Tags, Skip ending (a pure test of the speed-scaled end check), Volume reduction (0.2/0.5/1.0 only), Auto-delete tri-state, New episodes action, Auto-download tri-state, the include/exclude/min-duration episode filter (generalising `downloadRules.ts`, with tests), Authentication and Edit feed URL. Replace the inline `require('@/db/settings')` with a top-level import (`SP/app/feed/settings/[id].tsx:40-41`). **Done** means `feed-settings--*` shots and the rule tests pass, and each override shows "Global (x)" with the resolved value. **Stop and ask** on where to store credentials securely; `expo-secure-store` is not installed and would need a new build.

### Phase 11: Local search and Discovery
Steps:

1. Add a `search` route: a podcasts row with a "Search online" handoff, episode results (title and notes, every word must match, limit 300), removable chips (Queue, a podcast), and multi-select.
2. Wire the Search icons from Home, Queue, Inbox, the podcast page, Library and Downloads.
3. On Discover: fyyd as a second provider, a chart-country picker (the parameters already exist in `itunes.ts`), an "already subscribed" mark and hiding subscribed shows from charts, clipboard prefill on Add-by-URL, HTML-page feed autodiscovery, a 401 prompt and an Edit-URL retry, and OPML file import with a checklist via `File.pickFileAsync` [UNVERIFIED runtime].

**Done** means `search--*` and `discover--*` shots look right, a query-builder test passes, and a fixture-based fyyd parser test passes. **Stop and ask** before adding Podcast Index, because it needs an API key and secret.

### Phase 12: Library
Steps: add header ⋯ with column count, show titles, counter (inbox / unplayed / downloaded / downloaded + unplayed / none) and saved sort including "most played". Add a filter sheet. Add a tag chip row with rename/delete on long-press. Add an archive view. Add a failed-refresh badge on tiles. Add long-press multi-select with bulk keep-updated / auto-download / delete-after-playing / speed / tags / remove-all-inbox / unsubscribe. Add a "+" header button. Add an "Episodes" shortcut opening a new `list/episodes` screen with filter and sort. **Done** means `library--*`, `library--select` and `episodes--*` shots pass and the saved settings survive a reload in the harness. **Stop and ask** if the user wants Settings in the shortcut row as well as the gear.

### Phase 13: Downloads
Steps: list queued and running downloads above completed ones, with progress. Add a saved sort with asc/desc and title. Add Search. Add "Delete played" with a confirmation. Add multi-select. Add a Download log sheet backed by the v4 `download_log` table, with retry and a copyable details view. Add a delete confirmation. **Done** means the `downloads--*` shots and a log-persistence test pass, with the caveat that real files cannot be shown on web, so seeded rows are used. **Stop and ask** if the startup reconciliation fights seeded `done` rows in the harness.

### Phase 14: Settings
Add sections:

- **User interface**: show remaining time, adjust times to speed, swipe actions for each `ListScreen` as typed `{left: SwipeAction, right: SwipeAction}` pairs restricted to `actionsFor`, a global default episode sort, prefer streaming.
- **Playback**: smart-mark threshold 0–600 s, keep skipped episodes, speed presets, enqueue location (from Phase 5).
- **Downloads**: global new-episodes action, mobile-data rules per type plus a confirmation before a manual download on mobile data, cleanup algorithm choice, "delete removes from queue", "download only when charging" [UNVERIFIED that charging state is readable without a new module].
- **Import/Export**: from Phase 16.
- **About**: version from `expo-constants`, licences, privacy.

Settings search is optional. **Done** means `settings--*` shots show every section and a settings-schema test checks defaults. **Stop and ask** if the page grows past a usable length; at that point sub-screens are the fallback.

### Phase 15: Statistics
Add a segmented control with three tabs. Subscriptions shows a per-feed bar or donut chart drawn with `react-native-svg` (already installed), with a date-range filter and an "include marked played" toggle. Years shows a bar chart from `playback_history.date`. Downloads shows space per feed from `downloaded_bytes`. Add Reset statistics with a confirmation, and a per-feed detail view with a pure `guessReleaseSchedule(dates)` that has tests, reused on the Phase 9 info card. **Done** means `stats--*` shots pass and the aggregation SQL is tested through a pure row-grouping helper. **Stop and ask** before adding a charting library.

### Phase 16: Backup and import/export
Steps: OPML export to a file, with share. Database export (copy `sagepod.db` with `File`) and import with a warning and restart. HTML export and favourites export. Show OPML import progress through the existing `onProgress` callback. **Done** means a round-trip test passes (export, wipe, import, same feeds and positions) on a device build. **Stop and ask** before adding `expo-sharing` (native) and before any import that overwrites the live database.

### Phase 17: Native-build items (EAS build required; `feat:`)
This phase holds everything that needs native code:

- new-episode, download-failed and sync-failed notifications (`expo-notifications`, with per-feed toggles from Phase 10)
- background refresh and automatic backup every 3 days keeping 5 (`expo-background-task`)
- deep links for itpc/pcast/feed and shared URLs (`app.json` intent filters + `+native-intent`)
- file share (`expo-sharing`) and secure credentials (`expo-secure-store`)
- the expo-audio limits: user skip amounts on the lock screen, a "next" button, notification speed/skip/sleep buttons, skip silence, volume boost, and Android headset-unplug pause

There are three routes for the expo-audio limits, in rising cost: a config plugin or `patch-package` patch to expo-audio's `AudioControlsService.kt` and `MediaController.swift`; a small custom Expo Module; or switching player libraries. Whether `react-native-track-player` supports SDK 57 and the New Architecture is **[UNVERIFIED]**. *(Decided: the patch route, D-025. Notification speed and sleep buttons were not added.)* **Done** means each item works on an installed EAS preview build, with the user taking native screenshots. **Stop and ask** before any library switch, before patching a dependency, and before requesting notification permission flows.

### Phase 18: Later or optional, with rationale
gpodder.net and Nextcloud sync need an episode-action journal the schema lacks, plus account UIs and conflict handling. That is the largest single item, and the value is low for single-device users. Chromecast, Android Auto, Wear OS, widgets and the Quick Settings tile each need native modules and platform testing. Video podcasts need a video view and PiP, while Sage Pod's parser already prefers audio. Echo year-in-review is seasonal and needs about 7 bespoke screens. ID3/Vorbis/M4A chapter extraction needs ranged binary reads. Customisable navigation and a default start page conflict with the fixed glass tab bar. Parental control is little used. Each item should be its own proposal, approved one at a time.

### Phase 19: Background downloads (D-029)
*(Built as planned in one PR. 19a became the transfer line in the log: the native worker does the resuming, because expo-file-system's Android resume data is a byte offset only it can use, and iOS resume data exists only after a pause. 19d: iOS restarts, recorded in D-029.)*

**Why.** Downloads are slow unless the app is open, and fastest on the Downloads or podcast screen. The cause is in how they run, not in the network:

- On Android, expo-file-system's `createDownloadTask` is a plain OkHttp call inside the app process (`expo-file-system/android/.../FileSystemDownloadTask.kt`). `sessionType: 'background'` (`SP/src/player/downloads.ts:328-329`) is iOS-only and does nothing on Android. With no foreground service, no WorkManager job and no Wi-Fi lock, Android throttles, freezes or kills the process once the app leaves the screen. With the screen off, Wi-Fi drops into power save.
- The queue is a JS array (`waiting`, `active`, `pump()`, `SP/src/player/downloads.ts:38, 286-295`), so it advances only while the JS runtime is awake. Nothing resumes after the process dies. `manageAutoDownloads` (`:547`) starts pending rows again **from zero** at the next launch.
- No `Range` resume: a dropped connection or a retry (`:418`) downloads the whole file again.
- iOS uses a real background `URLSession`, but JS loses the task on relaunch and starts again from zero.

**How AntennaPod does it.**
- Each episode is a WorkManager `OneTimeWorkRequest` running `EpisodeDownloadWorker`. It is unique per media URL with `KEEP` and tagged so it can be cancelled (`AP/net/download/service/.../feed/DownloadServiceInterfaceImpl.java:29-45`).
- A manual download is expedited, with a `CONNECTED` constraint when the user overrides the rules. An auto download waits on `UNMETERED` unless mobile downloads are allowed (`:60-70`). The OS waits for the network, not the app.
- The worker runs as a foreground service (`getForegroundInfoAsync`, `EpisodeDownloadWorker.java:133`). It shows one ongoing "Downloading episodes" notification with each title and percentage, refreshed by a 1 s progress thread (`:76`). It holds a `WifiLock` for the duration (`:164-166`).
- It retries 3 times through `Result.retry()` (`:220-225`). It fails fast on 401/403/404 and blocked I/O. A 416 deletes the partial file and retries. `onStopped` cancels the transfer (`:124`).
- `HttpDownloader` resumes with `Range: bytes=<soFar>-` and `If-Range`, and checks `Content-Range` (`AP/.../feed/remote/HttpDownloader.java:95-136`).

**Steps.**

1. **19a: Measure, then fix what JavaScript can fix** (`fix:` / `perf:`, ships by OTA).
   - Log bytes per second, AppState and attempt number per download to the download log's details, so the cause is shown on a device and not guessed.
   - Resume from the partial file: if the server answered with `Accept-Ranges`, keep the `.part` file and send `Range` / `If-Range` (`ETag` or `Last-Modified`) on the retry and on the startup re-queue. A pure `resumePlan(headers, partialBytes)` with tests decides resume, restart or fail (on a 416 or a changed validator).
   - Keep `pump()` independent of any mounted screen, and check progress emission isn't throttled by screen subscriptions.
   - **Done** means resume tests pass and the device log shows throughput by state. This step alone doesn't fix the backgrounding.
2. **19b: Local Expo module `modules/episode-downloads`** (Android, `feat:`; needs a build).
   - A Kotlin `EpisodeDownloadWorker` (CoroutineWorker) mirroring AntennaPod:
     - unique work per media URL, `KEEP`
     - a manual download is expedited with `CONNECTED`
     - an auto download waits on `UNMETERED` (unless mobile data is allowed), plus `requiresCharging` when "only while charging" is on
     - runs in the foreground with type `dataSync`
     - holds a `WifiLock` (high performance)
     - writes `.part` and renames on success
     - resumes with Range / If-Range
     - checks the HTML captive portal and truncation as today
     - retries 3 times, failing fast on 401/403/404, deleting and restarting on 416
     - reports progress through `setProgress` every second
     - feed credentials go in as headers in the work input, never logged
   - One ongoing grouped notification ("Downloading 2 episodes", titles and %, a Cancel action). Errors keep using the existing `notifyDownloadFailed`.
   - The JS API is `enqueue({episodeId, url, dest, headers, isAuto, constraints})`, `cancel(episodeId)`, `getAll()` and an `onProgress` / `onFinished` event. The worker writes no SQLite. JS applies results through the repository: live when the app is open, and through a startup and background-task reconcile of finished `WorkInfo` otherwise.
   - WorkManager is already in the build (expo-background-task pulls `androidx.work:work-runtime-ktx`), so this adds **no third-party dependency**. It does add new native code, the `FOREGROUND_SERVICE_DATA_SYNC` permission and the `SystemForegroundService` manifest entry, through the module's config plugin.
   - **Done** means `npx expo prebuild` shows the manifest entries, `expo export` and the typecheck pass, and pure tests cover constraints, input mapping and the error-to-retry table.
3. **19c: Wire Sage Pod onto it** (`feat:`).
   - `queueDownload`, `cancelDownload`, `manageAutoDownloads` and `retryHeldAutoDownloads` use the module on Android. The JS `waiting` / `active` / `pump()` and the `heldAutoDownloads` meta list drop out there, because WorkManager constraints replace them. `MAX_CONCURRENT` goes too: WorkManager's own executor limits concurrency.
   - `useDownloadProgress` / `subscribeToDownloads` read the module's progress, so `EpisodeRow`, `EpisodeDetails` and the Downloads screen work unchanged.
   - A startup reconcile replaces "re-queue from scratch": `running` / `enqueued` work stays, `succeeded` is marked done, `failed` is logged, and a row with no work is re-enqueued (and resumes from its `.part`).
   - Expo Go and web keep the current JS path (Expo Go can't load the module).
   - Tests: the reconcile table (row state × WorkInfo state → action) as a pure function.
4. **19d: iOS** (`feat:` or a documented limitation).
   - Reattach to the existing background `URLSession` tasks on launch (by task description = episode id) instead of starting again, or accept restarts and record the limit in D-029. Decide after 19c, based on whether expo-file-system's session identifier is stable across launches [UNVERIFIED].
5. **19e: Device checks** (one preview build).
   - Start 3 downloads, then lock the screen; switch apps; swipe the app away; turn airplane mode on and off mid-download (it must resume, not restart); reboot with auto downloads pending on Wi-Fi + charging; cancel from the notification; a protected feed; a 404 (fails once, logged).
   - Compare throughput with the 19a logs.

**Shots.** No visual change is planned. The notification is native, so the user takes a screenshot of it.

**Stop and ask:**
- before 19b, for approval of a local native module (new native code, a new Android permission)
- before the one EAS preview build in 19e, for its budget
- if expo-file-system's partial `.part` handling can't do 19a without forking it

### Phase 20: Echo, the year in review (D-030)
*(Built as planned in one PR. The seed's year of history already passes 10 hours, so `seed.mjs` didn't change; the harness opens each card with `/echo?still=1&card=n` and moves its clock to 15 December for the Home card and the Statistics entry.)*

**Why.** AntennaPod shows "Echo" on its Home screen from 10 December: seven full-screen story cards about the listener's year, worked out on the phone. It is the last Phase 18 item that needs no native code and no new dependency, so it ships over the air (D-028) and is the first real test of that pipeline. It has to be merged before 10 December to matter this year.

**How AntennaPod does it** (`AP/ui/echo/`, `AP/app/.../home/sections/EchoSection.java`):
- **When.** `EchoConfig.isCurrentlyVisible()`: the release year, December, day 10 or later. Home adds an Echo card ("Review the year", "Your top podcasts and stats from the past year. Exclusively on your phone.") only if the year's listening is at least 10 hours. Closing the card hides it for that year (`PREF_HIDE_ECHO` = year); under 10 hours it hides itself.
- **The player** (`EchoActivity`): 7 screens, each about 10 s, with a segmented progress bar. A tap moves on, the last tap closes. Each screen has its own animated background.
- **The screens**:
  1. *Intro*: "Your year / 2026 / in podcasts / generated privately on your phone".
  2. *Hours played*: total hours this year, from N different podcasts.
  3. *Queue*: hours still waiting in the queue (duration minus position) from N episodes, and "about X each day until 2027 starts". Up to 1.5 h a day: "ready to make a clean start". Up to 24 h: "quite a bit to go". Above that: "Wait, what?".
  4. *Listened after*: the median time from release to completion, for episodes released and completed this year (`PodDBAdapter.getTimeBetweenReleaseAndPlayback`). Up to 2.5 days: 🏃 "You're a podcast addict"; otherwise 🧘 "You're easy going".
  5. *Hoarder*: the share of auto-refreshed subscriptions played this year. Under 25 %: 🗄️ hoarder. Under 75 %: ✅ "no hoarding here", naming a random one with recent unplayed episodes. Otherwise: ✨ "Clean!".
  6. *Thanks*: "for sticking with us" since the month of the first play, or "for joining us this year".
  7. *Final share*: the top 5 podcasts' covers and titles, with a Share button that draws a 1000 × 1000 PNG and shares it with "My year 2026 in podcasts. #AntennaPodEcho".

**What Sage Pod already has.** Every figure comes from data already stored, so there is **no migration**:
- hours and podcasts from `playback_history` (`getListenRows`, `SP/src/db/stats.ts:123`), honouring a statistics reset
- the queue from `queue` joined to `episodes.duration` and `position`
- release to completion from `episodes.published_at` and `played_at`
- active subscriptions from `feeds.keep_updated` and `state = 'subscribed'`
- the first play from `MIN(playback_history.date)`

**Steps.**
1. **20a: The numbers** (`feat:`).
   - A pure `src/echo/` module: `echoWindow(now)` (10–31 December of the current year), `queueOutlook(seconds, episodes, now)` with the 1.5 h / 24 h thresholds, `medianDelay(pairs)`, `listenerType(ms)`, `hoarderVerdict(played, total)`, `thanksLine(firstDay, year)` and `topFeeds(rows, 5)`.
   - A repository `src/db/echo.ts` with one `getEchoYear(year)` that runs the five queries and returns one plain object.
   - Tests for every threshold and for the empty year, a reset mid-year, and a queue with unknown durations.
2. **20b: The Echo screen** (`feat:`).
   - A full-screen modal route `app/echo.tsx` holding the 7 cards. It auto-advances every 10 s; a tap on the right goes forward, on the left goes back; holding pauses it; the last tap closes it. Segmented progress bar at the top.
   - Five animated backgrounds (bubbles, waveform, stripes, rotating squares, waves) drawn with `react-native-svg` and Reanimated, both already installed. Colours come from theme tokens.
   - The system reduce-motion setting (Reanimated's `useReducedMotion`) turns the animation off.
   - The final card shows the top 5 covers (`expo-image`) and titles.
3. **20c: The way in** (`feat:`).
   - An Echo card at the top of Home, above the configurable sections, while `echoWindow` is open, the year has at least 10 h of listening and the card isn't hidden for this year (setting `echo_hidden_year`). Its ✕ hides it for the year.
   - "Your year in podcasts" in the Statistics screen's menu during the same window, so a hidden card can still be reached.
   - The `/echo` route also opens outside the window, for the screenshot harness and deep links.
4. **20d: Sharing** (`feat:`).
   - The Share button shares text through React Native's `Share` API: "My year 2026 in podcasts: 214 hours from 18 podcasts. Top 5: …". No dependency.
   - **Not in this phase:** a shared PNG like AntennaPod's. That needs `react-native-view-shot` (native code, so a new build). It is a separate proposal if the owner wants it.
5. **20e: Check.**
   - Seed a year of `playback_history` in `shots-tool/seed.mjs`, and add `/echo` (all 7 cards) and the Home card to the harness. Run before and after shots.
   - Typecheck, tests, expo-doctor and `expo export` must pass.
   - The fingerprint must be unchanged, so the phase reaches the installed 0.23.2 build as an over-the-air update.

**Shots.** New screens: all 7 Echo cards, the Home card, and the Statistics menu entry (phone and tablet). The Home "before" shot shows no card.

**Stop and ask:**
- if any step turns out to need a native dependency (for example image sharing)
- before an EAS build. None is planned: this phase ships over the air.

### TASKS.md to paste into the repo root

```markdown
# Sage Pod — AntennaPod parity
Rules: one Conventional Commit per step; each step has a node:test or a screenshot diff;
SQL only in src/db; colours via useTheme(); update shots-tool/seed.mjs with every migration.
Stop and ask: new native dependency, schema migration, visible design change, anything destructive.

## Phase 0 — setup
- [ ] Base branch chosen (main after PR 9, or claude/sage-pod-player-wx2g3p)
- [ ] Baseline: typecheck, test, expo export android all green

## Phase 1 — defects (fix:)
- [ ] D1 queue queries include feed_playback_speed / feed_skip_intro_seconds
- [ ] D2 sleep timer counts only while playing; "end of episode" ends at the episode end
- [ ] D3 rewind-on-resume applies in play(), per episode via played_at
- [ ] D4 skip-intro "Global" relabelled "Off" (NULL→0)
- [ ] D5 enqueue/enqueueFront/enqueueNext clear is_new; inbox.tsx double call removed
- [ ] D6 feed page paging (150) + "Load older episodes" via fetchOlderFeedEpisodes

## Phase 2 — screenshot harness (approval needed)
- [ ] Add react-native-web, @expo/metro-runtime, pixelmatch, pngjs; metro.config.js; shots-tool/
- [ ] Extend routes (+add-feed, feed settings, downloads, history), light + empty sets
- [ ] Two runs identical; android export + typecheck still green; baseline published

## Phase 3 — shared building blocks
- [ ] Types: FeedOverride, SleepTimer, EnqueuePosition, FeedState, EpisodeAction, ListScreen, HomeSectionId
- [ ] Pure + tested: actionsFor, secondaryActionFor, canMove
- [ ] ActionSheet, UndoToast, OverflowMenu, SelectionBar, EpisodeRow long-press, state button + ring, status glyphs, playing highlight
- [ ] Schema v4 migration + seed update + v3→v4 upgrade check

## Phase 4 — Now Playing & mini player
- [ ] Mini player on every screen
- [ ] 5-button transport; speed sheet (slider, presets, saved)
- [ ] Long-press skip amounts; total/remaining toggle
- [ ] Chapter row, seek ticks + bubble, chapter art, cover tap
- [ ] Header favourite/sleep + ⋯; sleep sheet (episodes, extend, fade, vibrate, auto-enable)

## Phase 5 — Queue
- [ ] Pinned speed-aware info line; ⋯ Sort/Lock/Clear; Search icon
- [ ] Sort sheet + Keep sorted; drag handles; undo on swipe; pull-to-refresh; inbox-aware empty
- [ ] Enqueue location setting

## Phase 6 — Inbox
- [ ] Search; ⋯ Sort + Remove all (confirm); swipe swap + undo; multi-select; paging

## Phase 7 — Home
- [ ] Section chrome + empty texts; queue section; See what's new; Classics; Manage downloads
- [ ] Header Search + ⋯ Refresh / Configure home

## Phase 8 — Episode details
- [ ] ⋯ menu (skip, inbox, reset, website, open podcast, share options)
- [ ] Inline links + long-press; timecode disambiguation; copy; swipe between episodes

## Phase 9 — Podcast page / info / preview
- [ ] Icon row; real ⋯ menu; search; pull-to-refresh; saved filter + sort; banners
- [ ] feed/info/[id] (stats, funding, URL copy); preview state + Subscribe CTA

## Phase 10 — Per-podcast settings
- [ ] Display/Playback/Automation/Advanced groups with FeedOverride everywhere
- [ ] Rename, tags, skip ending, volume reduction, auto-delete, new-episodes action, auto-download tri-state, episode filter, auth, edit URL

## Phase 11 — Search & Discovery
- [ ] Local search route + entry icons; fyyd; country; subscribed marks; clipboard; autodiscovery; OPML file import

## Phase 12 — Library
- [ ] Display ⋯ (columns, titles, counter, sort); filter; tags; archive; error badge; multi-select; "+"; Episodes screen

## Phase 13 — Downloads
- [ ] Running + completed; saved sort; search; delete played; multi-select; persisted download log with retry

## Phase 14 — Settings
- [ ] UI, Playback, Downloads, About sections; swipe-action config per screen

## Phase 15 — Statistics
- [ ] Subscriptions / Years / Downloads tabs; filter; reset; per-feed detail + release guess

## Phase 16 — Backup
- [ ] OPML/DB/HTML/favourites export + DB import; OPML progress

## Phase 17 — Native (EAS build)
- [x] Notifications; background refresh + auto backup; deep links; sharing; secure store (17a, D-024)
- [x] expo-audio limits (lock-screen amounts, Next, skip silence, boost, headset unplug): patched expo-audio (17b, D-025)

## Phase 18 — Optional (one proposal each)
- [x] Widget and Quick Settings tile (18a, D-026)
- [x] Binary chapters (18b, D-027)
- [ ] Sync, Cast, Auto/Wear, video, Echo, nav customisation, parental control
```

## Conclusion

The audit changes what "parity" means for Sage Pod. The work is mostly not missing screens. It is about five missing **interaction patterns**: long-press, multi-select, undo, overflow menus and saved sort/filter. AntennaPod uses those patterns everywhere, and Sage Pod uses them nowhere. Building them once, behind typed action rules with tests, turns most of the per-screen gap tables into wiring work. AntennaPod's own design shows why this order pays off: one `FeedItemMenuHandler` and one swipe-actions system serve every list. The second lesson is that the audio library sets the real ceiling. Everything up to Phase 16 runs in JavaScript on the current stack. The features AntennaPod users notice on the lock screen (custom skip amounts, a next button, skip silence) all depend on one decision, made once, about patching or replacing expo-audio. That decision deserves to be made early, even though the plan schedules the work late.

## Blocked on Me

- **Approve the screenshot harness** (Phase 2) before anything is installed. It adds `react-native-web`, `@expo/metro-runtime`, an exact `react-dom` pin, `pixelmatch`, `pngjs`, `metro.config.js` and `shots-tool/`.
- **Choose the base branch.** Either branch from `claude/sage-pod-player-wx2g3p` (PR 9 not merged) or wait for PR 9 to land on `main`.
- **Choose a release cadence.** Every merged `feat:` cuts a minor release. Merge phase by phase, or collect phases on a long-lived branch?
- **Behaviour changes that need a yes or no:**
  - graduated rewind instead of the fixed setting (D3)
  - swapping the Inbox swipe directions
  - moving the permanent speed-chip row into a sheet
  - changing a Discover tap from subscribe to preview
  - dropping the episode page's separate Links list
  - keeping the in-progress shelf as an extra Home section
- **Schema strategy**: one v4 migration in Phase 3, or one per phase. Also, a v3 `sagepod.db` copied from your device to test the upgrade.
- **Native decisions** (Phase 17): whether to patch expo-audio, build a custom module or switch libraries; whether to add `expo-notifications`, `expo-background-task`, `expo-sharing` and `expo-secure-store`. Each one needs an EAS build, and you would take the native screenshots.
- **Podcast Index**: whether to get API credentials, or stay with keyless providers (iTunes + fyyd).

## Changed

Nothing in the repository was modified during the research itself. This plan was later copied into `docs/PARITY-PLAN.md`, and the harness was adopted into `shots-tool/` in Phase 2.

## Found

- **Verified defect D1.** The queue queries omit per-feed speed and skip-intro (`SP/src/db/queue.ts:4-10, 128-137` vs `SP/src/player/service.ts:160, 175`).
- **Correction to the research notes.** Playback *does* clear the inbox "new" flag on the first position save (`SP/src/db/episodes.ts:171, 180`). Only enqueueing from outside the Inbox fails to clear it.
- **Misleading or unsafe controls:**
  - The podcast page's "⋯" icon jumps straight to Unsubscribe.
  - The Inbox dismissal uses a trash icon.
  - Inbox "dismiss all" has no confirmation.
  - Download delete has no confirmation.
- **Settings that don't do what they say:**
  - "Wi-Fi only" does not apply to manual downloads, and there is no prompt on mobile data (`SP/src/player/downloads.ts:156-177`).
  - The refresh interval is checked only when the app opens.
  - A speed picked in the player is lost on the next episode.
- **Completion handling.** Inside the 20 s completion tail, `flushPosition` marks an episode played but does not remove it from the queue or delete it; only `onFinished` does.
- **Built but unused code:**
  - The download log is in memory only and nothing imports it (`SP/src/player/downloads.ts:34-50`).
  - `searchEpisodes()` and `enqueueNext()` have no callers.
- **Convention breach.** `SP/app/feed/settings/[id].tsx:40-41` uses an inline `require`.
- **Library capabilities checked in `node_modules` types:**
  - expo-audio 57 exposes `isBuffering` but no buffered position, so AntennaPod's buffered bar can't be copied without native work.
  - expo-file-system 57 declares `File.pickFileAsync` and `Directory.pickDirectoryAsync`, so file import may not need a new module [runtime UNVERIFIED].
- **Web-only bug.** The dev-server run surfaced a real DOM warning, `<button>` nested in `<button>` on Home (nested Pressables). It is harmless on native but worth fixing for accessibility.
- **Open, unconfirmed:**
  - whether JS timers (sleep timer, 5 s position saver) keep running while the app is in the background
  - Android headset-unplug pause
  - SDK 57 support of `react-native-track-player` and of any drag-list library
  - how AntennaPod cleans up stale previews

All of these are marked [UNVERIFIED] above.
