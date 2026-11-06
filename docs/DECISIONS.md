# Decisions

Settled decisions for Sage Pod. Don't re-litigate these without new
information; if you change one, add a new entry that supersedes it.
Format: context → decision → consequences → when to revisit.

| ID | Decision | Status |
|---|---|---|
| D-001 | Goal: AntennaPod feature parity, keeping Sage Pod's design | Accepted |
| D-002 | One phase = one PR = one release | Accepted |
| D-003 | Approved behaviour changes to match AntennaPod | Accepted |
| D-004 | Audio engine: stay on expo-audio | Accepted (route amended by D-025) |
| D-005 | Schema migrations: one per phase that needs it | Accepted |
| D-006 | Screenshots: web export + Playwright harness | Accepted |
| D-007 | Discovery providers: keyless only (iTunes, then fyyd) | Accepted |
| D-008 | Surprise Me: seeded order, round-robin per podcast | Accepted |
| D-009 | Tablet layout: window classes at 600 / 840 dp | Accepted |
| D-010 | Row button streams by default ("Prefer streaming" on) | Accepted |
| D-011 | Device builds: one EAS build at the end of the parity work | Accepted |
| D-012 | Now Playing: sheets instead of inline lists; Show notes button | Accepted |
| D-013 | Queue: in-house drag list; Keep sorted and Lock turn dragging off | Accepted |
| D-014 | Home: configurable sections; In progress shows only unqueued episodes | Accepted |
| D-015 | Episode pager swipes through the podcast's episodes | Accepted |
| D-016 | Previews: stored, kept out of the library, cleared after a day | Accepted |
| D-017 | Per-podcast settings: overrides fall back to global; feed passwords wait for secure storage | Accepted |
| D-018 | Search: screens keep their own search, with a way out to the library search; online search merges Apple and fyyd | Accepted |
| D-019 | Library: options in ⋯, tags in the chip row, archive on unsubscribe, Statistics and Settings in the menu | Accepted |
| D-020 | Downloads: own screen, log in SQLite, ask before mobile data, no download upkeep on web | Accepted |
| D-021 | Settings: AntennaPod's sub-pages, swipe pairs per list, smart mark 30 s, no "only when charging" | Accepted |
| D-022 | Statistics: three tabs, svg charts, a reset that keeps history | Accepted |
| D-023 | Backup: save to a picked folder, restore through SQLite's backup API | Accepted |
| D-024 | Phase 17a: Expo's own native modules, no patched code | Accepted |
| D-025 | Phase 17b: patch expo-audio with patch-package, build it from source | Accepted |
| D-026 | Phase 18a: Android widget with react-native-android-widget, tile through the media session, no iOS widget yet | Accepted |
| D-027 | Phase 18b: chapters from the audio file, read in TypeScript over byte ranges | Accepted |
| D-028 | Over-the-air updates with EAS Update | Accepted |
| D-029 | Phase 19: Android downloads in a WorkManager worker (local Expo module), resumable with Range | Accepted |
| D-030 | Phase 20: Echo year in review, in TypeScript, shipped over the air; text sharing only | Proposed |

---

## D-001 — Feature parity with AntennaPod, Sage Pod's design

**Context.** Sage Pod is modelled on AntennaPod. A feature audit (see
`docs/PARITY-PLAN.md`) found that the gap is mostly interaction patterns
(long-press menus, multi-select, undo, overflow menus, saved sort/filter)
rather than missing screens.

**Decision.** Port every AntennaPod feature, placed where AntennaPod places it
(Home sections, Queue toolbar, Now Playing layout), but drawn in Sage Pod's
existing visual language. Copy AntennaPod's defaults (page sizes, thresholds,
orders) unless there's a reason not to.

**Revisit** if the owner wants Sage Pod to diverge deliberately on a feature.

## D-002 — One phase, one PR, one release

**Context.** semantic-release publishes on every push to `main`; the owner
wants a release per phase.

**Decision.** Each phase in `TASKS.md` is developed on the working branch,
opened as a single PR to `main`, and released when merged. When a phase PR is
merged, the next phase starts from the latest `main`.

