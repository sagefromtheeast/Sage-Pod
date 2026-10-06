# Decisions

Settled decisions for Sage Pod. Don't re-litigate these without new
information; if you change one, add a new entry that supersedes it.
Format: context → decision → consequences → when to revisit.

| ID | Decision | Status |
|---|---|---|
| D-001 | Goal: AntennaPod feature parity, keeping Sage Pod's design | Accepted |
| D-002 | One phase = one PR = one release | Accepted |
| D-003 | Approved behaviour changes to match AntennaPod | Accepted |
| D-004 | Audio engine: stay on expo-audio | Accepted |
| D-005 | Schema migrations: one per phase that needs it | Accepted |
| D-006 | Screenshots: web export + Playwright harness | Accepted |
| D-007 | Discovery providers: keyless only (iTunes, then fyyd) | Accepted |
| D-008 | Surprise Me: seeded order, round-robin per podcast | Accepted |
| D-009 | Tablet layout: window classes at 600 / 840 dp | Accepted |
| D-010 | Row button streams by default ("Prefer streaming" on) | Accepted |
| D-011 | Device builds: one EAS build at the end of the parity work | Accepted |

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
   left = remove from inbox, with undo.
3. **The permanent speed-chip row on Now Playing moves into a speed sheet**
   opened from the speed button (slider + presets, saved).
4. **A Discover tap opens a preview** (feed page in preview state with a
   Subscribe button) instead of subscribing immediately.
5. **The episode page's separate Links list is dropped** in favour of inline,
   long-pressable links in the show notes.
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

