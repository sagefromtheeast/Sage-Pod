# Liquid Glass in iOS 26 & Its React Native / Expo Equivalent: A Photos‑Style Morphing Tab Bar for a Podcast App

## TL;DR
- **The native pattern is real and native:** the reel replicates Apple's iOS 26 `TabView` + `Tab(role: .search)` (which auto‑morphs the tab bar into a search field) combined with a custom `GlassEffectContainer` + `glassEffect()` + `glassEffectID(_:in:)` + `@Namespace` "liquid merge" — exactly what Kavsoft teaches in his free tutorial "Liquid Glass Morphing Tab bar | Expandable Tab Bar | SwiftUI | Xcode 26" (youtu.be/Nj285uRnrPQ), described as "how to create a custom Liquid Glass tab bar which smoothly morphs into a custom view using SwiftUI," with full source on Patreon.
- **The best React Native/Expo path today (Sept 2026) is a hybrid:** use `expo-router` NativeTabs `role="search"` for the free native search morph where you can, but for the *custom* morphing pill + scrubbable segmented control you'll build it yourself on `expo-glass-effect` (`GlassView`/`GlassContainer` with `spacing`) + `react-native-reanimated` + `react-native-gesture-handler` + `expo-haptics`. The closest ready‑made reference is **`davidmokos/expo-glass-tabs`** (v0.1.1, MIT, ~244 GitHub stars / 9 forks), which already implements finger‑scrubbing with haptics and a sliding highlight in pure TypeScript that runs in Expo Go.
- **You cannot get a 1:1 `glassEffectID` merge in RN** — `expo-glass-effect` has no glassEffectID equivalent; you approximate the merge with `GlassContainer` `spacing` (per Expo's docs, the "distance at which glass elements start merging effects," so they "visually merge into one connected glass surface on iOS 26+") plus Reanimated width/position shared values, and you must ship a `BlurView`‑based fallback for Android and iOS < 26.

## Key Findings

1. **The video shows two Apple mechanisms layered together.** (a) The tab‑bar→search morph is a *first‑party* behavior: any `Tab` given `role: .search` in an iOS 26 `TabView` visually separates and, per Nil Coalescing's "SwiftUI Search Enhancements in iOS and iPadOS 26," "the search tab appears visually separated from the others and transforms into a search field when selected." (b) The floating "Years/Months/All" segmented control, the draggable glass "handle," and the merge/split of the Library/Collections pills are *custom* Liquid Glass built with `GlassEffectContainer` + `glassEffectID` — the same API Apple used for the Landmarks badge expansion in WWDC25 Session 323 ("Build a SwiftUI app with the new design"), where the presenter states: "To add glass to your custom views, use the glassEffect modifier."

2. **`glassEffectID` is the exact "droplet merge/split" primitive.** Views inside a shared `GlassEffectContainer` that carry `.glassEffectID(id, in: namespace)` and are shown/hidden inside `withAnimation {}` fluidly morph into one another. The container's `spacing:` parameter sets the distance at which shapes fuse. [GitHub](https://github.com/conorluddy/LiquidGlassReference) There is no public RN equivalent of `glassEffectID`.

3. **Kavsoft (@_kavsoft) has published this exact pattern.** His video "Liquid Glass Morphing Tab bar | Expandable Tab Bar | SwiftUI | Xcode 26" (youtu.be/Nj285uRnrPQ) and "Custom Glass Segmented Control Using SwiftUI" (resembling the iOS 26 Camera app picker) [Patreon](https://www.patreon.com/kavsoft/posts/custom-glass-ios-158889531) are the direct sources for the reel; full source code is on Patreon ($3/mo). Community re‑implementations exist (KaiChi888/AnimatedGlassTabs, ryanashcraft/FabBar — both credit Kavsoft's "segmented control as a tab bar" idea).

4. **`expo-glass-effect` is the RN building block.** Current version 57.x (SDK 54–57). It exposes `GlassView` (`glassEffectStyle` `'regular' | 'clear' | 'none'`, `isInteractive`, `tintColor`), `GlassContainer` (`spacing` merges nearby glass views), [gluestack](https://v5.gluestack.io/ui/docs/components/liquid-glass) and `isLiquidGlassAvailable()` / `isGlassEffectAPIAvailable()`. It is iOS/tvOS‑only and degrades to a plain View elsewhere.

5. **`davidmokos/expo-glass-tabs` is the closest ready‑made scrubber.** Its package.json self‑describes it as "Floating liquid‑glass tab bar for Expo Router — minimize‑on‑scroll, sliding highlight, finger scrubbing with haptics, and progressive edge blur." Pure TypeScript, MIT, works in Expo Go and any dev build; the README documents a "🛝 Sliding highlight — the active‑tab pill physically travels between tabs on an interruptible, transform‑only spring" and "⚡ UI‑thread everything — all animation runs in Reanimated worklets with native gesture recognizers; a blocked JS thread doesn't drop a frame."

## Details

### A) The native SwiftUI Liquid Glass pattern

**A.1 — The free half: the search‑tab morph.** In iOS 26 you do not build the tab‑bar→search‑field transition yourself. You declare a search tab and the system morphs it:

```swift
TabView {
    Tab("Library", systemImage: "photo.stack") { LibraryView() }
    Tab("Collections", systemImage: "folder") { CollectionsView() }
    Tab(role: .search) {
        NavigationStack {
            SearchView().navigationTitle("Search")
        }
        .searchable(text: $searchText)
    }
}
.tabBarMinimizeBehavior(.onScrollDown)
```

With the `.search` role, per Nil Coalescing, "the search tab appears visually separated from the others and transforms into a search field when selected." Related APIs the reel touches: `.tabBarMinimizeBehavior(.onScrollDown)`, `.tabViewBottomAccessory { }` (a floating accessory that lives above the tab bar — the natural home for a Now Playing/mini‑player), [GitHub](https://github.com/conorluddy/LiquidGlassReference) `.searchToolbarBehavior(.minimize)`, [Nil Coalescing](https://nilcoalescing.com/blog/SwiftUISearchEnhancementsIniOSAndiPadOS26/) and `DefaultToolbarItem(kind: .search, placement: .bottomBar)` + `ToolbarSpacer(.flexible)` for bottom‑bar search layouts. [nilcoalescing](https://nilcoalescing.com/blog/SwiftUISearchEnhancementsIniOSAndiPadOS26/)

**A.2 — The custom half: `GlassEffectContainer` + `glassEffectID`.** The three ingredients (per Apple's "Applying Liquid Glass to custom views," SerialCoder.dev, and BleepingSwift):

1. A `@Namespace` to coordinate the animation.
2. A `GlassEffectContainer(spacing:)` grouping the glass elements. Apple's guidance in WWDC25 Session 323 is explicit: "Group multiple glass elements within a GlassEffectContainer because glass cannot sample other glass" — grouping gives single‑pass rendering and correct blending.
3. `.glassEffect()` + `.glassEffectID(_:in:)` on each participating view, toggled inside `withAnimation {}`. [BleepingSwift](https://bleepingswift.com/blog/glass-effect-id-transitions-swiftui)

A minimal morph (SerialCoder pattern), which is structurally what the reel's Library/Collections‑pills → compact‑pill + search‑field transition does:

```swift
@Namespace private var namespace
@State private var isSearching = false

GlassEffectContainer(spacing: 30) {
    HStack(spacing: 30) {
        if !isSearching {
            pill("Library",     "photo.stack").glassEffectID("library", in: namespace)
            pill("Collections", "folder").glassEffectID("collections", in: namespace)
        } else {
            compactPill.glassEffectID("library", in: namespace)   // reuse same id → morph
            searchField.glassEffectID("collections", in: namespace)
        }
    }
}
// toggle: withAnimation(.bouncy) { isSearching.toggle() }
```

Because the appearing/disappearing views reuse the **same `glassEffectID` string** inside the same namespace, SwiftUI treats them as one glass body that liquid‑morphs (droplets joining/splitting) rather than crossfading. `.glassEffectUnion(id:namespace:)` is the sibling API to permanently fuse several elements into one shape; `.glassEffectTransition(.matchedGeometry)` customizes the transition.

**A.3 — The scrubbable segmented control.** Apple's own `Picker(.segmented)` gets the glass look for free on iOS 26, but the *draggable handle that snaps and morphs between segments* is custom — this is precisely Kavsoft's "Custom Glass Segmented Control" (modeled on the Camera app). [Patreon](https://www.patreon.com/kavsoft/posts/custom-glass-ios-158889531) The recipe: a `GlassEffectContainer` holding the "Years/Months/All" labels plus a single glass "thumb" view carrying a `glassEffectID`; a `DragGesture` updates the thumb's offset; on `.onEnded` you snap to the nearest segment inside `withAnimation`. Note a documented Apple limitation: developers on the Apple Developer forums report `Glass.clear` still applies an unavoidable blur, so a truly transparent passthrough thumb matching the system tab bar is not currently achievable by third parties. [apple](https://developer.apple.com/forums/thread/795715)

### B) The React Native / Expo equivalent

**B.1 — Library landscape (versions & requirements as of Sept 2026).**

| Library | Version | Install | Expo Go? | iOS/Xcode req | Android / iOS<26 |
|---|---|---|---|---|---|
| `expo-glass-effect` | 57.x (SDK 54+) | `npx expo install expo-glass-effect` | Yes (dev client recommended) | iOS 26 + Xcode 26 for real glass | Falls back to plain View; guard with `isLiquidGlassAvailable()` |
| `expo-router` NativeTabs | SDK 54+ (`unstable-native-tabs`) | built into `expo-router` | Yes | iOS 26 for Liquid Glass; Xcode 26 to compile | Traditional tab bar (iOS<26) / Material 3 (Android) |
| `@callstack/liquid-glass` | current | `npm i @callstack/liquid-glass` | **No** | Xcode ≥ 26, RN ≥ 0.80 | `isLiquidGlassSupported` → style fallback |
| `davidmokos/expo-glass-tabs` | 0.1.1 | `npx expo install expo-glass-tabs …` | Yes | iOS 26 for glass; else solid fallback | `solidFallback` color prop |
| `@ventur8/react-native-liquid-glass-tab-bar` | 1.0.1 | `npm i @ventur8/react-native-liquid-glass-tab-bar` | Yes (uses expo-blur) | none (blur‑based) | expo-blur semi‑transparent fallback |
| `expo-blur` | 57.x | `npx expo install expo-blur` | Yes | none | Android: `experimentalBlurMethod="dimezisBlurView"` for real blur |

`expo-glass-effect` API, verbatim usage:

```tsx
import { GlassView, GlassContainer, isLiquidGlassAvailable } from 'expo-glass-effect';

<GlassContainer spacing={10}>
  <GlassView style={styles.pill} glassEffectStyle="regular" isInteractive tintColor="#ffffff" />
  <GlassView style={styles.searchField} />
</GlassContainer>
```

Per Expo's official docs, `spacing` is the "distance (number) at which glass elements start merging effects," and "when glass views are close enough (controlled by `spacing`), they visually merge into one connected glass surface on iOS 26+ with liquid glass enabled" — this is your only lever for the merge effect.

`@callstack/liquid-glass`, verbatim:

```tsx
import { LiquidGlassView, LiquidGlassContainerView, isLiquidGlassSupported } from '@callstack/liquid-glass';

<LiquidGlassContainerView spacing={20}>
  <LiquidGlassView style={[{ width: 100, height: 100, borderRadius: 50 },
    !isLiquidGlassSupported && { backgroundColor: 'rgba(255,255,255,0.5)' }]} interactive effect="clear" />
  <LiquidGlassView style={{ width: 100, height: 100, borderRadius: 50 }} />
</LiquidGlassContainerView>
```

**B.2 — `expo-glass-tabs` internals (the scrubber reference).** Per its README and verified `package.json`: the bar structure is declared in JS (Expo Router headless tabs — `Tabs`/`TabList`/`TabSlot`/`TabTrigger` from `expo-router/ui`), but motion runs entirely in Reanimated worklets with native gesture recognizers. [github](https://github.com/davidmokos/expo-glass-tabs) A `Pan` (scrub) **races** a `Tap` so taps stay forgiving while drags feel attached to the finger; "navigation happens on release — screens never jump mid‑drag"; [GitHub](https://github.com/davidmokos/expo-glass-tabs/blob/main/README.md) the sliding highlight and scrub are "transform‑only (GPU‑composited, no layout work per frame)"; [GitHub](https://github.com/davidmokos/expo-glass-tabs) haptic ticks fire at each boundary [GitHub](https://github.com/davidmokos/expo-glass-tabs/blob/main/README.md) (iOS `UIFeedbackGenerator`, `haptics` prop defaults true). [GitHub](https://github.com/davidmokos/expo-glass-tabs) Verified dev‑pinned stack (from package.json): `react-native-reanimated` 4.5.0, `react-native-gesture-handler` ~2.32.0, `expo-glass-effect` ~57.0.1, `expo-haptics` ~57.0.1, `expo-symbols` ~57.0.1, `expo` ~57.0.7, `react-native` 0.86.0; all peer deps are declared `"*"`. [github](https://github.com/davidmokos/expo-glass-tabs/blob/main/package.json) Exported surface: `GlassTabBar`, `GlassTabButton`, `TabBarMinimizeProvider`, `useMinimizeOnScroll()`, `useTabBarMinimized()`, `renderFadingTabScreen`, `ProgressiveBlur`, `MINIMIZE_SPRING`. [github](https://github.com/davidmokos/expo-glass-tabs) [github](https://github.com/davidmokos/expo-glass-tabs/blob/main/README.md) Install:

```
npx expo install expo-glass-tabs expo-blur expo-glass-effect expo-haptics expo-symbols \
  react-native-gesture-handler react-native-reanimated react-native-safe-area-context react-native-screens
```

Wrap the app root in `GestureHandlerRootView` (Expo Router does not do it for you). [github](https://github.com/davidmokos/expo-glass-tabs/blob/main/README.md)

**B.3 — (1) Faking the tab‑bar→search‑bar glass morph.** Since there's no `glassEffectID`, compose the merge from two mechanisms working together:

- **Glass fusion:** keep the compact pill and the expanding search field as siblings inside one `GlassContainer` with a generous `spacing` (e.g. 20–40) so that while they're close the native engine renders them as one connected glass surface [gluestack](https://v5.gluestack.io/ui/docs/components/liquid-glass) (the "distance at which glass elements start merging effects" behavior).
- **Layout morph:** drive the pill's `width` and the search field's `width`/`opacity` with Reanimated shared values in a single `withTiming`/`withSpring` so the pill shrinks left while the field grows right, emulating the droplet split. Animate a wrapper's transform/width — **never** animate `opacity` to 0 on a `GlassView` or its parent (documented bug #41024: the glass silently stops rendering; use the built‑in `glassEffectStyle` `animate`/`animationDuration` or a `key` remount instead).

Sketch:

```tsx
const t = useSharedValue(0); // 0 = tabs, 1 = search
const pill  = useAnimatedStyle(() => ({ width: interpolate(t.value, [0,1], [220, 64]) }));
const field = useAnimatedStyle(() => ({ width: interpolate(t.value, [0,1], [0, 300]),
                                        opacity: interpolate(t.value, [0,1], [0, 1]) }));
// open: t.value = withSpring(1, { damping: 18, stiffness: 180 });
<GlassContainer spacing={28}>
  <Animated.View style={pill}><GlassView style={StyleSheet.absoluteFill} isInteractive/>{/* icons */}</Animated.View>
  <Animated.View style={field}><GlassView style={StyleSheet.absoluteFill}/>{/* TextInput */}</Animated.View>
</GlassContainer>
```

For the *system‑quality* morph specifically on the Search tab, prefer the free native path: `expo-router` NativeTabs with a `role="search"` trigger. [Expo Documentation](https://docs.expo.dev/router/advanced/native-tabs/)

```tsx
import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs';
<NativeTabs>
  <NativeTabs.Trigger name="index"><Icon sf="square.stack" /><Label>Shows</Label></NativeTabs.Trigger>
  <NativeTabs.Trigger name="queue"><Icon sf="list.bullet" /><Label>Queue</Label></NativeTabs.Trigger>
  <NativeTabs.Trigger name="search" role="search"><Icon sf="magnifyingglass"/><Label>Search</Label></NativeTabs.Trigger>
</NativeTabs>
```

(Known issue: a `<Badge/>` inside a `role="search"` trigger is visually cropped — Expo issue #41573.) [GitHub](https://github.com/expo/expo/issues/41573)

**B.4 — (2) The scrubbable "All Episodes / Unplayed / Downloaded" glass segmented control.** Build it directly, mirroring `expo-glass-tabs`' gesture design:

```tsx
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, runOnJS } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { GlassContainer, GlassView } from 'expo-glass-effect';

const SEGMENTS = ['All Episodes','Unplayed','Downloaded'];
const SEG_W = 116;
const x = useSharedValue(0);          // thumb translateX
const active = useSharedValue(0);     // current index
const tick = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

const pan = Gesture.Pan()
  .onUpdate(e => {
    x.value = Math.max(0, Math.min(e.x - SEG_W/2, SEG_W*(SEGMENTS.length-1)));
    const idx = Math.round(x.value / SEG_W);
    if (idx !== active.value) { active.value = idx; runOnJS(tick)(); } // haptic per boundary
  })
  .onEnd(() => { x.value = withSpring(active.value * SEG_W, { damping: 20, stiffness: 200 });
                 runOnJS(setFilter)(SEGMENTS[active.value]); });        // commit on release
const tap = Gesture.Tap().onEnd(e => { const i = Math.floor(e.x / SEG_W);
  active.value = i; x.value = withSpring(i*SEG_W); runOnJS(setFilter)(SEGMENTS[i]); });

<GestureDetector gesture={Gesture.Race(pan, tap)}>
  <GlassContainer spacing={16} style={styles.track}>
    <Animated.View style={[styles.thumb, useAnimatedStyle(()=>({transform:[{translateX:x.value}]}))]}>
      <GlassView style={StyleSheet.absoluteFill} isInteractive />
    </Animated.View>
    {SEGMENTS.map(s => <Text key={s} style={styles.seg}>{s}</Text>)}
  </GlassContainer>
</GestureDetector>
```

`Gesture.Race(pan, tap)` reproduces the README's "Pan races Tap"; committing the filter in `onEnd` reproduces "navigation happens on release." For lower‑latency haptics that can fire from the worklet without `runOnJS`, `react-native-nitro-haptics` (Nitro boxing) [GitHub](https://github.com/oblador/react-native-nitro-haptics) or Software Mansion's `react-native-pulsar` presets are worklet‑compatible [Scarb](https://docs.swmansion.com/pulsar/sdk/react-native/) alternatives to `expo-haptics`.

**B.5 — (3) Coexisting with a persistent mini‑player.** Two supported approaches:
- **Native accessory (recommended):** use `NativeTabs.BottomAccessory` (iOS 26+; mirrors SwiftUI's `.tabViewBottomAccessory`). Because Expo renders the accessory twice (once per placement) and state is not shared, **lift mini‑player state to a parent/context**; read `NativeTabs.BottomAccessory.usePlacement()` to switch between `regular` (full mini‑player bar) and `inline` (compact, when the tab bar minimizes). React Navigation's native bottom tabs expose the same via `tabBarBottomAccessory` (iOS 26+ only). [React Navigation](https://reactnavigation.org/docs/native-bottom-tab-navigator/)
- **Custom overlay:** if you're hand‑rolling the glass bar, stack the mini‑player as an absolutely‑positioned `GlassView`/`BlurView` just above the tab bar. Put the mini‑player and the tab pill in the **same `GlassContainer`** so they glass‑merge when adjacent; manage z‑index so the search field expands *over* the mini‑player, and offset content with `useBottomTabBarHeight()` [GitHub](https://github.com/callstack/react-native-bottom-tabs/discussions/366) + `react-native-safe-area-context` insets. Prefer `react-native-screens/experimental` `SafeAreaView` with native tabs so content isn't hidden behind the bar.

**B.6 — (4) Performance / gesture best practices.**
- Keep all scrub math in Reanimated worklets; drive only `transform` (translateX/scale) and, where unavoidable, `width` — transform‑only keeps it GPU‑composited [GitHub](https://github.com/davidmokos/expo-glass-tabs) at 60fps (the explicit design goal of `expo-glass-tabs`).
- Use `react-native-gesture-handler` native recognizers and compose `Gesture.Race`/`Gesture.Exclusive` so taps and drags don't fight; defer navigation/state commits to `onEnd`.
- Each glass/blur layer is a separate GPU compositing pass; group siblings in one `GlassContainer` for single‑pass rendering, and heed Apple's WWDC25 rule directly: "Always avoid glass on glass. Stacking Liquid Glass elements can quickly make the interface feel cluttered" (because "glass cannot sample other glass"). Don't stack more than a handful of simultaneous glass layers.
- Requires the New Architecture / Fabric; Reanimated 4 + RN 0.80+.

**B.7 — (5) Android & iOS < 26 fallback.** `expo-glass-effect` renders a plain View when glass is unavailable, so guard every glass surface:

```tsx
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { BlurView } from 'expo-blur';
import { AccessibilityInfo, Platform } from 'react-native';

// three‑tier guard: GlassView → BlurView → solid
const canGlass = Platform.OS === 'ios' && isGlassEffectAPIAvailable() && isLiquidGlassAvailable();
```

If `canGlass`, render `GlassView`; else render `expo-blur`'s `BlurView` (`intensity={80}` + a hairline border + shadow to fake the rim) — on Android set `experimentalBlurMethod="dimezisBlurView"` for real blur, and always add `overflow:'hidden'` to rounded parents; else (blur too costly / very old) a solid `rgba` card. Also gate on `AccessibilityInfo.isReduceTransparencyEnabled()` [LobeHub](https://lobehub.com/skills/neversight-skills_feed-expo-glass-effect) and subscribe to `reduceTransparencyChanged` — when Reduce Transparency is on, skip glass entirely. `@callstack/liquid-glass` exposes the equivalent `isLiquidGlassSupported` boolean; [ReactScript](https://reactscript.com/ios-liquid-glass-ui/) libraries like `react-native-blur` (v5, New‑Arch‑only, RN 0.80+) bundle a `LiquidGlassView` that auto‑falls back to enhanced blur on older iOS/Android/Web. [GitHub](https://github.com/sbaiahmed1/react-native-blur)

**B.8 — Known bugs to plan around.**
- **#41024:** animating a `GlassView`'s (or ancestor's) opacity makes glass render as a normal view [GitHub](https://github.com/expo/expo/issues/41024) — use `glassEffectStyle` animate props or a `key` remount instead.
- **SDK 55 regression:** several teams report Liquid Glass breaking on first‑frame cards, off/on‑screen scroll, and inside RN `Modal` after the SDK 54→55 upgrade; [Great Work Everyone](https://www.greatworkeveryone.com/writing/liquid-glass-expo-sdk-55-regression) some fixed by Expo in March 2026 (PR #43771 recreates the `UIGlassEffect` on window attach — "Liquid Glass disappears after tab change"), [Great Work Everyone](https://www.greatworkeveryone.com/writing/liquid-glass-expo-sdk-55-regression) others (navigation‑transition flicker #41025) still open. A common workaround is `@expo/ui/swift-ui` `Host` directly for the worst surfaces. [Great Work Everyone](https://www.greatworkeveryone.com/writing/liquid-glass-expo-sdk-55-regression)
- **#40778:** certain per‑corner `borderRadius` styles regressed on the SDK 55 canary. [GitHub](https://github.com/expo/expo/issues/40778)
- **Dark‑mode flash:** transparent NativeTabs can flash white/flash header backgrounds when pushing screens; wrap the layout in `ThemeProvider` with the matching `DarkTheme`. [Expo Documentation](https://docs.expo.dev/router/advanced/native-tabs/)
- Treat `isInteractive` as mount‑time only (remount via `key` to change it); avoid scrollable content inside a `GlassView`. [LobeHub](https://lobehub.com/skills/devanshudesai-agent-skills-expo-liquid-glass)

## Recommendations

**Stage 1 — Ship the native‑backed skeleton first.** Use `expo-router` NativeTabs with three triggers ("Shows", "Queue", "Search") and put Search on `role="search"` to get Apple's free, system‑quality tab‑bar→search morph on iOS 26. Put the mini‑player in `NativeTabs.BottomAccessory` with lifted state and `usePlacement()`. This is production‑safe today and needs no custom gesture code. *Benchmark to move on:* it works but you want the *custom* floating pill + scrubbable filter that NativeTabs can't express.

**Stage 2 — Add the custom scrubbable segmented control.** Build the "All Episodes / Unplayed / Downloaded" glass control from B.4 on `expo-glass-effect` + Reanimated + `Gesture.Race` + `expo-haptics`. Study/borrow from `davidmokos/expo-glass-tabs` (MIT) rather than reinventing the scrub loop. Keep it transform‑only.

**Stage 3 — Only if you need the fully custom floating pill‑to‑search morph** (i.e., you've outgrown NativeTabs), build B.3 with a shared `GlassContainer` + width/opacity shared values, or drop to `@callstack/liquid-glass` (accepting: no Expo Go, Xcode ≥26, RN ≥0.80) for its `LiquidGlassContainerView` merge. Reserve this stage because it's the most bug‑exposed surface.

**Cross‑cutting:** implement the three‑tier `GlassView → BlurView → solid` guard (B.7) from day one; pin Reanimated ≥4 and RN ≥0.80 (New Architecture); test with Reduce Transparency, dark mode, and on a real iOS 26 device (simulator glass differs).

**Thresholds that change the plan:** if you must support Expo Go → avoid `@callstack/liquid-glass`. If you must support Android with heavy blur and see <60fps → drop to solid cards on Android. If Apple stabilizes NativeTabs (`unstable-` prefix removed) and adds custom‑accessory morph APIs → prefer native over the hand‑rolled B.3.

## Caveats
- **The reel's fidelity can't be fully matched in RN.** SwiftUI's `glassEffectID` droplet merge/split has no `expo-glass-effect` equivalent; the `GlassContainer` `spacing` + Reanimated approach approximates but won't perfectly reproduce the metaball fusion. For a pixel‑perfect clone you'd embed SwiftUI via `@expo/ui`'s `Host` (Expo notes `GlassEffectContainer` + transition animations are feasible there; see expo#39070) [Expo](https://expo.dev/blog/liquid-glass-app-with-expo-ui-and-swiftui) — at the cost of writing Swift.
- **Exact `expo-glass-tabs` gesture/haptic source could not be verified line‑by‑line** — the individual `src/` files were not retrievable; the behavior (Pan‑races‑Tap, per‑boundary haptic ticks, transform‑only highlight, commit‑on‑release) is from the README and confirmed dependency pins, and the B.4 code is my faithful reconstruction of that documented design, not a copy of its internals. `MINIMIZE_SPRING`'s numeric values weren't visible.
- **Version drift:** `expo-glass-effect`, `expo-blur`, NativeTabs (`unstable-native-tabs`), and `@callstack/liquid-glass` are all moving fast; NativeTabs is explicitly "unstable" and its API may break in minor versions. Re‑check `npx expo install --check` and the changelogs before shipping.
- **Kavsoft's complete source is paywalled** ($3/mo Patreon); the free YouTube videos show the technique but not the full copy‑paste code. Community MIT re‑implementations (FabBar, AnimatedGlassTabs) are the closest freely‑licensed SwiftUI references.
- Some cited implementation snippets come from third‑party blogs/Medium rather than Apple; treat Apple's own docs, WWDC25 Session 323, and the Expo docs as authoritative where they conflict.