**Merging is delegated to the lead developer** (owner, 2026-10-06): merge each
phase PR yourself once the Checks workflow is green and every review thread
(including the Codex bot's) is addressed. Always use a **merge commit**, never
squash (see HANDOVER §5), then confirm the release tag appeared.

## D-003 — Approved behaviour changes

Approved by the owner (2026-10-06) to match AntennaPod:

1. **Rewind on resume is scaled by pause length** (0.8 s / 3 s / 10 s / 20 s),
   replacing the fixed-seconds setting. *(Shipped in Phase 1, D3.)*
2. **Inbox swipe directions match AntennaPod**: right = add to queue,
   left = remove from inbox, with undo. *(Shipped in Phase 6, v0.7.0.)*
3. **The permanent speed-chip row on Now Playing moves into a speed sheet**
   opened from the speed button (slider + presets, saved).
4. **A Discover tap opens a preview** (feed page in preview state with a
   Subscribe button) instead of subscribing immediately.
5. **The episode page's separate Links list is dropped** in favour of inline,
   long-pressable links in the show notes. *(Shipped in Phase 8, v0.9.0.)*
6. **The in-progress "Continue Listening" shelf stays** as an extra Home
   section alongside AntennaPod's queue-based section.

## D-004 — Audio engine: stay on expo-audio

**Context.** expo-audio 57 cannot do several AntennaPod features: custom
lock-screen seek amounts (fixed at 10 s), next/previous or custom lock-screen
buttons, skip silence, volume boost above 1.0, buffered-position display. The
alternatives are patching expo-audio, writing a local Expo native module, or
switching to another player library (e.g. react-native-track-player).

**Decision (lead developer).** Keep expo-audio as the engine. Build every
pure-JS feature on it now. When a native-only feature is scheduled
(Phase 17), add a small **local Expo module** (`modules/`) for that specific
capability, rather than switching libraries.

**Why.**
- expo-audio is first-party and versioned with the Expo SDK, so SDK upgrades
  stay low-risk; a third-party player adds its own release cadence and
  New Architecture / RN 0.86 compatibility risk *[UNVERIFIED for current
  track-player versions]*.
- Switching means rewriting `src/player/service.ts`, the lock-screen
  integration and the queue model for the sake of a few narrow gaps.
- The gaps are independent; a local module can close them one at a time, each
  with its own EAS build and test.

**Consequences.** Lock-screen buttons stay seek ±10 s until the native phase.
Skip silence and volume boost are Phase 17 items, not earlier.

**Revisit** if Chromecast or Android Auto become priorities (they need a full
Media3/MediaSession integration, at which point a library may be cheaper than
a custom module), or if a future Expo SDK adds custom lock-screen commands.

*Amended by D-025:* the gaps were closed with a patch to expo-audio itself
rather than a local module, since the lock-screen controls live inside
expo-audio's own media session and a separate module can't reach them.
expo-audio stays the engine.

## D-005 — One migration per phase

**Decision.** Each phase that needs schema changes ships its own migration
(bump `LATEST_SCHEMA_VERSION`, append to `MIGRATIONS`), together with the
matching `shots-tool/seed.mjs` update and an upgrade check from the previous
version. No phase-spanning mega-migration.

**Why.** Matches release-per-phase: every release is self-contained and
reviewable, and a bad migration affects one phase only.

## D-006 — Screenshot harness on the web build

**Context.** No Android emulator or iOS simulator is available in the cloud
environment, and the owner tests on a physical device.

**Decision.** Use the production web export rendered in headless Chromium via
Playwright, with seeded demo data and three web-only Metro shims
(`shots-tool/`, `npm run shots`). It's the before/after evidence for every UI
change. Native visuals (glass, platform fonts, safe areas) are checked on an
EAS preview build when they matter.

The shims in `metro.config.js` apply to every **web** bundle (not behind an
env flag): they only intercept imports from `app/` and `src/` on the web
platform, native bundles never reach them, and without them the web build
can't open its database at all, so gating them would only make
`npm run web` fail. The web-only packages live in `devDependencies`.

## D-007 — Keyless discovery providers

**Decision.** Use only providers that need no API key (Apple iTunes now, fyyd
next). Don't add Podcast Index until there's a plan for storing secrets.

**Why.** No secrets to manage, nothing to leak, works offline-first.

## D-008 — Surprise Me

**Decision.** Ordered by `(episode id × seed) mod 46471`, with a module-level
seed changed only by the shuffle button (AntennaPod's approach); round-robin
across podcasts up to 8; skip episodes older than two years and half-listened
ones except those started within the last hour. *(Shipped in v0.3.0.)*

## D-009 — Tablet layout breakpoints

**Decision.** Window classes compact (< 600 dp), medium (600–839) and expanded
(≥ 840), following Material's window size classes and AntennaPod's sw600/sw720
switches. Grid columns are computed from width (3 to 8, minimum tile 150 dp);
content is capped at 1040 dp and centred. No side navigation rail for now
(owner's choice). *(Shipped in v0.3.0.)*

## D-010 — The row button streams by default

**Context.** AntennaPod's episode-row button downloads episodes that aren't on
the device unless "Prefer streaming" is on. Sage Pod's row button has always
played (streamed) immediately, and its owner listens on a phone.

**Decision.** Adopt AntennaPod's context-sensitive button (pause / play /
cancel with progress ring / stream or download / mark played) but default
"Prefer streaming" **on**, so the button still plays straight away. The setting
(Settings → Playback) switches it to AntennaPod's Download button.

## D-011 — One device build at the end

**Decision.** The owner will make a single EAS preview build once the parity
phases are done, rather than one per phase. Until then, verification is unit
tests, the CI checks and the web screenshot harness; the "On device" checklists
in each phase PR accumulate for that build. Native-only items (Phase 17) still
need that build and the owner's budget approval.

## D-012 — Now Playing: sheets instead of inline lists, notes one tap away

**Context.** Sage Pod's player showed the speed chips, sleep chips and the
full chapter list inline. AntennaPod keeps the player to the cover and the
controls, with speed, sleep and chapters in dialogs, and the show notes on a
second page.

**Decision.** Speed, sleep timer, chapters and skip amounts open bottom sheets
from the controls. Show notes stay on the episode screen, reached from a
"Show notes" button, instead of a swipe page, because the episode screen
already renders them well. Speed chosen in the sheet is saved on the podcast if
it has its own speed, otherwise as the global speed.
The episodes sleep timer counts episodes that actually finish, so it
survives a pause or a skip. *(Shipped in v0.5.0.)*

## D-013 — Queue: in-house drag list; Keep sorted and Lock turn dragging off

**Context.** AntennaPod reorders the queue by dragging a handle. The usual
React Native libraries (`react-native-draggable-flatlist`) are not installed,
and adding one risks SDK 57 / New Architecture compatibility.

**Decision.** `src/ui/DraggableList.tsx` builds drag-to-reorder from
gesture-handler and Animated, which are already installed, so no new native
dependency is needed. The maths (`dropIndex`, `moveItem`) is pure and tested. A handle
also offers Move up / down / to top / to bottom to screen readers. As in
AntennaPod, "Keep sorted" re-sorts after every insertion, so dragging and Move
to top are hidden while it is on. Lock queue hides handles and swipes.
"Enqueue location" defaults to Back, matching the old behaviour. *(Shipped in v0.6.0.)*

## D-014 — Home: AntennaPod's sections, configurable; In progress de-duplicated

**Decision.** Home is a list of sections in a saved order, with each one
showable or hidden: Continue listening (the queue), See what's new, Surprise me,
Check your classics, Manage downloads, then Sage Pod's In progress and
Subscriptions. The Inbox banner is replaced by See what's new. In progress now
shows only started episodes that are *not* queued, since Continue listening
already shows queued ones. Sections added later appear at the end, visible, for
existing users. The header Search opens a local library search. It is
deliberately small for now; the search phase adds chips and online search.
*(Shipped in v0.8.0.)*

## D-015 — Episode pager: the podcast's episodes, newest first

**Context.** AntennaPod swipes between the episodes of the list you opened an
episode from. Sage Pod opens episodes from many lists, and `EpisodeRow` doesn't
know which list it is in.

**Decision.** The episode page swipes through the same podcast's episodes in
the podcast page's default order (newest first). That needs no wiring through
every list. The page list is frozen once loaded, so a refresh doesn't move the
page under the reader. Following the originating list is a later refinement.
*(Shipped in v0.9.0.)*

## D-016 — Previews: stored like podcasts, hidden, cleared after a day

**Context.** AntennaPod opens a podcast before you subscribe. How long it keeps
an unsubscribed preview wasn't traced.

**Decision.** A preview is a normal `feeds` row with `state = 'preview'`, so the
podcast page, playback and the queue work unchanged. Library, refresh, OPML
export, search and the Home sections only read subscribed podcasts. Preview
episodes are stored as not new, so the Inbox never sees them. At startup, previews
older than 24 hours are deleted unless one of their episodes is queued,
downloaded, a favourite or being restored by the player. Subscribing flips the
state and refreshes. *(Shipped in v0.10.0.)*

## D-017 — Per-podcast settings: override or follow global

**Context.** AntennaPod lets each podcast override playback, automation and
download settings. Some have a global counterpart (speed, new-episode action,
auto-download, auto-delete), some don't (skip intro / ending, volume
reduction). Password-protected feeds need the credentials kept somewhere safe.

**Decision.** Every per-podcast value with a global counterpart is nullable:
`null` means "follow global", and the picker's first choice reads
"Global (current value)" so the effect is visible. Values without one are
simply off when unset. Migration 5 adds the columns and carries the old
per-podcast auto-download flag over as an explicit "on". A custom name is
stored beside the feed's title and wins everywhere through `COALESCE`, so a
refresh never overwrites it. The auto-download filter keeps Sage Pod's built-in
skip of trailers and short clips; a podcast's own minimum replaces the
3-minute default. Feed usernames and passwords wait for Phase 17, where
`expo-secure-store` (a native module) arrives with the device build; storing
them in SQLite in plain text was rejected. *(Shipped in v0.11.0.)*

## D-018 — Search: in-place first, then everywhere; one online search

**Context.** In AntennaPod, the search icon on the Queue, a podcast or the
Downloads opens the one search screen with a removable chip for where you came
from. Sage Pod's Queue, Inbox and podcast page already filter in place
(Phases 5, 6 and 9). AntennaPod also searches each directory separately.

**Decision.** Screens with their own search keep it: you stay in the list you
were looking at. When it finds nothing, "Search all podcasts" carries the
words to the library search, which takes the place of the chips. Screens
without their own search (Home, Library, the Downloads / Favourites / History
lists) open the library search directly. Online search asks Apple and fyyd at
once and merges them, Apple first, dropping the same feed seen twice; one
failing still shows the other's results. Podcasts you follow are marked in
results and left out of the charts. A website address is searched for feed
links. A feed that needs a password gets an explanation, not a prompt: putting
the password in the stored address was rejected for the same reason as in
D-017. *(Shipped in v0.12.0.)*

## D-019 — Library: options in the menu, tags in the chip row, archive

**Context.** AntennaPod's Subscriptions screen has display, sort and filter
options, tag folders, multi-select and an archive. Sage Pod's Library had
sort chips, a layout toggle and four shortcuts (Favourites, Downloads,
History, Stats). The plan asked whether Settings should join the shortcuts.

**Decision.** Display, Sort and Filter live in the header's ⋯ and are saved.
The chip row now holds tags (All plus each tag), because tags change what is
shown, and the sort is a set-and-forget choice. The shortcuts become
Favourites, Downloads, History and Episodes; four whole labels fit on a
phone, five didn't. Statistics and Settings move into ⋯, as on Home, so no
Settings shortcut. Unsubscribing asks Archive or Delete. An archived
podcast keeps its episodes, progress and downloads, isn't refreshed, and
stays out of the Library and the Inbox; its page offers Subscribe again or
Delete. *(Shipped in v0.13.0.)*

## D-020 — Downloads: own screen, a stored log, mobile data

**Context.** Downloads were one of the shared Library lists. AntennaPod's
Downloads screen shows running downloads, a log of finished and failed ones,
and "Delete played". The log only lived in memory, so it was empty after a
restart. The plan asked what to do if startup download upkeep fought the
screenshot harness's seeded downloads.

**Decision.** Downloads get their own screen (old `/list/downloads` links
redirect). The log is a SQLite table (migration 6) holding the newest 200
entries, with no foreign key, so an entry outlives its episode. "Delete
played" keeps favourites. A manual download on mobile data with "Download on
Wi-Fi only" on asks first; automatic downloads keep waiting for Wi-Fi.
Startup download upkeep (reconcile, resume, clean up) is skipped on web: the
web build has no files, so it would only wipe the harness's seeded
downloads. *(Shipped in v0.14.0.)*

## D-021 — Settings: sub-pages, swipes per list, smart mark as played

**Context.** Phase 14 adds about a dozen preferences to a Settings page that
already ran to some forty rows. The plan said to stop and ask if the page grew
past a usable length, with sub-pages as the fallback. It also asked for swipe
actions per list, AntennaPod's "Smart mark as played" and "Keep skipped
episodes", an episode cleanup choice, mobile-data rules, and "download only
when charging".

**Decision.**
- Settings opens on a list of areas, as AntennaPod's does: User interface,
  Playback, Downloads, Import and export, About. Each is its own page inside
  the Settings modal. Settings stays reachable from the Library's ⋯ menu.
- Swipes are a right/left pair per list (Inbox, which Home's inbox section
  shares; Queue; Episodes; Downloads), stored as `'right|left'` settings and
  limited to the actions that make sense on that list. They run through
  `runEpisodeAction`, so they get the same Undo or confirmation as the menu.
  Inbox and Queue keep their old defaults. Episodes and Downloads gain swipes:
  queue / played and queue / delete.
- Smart mark as played defaults to AntennaPod's 30 s (was a fixed 20 s).
  Skipping an episode with "Keep skipped episodes" off marks it played and
  removes it from the queue, as AntennaPod does.
- Episode cleanup offers "when not in queue" (the old rule, still the
  default), 12 h, 1, 3 or 7 days after played, and never. "Delete when
  finished" stays a separate switch.
- Mobile data: downloads (the existing Wi-Fi-only switch, shown the other
  way round), automatic refresh, and streaming, which asks first when off.
  Refresh and streaming default to allowed, so nothing changes until the
  listener turns them off.
- "Download only when charging" is left out: reading the charging state
  needs `expo-battery`, a new native module, so it belongs with Phase 17.

*(Shipped in v0.15.0.)*

## D-022 — Statistics: three tabs, svg charts, a reset that keeps history

**Context.** Phase 15 asks for AntennaPod's Statistics: Subscriptions,
Years and Downloads tabs, a date filter with "include marked played",
Reset statistics, and a per-podcast view with a release schedule guess. The
plan said to stop and ask before adding a charting library.

**Decision.**
- No charting library. The donut and bar charts are a few `react-native-svg`
  paths (already installed); the geometry and every total come from pure
  helpers in `src/stats/` with tests. SQL returns per-podcast-per-month rows.
- Slices use the accent at falling strengths, with "other" in the faint text
  colour, so the charts stay in Sage Pod's palette. Six slices at most.
- The date filter is a short list of ranges (all time, last 30 days, last 12
  months, this year, last year) rather than AntennaPod's month pickers. It
  and "include marked played" are saved as settings.
- "Include marked played" adds the part of each played episode that was not
  heard in the app, dated by when the episode was last played (`played_at`;
  there is no separate "marked" time, and AntennaPod also uses the last
  played time).
- Reset statistics deletes nothing. It saves the time and the newest history
  row, and statistics count only later rows and plays; a listen that carries
  on past the reset starts a new row. History stays for Home's "Check your
  classics" and the info page's lifetime "Listened".
- Days, months and years are the device's local ones (history used to be
  stored by UTC day; older rows keep their UTC dates).
- The release guess treats episodes within 12 hours of each other as one
  release, so two-part episodes and whole seasons dropped at once don't read
  as a daily show.
- Tabs use a new solid `SegmentedTabs`, not `GlassSegmentedControl`: off
  iOS 26 the glass thumb drops the accent fill and the selected label loses
  its contrast.
- The release schedule (daily, weekdays, set days, weekly, fortnightly,
  monthly, or none) is guessed from the latest 20 releases and shown
  on the podcast's statistics and info pages.

*(Shipped in v0.16.0.)*

## D-023 — Backup: save to a picked folder, restore through SQLite's backup API

**Context.** Phase 16 asks for AntennaPod's Import/Export: OPML, HTML and
favourites exports, and database export and import. The plan said to stop
and ask before adding `expo-sharing` (a native module, so a new build) and
before any import that overwrites the live database.

**Decision.**
- No `expo-sharing`. Every export asks for a folder with the system picker
  (`Directory.pickDirectoryAsync`, already in expo-file-system) and writes
  the file there, which is also how AntennaPod saves its exports. Downloads,
  a cloud drive or a USB stick all work. Copy OPML stays for the clipboard.
- Files are named like AntennaPod's, dated by the local day:
  `sagepod-feeds-2026-10-09.opml`, `sagepod-feeds-….html`,
  `sagepod-favourites-….html`, `sagepod-backup-….db`.
- Database export uses SQLite's backup API into a scratch database, switched
  out of WAL mode so one file carries everything; a raw file copy could miss
  writes still in the WAL.
- Database import is allowed to replace the live data, with safeguards: the
  picked file is staged beside the app's database and checked first (a Sage
  Pod database, `quick_check` ok, not from a newer schema), then migrated on
  that scratch copy and checked to have every table and column the app's own
  database has. The warning says how many podcasts and episodes it holds and
  what it replaces, and suggests exporting first. A restore waits until no
  feed refresh or download is running, since their writes would land in the
  restored data. On confirmation the player saves and lets go of its
  episode, the backup API copies the file over in one step (nothing changes
  if it fails), and the app restarts with `reloadAppAsync` (in the installed
  `expo` package).
- No hidden "before restore" copy: there would be no way to use it. The
  warning points to Export database instead.
- Audio files are not in the backup. On the same phone the restored episodes
  find their files; elsewhere the startup reconciliation marks them not
  downloaded.
- An AntennaPod database can't be imported (different tables); the message
  points to OPML.
- OPML import progress already existed (the checklist screen, Phase 11).

*(Shipped in v0.17.0.)*

## D-024 — Phase 17a: Expo's own native modules, no patched code

**Context.** Phase 17 is everything that needs native code. Most of it is
covered by Expo's own modules; the expo-audio gaps (lock-screen skip
amounts, a next button, skip silence, volume boost, headset unplug) need
expo-audio itself changed. The phase is split: 17a uses only Expo modules
and ships now; 17b is the expo-audio work, decided separately.

**Decision.**
- **Modules added:** expo-notifications, expo-background-task (with
  expo-task-manager), expo-sharing, expo-secure-store, expo-battery. All
  from Expo SDK 57, all config-plugin only: no hand-written native code.
- **Notifications** are local (no push server). New episodes notify per
  podcast (Podcast settings › Episode notifications, off by default, schema
  7 adds `feeds.notify`), as AntennaPod does. Refresh and download errors
  have their own switches in Settings › Notifications, on by default; only
  automatic refreshes notify. Three Android channels (new episodes, download
  errors, refresh errors) so each can be tuned in the system settings.
  Permission is asked only when the listener turns one of these on, never
  at startup. A tap opens the podcast, Downloads or Library.
- **Background refresh** runs at the refresh interval (at least 15 minutes,
  the system's floor; the system picks the exact time). It refreshes, which
  notifies and auto-downloads as an in-app refresh does, then writes the
  automatic backup if one is due. Re-registered only when the interval
  changes, since registering resets the system's schedule.
- **Automatic backup** (Import and export › Automatic backup), as
  AntennaPod's: the database every 3 days, the newest 5 kept. Android writes
  to a folder the listener picks (the system keeps the permission). iOS
  forgets a picked folder when the app restarts, so there backups go to
  Sage Pod's own Backups folder, made visible in the Files app
  (`UIFileSharingEnabled`, `LSSupportsOpeningDocumentsInPlace`). Pruning
  touches only files named `sagepod-backup-YYYY-MM-DD[ (n)].db`. Opening the
  app also writes one that is due, since the system may rarely wake the task.
- **Feed username and password** (Podcast settings › Authentication, and a
  login prompt when adding a feed answers 401 or 403) live in secure storage
  keyed by podcast, with the host they were given for. They are sent to the
  feed, its streams and its downloads only on that host: a CDN never gets
  them, and a restored database whose ids now name other podcasts can't send
  them anywhere new. A `user:pass@` in a stored feed address is moved out on
  the next refresh. UTF-8 Basic auth.
- **Podcast links**: `itpc`, `pcast`, `feed` and `podcast` URL schemes (and
  `feed:https://…`) open Add podcast with the address, which loads at once.
  Expo Router's `+native-intent` does the rewrite. Shared text (Android's
  SEND intent) would need native code: not done.
- **Sharing**: a downloaded episode's audio file (episode ⋯ › Share audio
  file). Exports keep saving to a picked folder (D-023).
- **Only while charging** (Settings › Downloads): automatic downloads wait
  while the phone is unplugged; an unknown battery state never holds them.

*(Ships as v0.18.0. Needs a device build to try; nothing here runs on web.)*

## D-025 — Phase 17b: patch expo-audio, build it from source

**Context.** D-004 kept expo-audio and planned a local module for the gaps.
The gaps (the listener's skip amounts and a next button on the lock screen,
skip silence, volume boost, pause on headset unplug) all sit inside
expo-audio's own player and media session (`AudioControlsService.kt`,
`AudioPlayer.kt`, `MediaController.swift`), which a separate module can't
reach. Expo 57 also ships expo-audio's Android side prebuilt, so a patch to
its sources does nothing unless it is compiled.

**Decision (lead developer).**
- **patch-package** on an exactly pinned `expo-audio@57.0.5`
  (`patches/expo-audio+57.0.5.patch`, applied by `postinstall`), and
  `expo.autolinking.buildFromSource: ["expo-audio"]` in `package.json` so
  Android compiles the patched sources. iOS compiles from source already.
- **What the patch adds:**
  - Lock-screen options `seekForwardSeconds`, `seekBackwardSeconds`,
    `showNext`. Android: the session's seek commands and the 5/10/15/30 s
    icons follow them, and a Next button sits in the notification's
    overflow slot (expanded view on Android 12 and older). iOS:
    `preferredIntervals` and the next-track command. Next emits a
    `remoteNext` event; JS plays the next queued episode.
  - Android only: `setSkipSilence` (ExoPlayer's `skipSilenceEnabled`),
    `setVolumeBoost(millibels)` (a `LoudnessEnhancer` on the player's audio
    session), and `setHandleAudioBecomingNoisy(true)` (pause on unplug).
  - iOS fix: remote-command targets were added on every load and never
    removed (`removeTarget(self)` matches nothing for closure targets); now
    every target is cleared before adding.
- **Skip silence and volume boost are Android only**, as the switches show:
  AVPlayer has no equivalent without an audio-tap rewrite. iOS keeps the
  three reductions. iOS pauses on unplug through AVPlayer's own route-change
  handling *[UNVERIFIED on device]*.
- **Volume adaptation** follows AntennaPod: Off, light/heavy reduction
  (0.5, 0.2), light/medium/heavy boost (1.5, 2, 2.5). A boost keeps the
  player volume at 1 and adds 1000 × (factor − 1) mB of gain
  *[UNVERIFIED against AntennaPod's exact gains]*.
- **Skip silence** is a global setting, in the speed sheet (as AntennaPod)
  and Settings › Playback. Changing it, or the skip amounts, re-applies to
  the loaded episode at once.
- **`src/player/audioExtras.ts`** is the only place that calls the patched
  functions, and each call checks the function exists, so web and an
  unpatched build degrade to plain expo-audio.

**Not done.** Hardware headset next/previous buttons (Media3 maps them to
seek, not to the queue); notification speed and sleep buttons.

**Consequences.** Every expo-audio upgrade must re-apply the patch (bump
the pin, regenerate the patch, compile Android locally, check iOS in the
EAS build). Android compiles locally (see HANDOVER); the Swift half is
checked only by the EAS build.

**Revisit** when an Expo SDK upgrade breaks the patch, or if expo-audio
gains custom lock-screen commands upstream.

*(Ships as v0.19.0. Needs a device build to try.)*

## D-026 — Phase 18a: home-screen widget and Quick Settings tile

**Context.** AntennaPod has a player widget and a Quick Settings tile, both
Android. Expo's own `expo-widgets` is iOS only, and its buttons change the
widget's own data rather than calling into the app, so they can't play or
pause. The tile needs a native `TileService`.

**Decision (lead developer).**
- **Widget: `react-native-android-widget`** (0.22.1, pinned; config
  plugin). The widget is drawn from React components in
  `src/widget/NowPlayingWidget.tsx` using Sage Pod's palettes (light and
  dark follow the system). Its buttons run a JavaScript task handler in the
  app's own runtime (`src/widget/index.ts`, registered from the `index.ts`
  entry file, as the background task now is: routes load only when the app
  renders, which a headless start never does), so
  skip back, play/pause and skip forward drive the same `player` as the
  screens. If the app isn't running, Android starts its runtime without a
  screen, the player restores the last episode, then acts. `player.init()`
  is now once per runtime so the screens don't restore it twice.
- **Redraws** happen only on a visible change (`widgetKey`): episode, play
  state, artwork, or the minutes left, so about once a minute while
  playing. Artwork must be http(s) for the launcher to fetch it; otherwise
  the app icon.
- **Tile: a local config plugin** (`plugins/playback-tile`) adds a Kotlin
  `TileService` that connects a Media3 `MediaController` to expo-audio's
  `AudioControlsService` session and plays or pauses, as the lock screen
  does; the player already follows those changes. With no session (nothing
  loaded since the app started) a tap opens the app. Adds
  `androidx.media3:media3-session` to the app module at expo-audio's
  version. expo-audio's `onBind` always returned its private binder, so no
  MediaController could connect; the patch (D-025) now returns Media3's
  session binder when the bind asks for it.
  The player's own `AudioPlaybackServiceConnection` must use a separate
  `ACTION_BIND_PLAYBACK_SERVICE` action: upstream uses the same
  `MediaSessionService.SERVICE_INTERFACE` action as MediaControllers but
  expects an `AudioPlaybackServiceBinder`. Sharing the action routes the
  player to Media3's binder, so it fails with "invalid binder type" and
  never attaches the notification controls. The patch gives the internal
  connection its own action while preserving Media3's standard action for
  controllers. This correction needs a new native build, not an OTA update;
  notification and tile behaviour together remain **[UNVERIFIED on device]**.
  Media notifications reuse the icon configured by `expo-notifications`
  (`expo.modules.notifications.default_notification_icon`) for both the
  foreground-service placeholder and the player notification. This gives
  the small artwork badge Sage Pod's existing monochrome owl instead of
  Media3's generic play icon. If no notification icon is configured, it
  falls back to the application icon. Requires a new native build;
  the badge's final rendering is **[UNVERIFIED on device]**.
  Numbered skip and Next buttons use rounded Material vector artwork with
  a 48dp intrinsic size and a 24-unit viewport. The larger intrinsic size
  gives system UIs that rasterize custom actions more pixels to work with;
  the final button size remains controlled by Android. The patch supplies
  these resources through `setCustomIconResId` and the older notification
  action path, retaining Media3's semantic icon codes and all skip amounts
  (5/10/15/30, with generic arrows for other values). Play/pause remains a
  standard system action. The resource build is verified; the result on
  Redmi Pad SE / Android 15 is **[UNVERIFIED on device]**. The derived Google
  Material artwork's Apache-2.0 license is bundled with the patched module.
- **No iOS widget for now**: expo-widgets could show what's playing, but
  not control it, and an app extension adds signing work to the one device
  build. iOS has Now Playing on the lock screen and in Control Center.

**Consequences.** Both run only in a device build. The tile's Kotlin is
compiled locally (see HANDOVER); the widget's look is checked on the
device, since web screenshots can't render it.

**Revisit** if expo-widgets gains app intents (then an iOS widget), or if
the widget library falls behind an Expo SDK.

*(Ships as v0.20.0.)*

## D-027 — Phase 18b: chapters from the audio file, read in TypeScript over byte ranges

**Context.** Many podcasts put chapters only in the audio: ID3v2 `CHAP`
frames in MP3s, and QuickTime chapter tracks or Nero `chpl` lists in
M4A / MP4. AntennaPod reads them when the feed names no chapters file.
Sage Pod showed chapters only from a Podcasting 2.0 JSON file. expo-audio
exposes no metadata, and a streamed episode isn't on disk.

**Decision (lead developer).**
- **Pure TypeScript readers** in `src/player/embedded/` (ID3v2.3/2.4
  `CHAP` with title, link and picture; MP4 `tref/chap` text track first,
  then Nero `chpl`). They read through a `ByteSource`, so they're tested in
  Node with built files and work the same on a download or a stream. No
  native code and no new dependency.
- **Byte ranges, not whole files**: a download is read with
  expo-file-system's `FileHandle`; a stream with HTTP `Range` requests in
  64 KB blocks (`blockSource`). Only the ID3 frame headers and `CHAP`
  frames, or the box headers on the way to `moov` and `moov` itself, are
  read. A large cover image at the front of the tag is skipped unread. A
  server that ignores ranges gets its response aborted and the episode
  has no chapters. A real 165 MB episode took 2 requests and 128 KB.
- **The feed's chapters file wins** when there is one, as in AntennaPod.
  Embedded chapters load when the player opens and are kept for the
  session (`useChapters`); nothing is stored in the database.
- Chapter pictures become `data:` URIs (up to 512 KB each); links must be
  http(s).

**Consequences.** Episodes from many hosts now show chapters with no feed
change. Ogg / Opus chapters (Vorbis comments) and ID3v2.2 aren't read.
Opening the player on a streamed episode without a chapters file costs one
or two small range requests, once per session.

**Revisit** if expo-audio exposes the player's own metadata (then read
chapters from it), or if chapters are needed outside the player (then
store them per episode).

*(Ships as v0.21.0.)*


## D-028 — Over-the-air updates with EAS Update

**Context.** Every change needed a new APK installed by hand. Most merges
change only JavaScript.

**Decision (lead developer, owner approved).**
- **expo-updates**, with `runtimeVersion: { policy: "fingerprint" }`. An
  update reaches only builds whose native project matches it, so a merge
  that adds a native module can't break an installed build. That merge
  needs a new build instead.
- **The release's version stamps are left out of the fingerprint**
  (`fingerprint.config.js`, `SourceSkips.ExpoConfigVersions`). Without it,
  every release would change the runtime and no update would ever apply.
  Checked: `tool/set_app_version.sh 0.99.0` leaves the hash unchanged.
- **One channel per build profile** in `eas.json`. The EAS workflow
  `.eas/workflows/publish-update.yml` publishes an Android update to
  `preview` on every push to `main`. The release commit triggers a second
  update with the same code, which is harmless.
- Installed builds check for an update at launch and apply it on the next
  launch (the expo-updates default).

**Consequences.** After one preview build with expo-updates installed,
JavaScript-only merges arrive by restarting the app twice. Native changes
still need a build.

**Revisit** for iOS (add the platform to the workflow) or a store release
(publish to `production` from release tags).

## D-029 — Phase 19: background downloads in WorkManager, from a local module

**Context.** Downloads crawled or stopped unless Sage Pod was on screen.
On Android, expo-file-system's download task is a plain OkHttp call in the
app process; its `sessionType: 'background'` applies only to iOS. Nothing
kept the process alive or Wi-Fi awake, the queue lived in JavaScript, and
every retry or relaunch started the file from zero. AntennaPod runs each
episode as a WorkManager job in a foreground service with a Wi-Fi lock,
network constraints and `Range` resume.

**Decision (lead developer, owner approved).**
- **A local Expo module, `modules/episode-downloads`** (Android only),
  with a Kotlin `EpisodeDownloadWorker` modelled on AntennaPod's:
  - one unique job per episode; a tap replaces an automatic job still
    waiting, and never one already running
  - a tap is expedited and needs only a connection; an automatic download
    waits for an unmetered network when "Wi-Fi only" is on, and for power
    when "Only while charging" is on (this replaces the JavaScript held list)
  - it runs in WorkManager's foreground service (type `dataSync`) under one
    shared "Downloading episodes" notification that opens Downloads, and
    holds a Wi-Fi lock
  - it writes `<file>.part` and resumes it with `Range` / `If-Range` (a
    strong ETag, else Last-Modified); a 416 or a mismatched range starts over
  - it makes 3 runs at most, with a 10 s exponential backoff; 401 / 403 /
    404 / 410 and a captive-portal HTML page fail at once
  - redirects are followed by hand; a feed's password goes only to the
    feed's own host
- **The worker never writes SQLite.** JavaScript applies job states through
  the repositories: live while the app's JavaScript runs, and at startup
  and in the background refresh for anything that finished meanwhile
  (`reconcileDownloadWork`, rules in `src/player/downloadWork.ts`), then
  prunes finished jobs. A pending row with no job is restarted, so an
  upgrade from the JavaScript queue resumes its downloads.
- WorkManager was already linked through expo-background-task (same
  version, 2.9.1). It adds no third-party dependency. It does add the
  `FOREGROUND_SERVICE_DATA_SYNC` permission.
- **Expo Go, iOS and web keep the JavaScript queue.** iOS already uses a
  background URLSession; a download interrupted by a relaunch restarts.
- Successful downloads log their size, time and speed (and on the JavaScript
  path, the share spent in the background), shown as "Transfer" in the log.

**Rejected.**
- Android's system `DownloadManager`: it survives process death and
  resumes, but gives no captive-portal check or retry policy, and it shows
  its own notification and file naming.
- Patching expo-file-system: the queue, constraints and notification
  aren't its job, and the patch would be large.

**Consequences.** Downloads continue with the screen off, in other apps and
after the app is swiped away, and survive a reboot. Changing "Wi-Fi only"
or "Only while charging" applies to downloads queued afterwards, not to
jobs already waiting. Feed passwords sit in WorkManager's private database
while a job waits. Android 15 caps `dataSync` foreground time at 6 hours a
day.

**Revisit** for iOS (reattach to URLSession tasks after a relaunch), or if
expo-file-system gains real background downloads on Android.

## D-030 — Phase 20: Echo, the year in review (proposed)

**Context.** AntennaPod shows "Echo" from 10 December: seven story cards
about the listener's year (hours played, queue outlook, how soon episodes
are played after release, how many subscriptions get played, the first
year with the app, and the top 5 podcasts with a shareable image). Sage
Pod already stores everything Echo needs. It is the last optional parity
item with no native code.

**Proposal.**
- Build Echo in TypeScript on data already stored: no migration, no new
  dependency, no native code. It ships over the air (D-028) to the
  installed 0.23.2 build.
- Match AntennaPod's window, threshold and wording: 10–31 December, at
  least 10 hours of listening, and a card that can be hidden for the year.
  The year is the current one, not a constant changed by hand each release.
- Sharing is text through React Native's `Share` API. A shared image needs
  `react-native-view-shot`, a native module, so it is left to its own
  proposal.
- Animated backgrounds use `react-native-svg` and Reanimated, coloured from
  theme tokens and still when the system reduce-motion setting is on.

**Consequences.**
- A pure `src/echo/` module and one repository function, `getEchoYear`.
- A new full-screen route, `/echo`, which also opens outside the window.
- If over-the-air updates still don't arrive, the phase waits for the next
  build.

**Revisit** if the owner wants the shared PNG, or a recap for other periods.

