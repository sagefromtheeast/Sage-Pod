import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getEchoYear } from '@/db/echo';
import { useQuery } from '@/db/useQuery';
import { echoCards, type EchoCard } from '@/echo/cards';
import { ECHO_CARD_MS, ECHO_CARDS, echoWindow, shareText, type EchoYear } from '@/echo/echo';
import { formatListenTime } from '@/stats/aggregate';
import { Artwork } from '@/ui/Artwork';
import { EchoBackdrop } from '@/ui/echo/EchoBackdrop';
import { echoPalette, radius, space, type as typography } from '@/ui/theme';

const ICON = require('../assets/icon.png');

/** One segment of the progress bar: full before the current card, filling on it, empty after. */
function Segment({ index, current, progress }: { index: number; current: number; progress: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({
    width: `${(index < current ? 1 : index > current ? 0 : progress.value) * 100}%`,
  }));
  return (
    <View style={[styles.segment, { backgroundColor: echoPalette.track }]}>
      <Animated.View style={[styles.segmentFill, { backgroundColor: echoPalette.fill }, style]} />
    </View>
  );
}

function TextCard({ card }: { card: EchoCard }) {
  return (
    <View style={styles.cardBody} pointerEvents="none" accessible accessibilityLiveRegion="polite">
      {card.key === 'intro' ? <Image source={ICON} style={styles.logo} accessibilityIgnoresInvertColors /> : null}
      {card.above ? <Text style={[styles.above, { color: echoPalette.text }]}>{card.above}</Text> : null}
      <Text style={[styles.large, { color: echoPalette.text }]} adjustsFontSizeToFit numberOfLines={1}>
        {card.large}
      </Text>
      {card.below ? <Text style={[styles.below, { color: echoPalette.text }]}>{card.below}</Text> : null}
      {card.small ? <Text style={[styles.small, { color: echoPalette.textMuted }]}>{card.small}</Text> : null}
    </View>
  );
}

function TopCard({ echo }: { echo: EchoYear }) {
  return (
    <View style={styles.cardBody} pointerEvents="none">
      <Text style={[styles.below, { color: echoPalette.text }]} accessibilityRole="header">
        My favourite podcasts
      </Text>
      {echo.top.length === 0 ? (
        <Text style={[styles.small, { color: echoPalette.textMuted }]}>
          Play a few episodes and your favourites show up here.
        </Text>
      ) : (
        <View style={styles.topList}>
          {echo.top.map((feed, i) => (
            <View
              key={feed.id}
              style={styles.topRow}
              accessible
              accessibilityLabel={`${i + 1}. ${feed.title}, ${formatListenTime(feed.seconds)}`}
            >
              <Text style={[styles.topRank, { color: echoPalette.textMuted }]}>{i + 1}</Text>
              <Artwork uri={feed.imageUrl} size={i === 0 ? 72 : 52} borderRadius={radius.md} />
              <View style={styles.topText}>
                <Text style={[styles.topTitle, { color: echoPalette.text }]} numberOfLines={2}>
                  {feed.title}
                </Text>
                <Text style={[styles.topMeta, { color: echoPalette.textMuted }]}>{formatListenTime(feed.seconds)}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

/**
 * Echo (Phase 20, D-030): AntennaPod's year in review as seven story cards.
 * Each card stays 10 s; a tap on the right goes on, on the left goes back,
 * and holding pauses. With a screen reader on, nothing moves on by itself.
 *
 * `?card=n` opens on card n and `?still=1` stops the timer, for the
 * screenshot harness and deep links.
 */
export default function EchoScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ card?: string; still?: string }>();
  const still = params.still === '1';
  const insets = useSafeAreaInsets();
  const [now] = useState(() => Date.now());
  const [seed] = useState(() => Math.random());
  const { year } = echoWindow(now);
  const { data: echo } = useQuery(() => getEchoYear(year), ['playback_history', 'episodes', 'feeds', 'queue'], [year]);
  const cards = useMemo(() => (echo ? echoCards(echo, now, seed) : []), [echo, now, seed]);

  const [index, setIndex] = useState(() => Math.min(ECHO_CARDS - 1, Math.max(0, Number(params.card) || 0)));
  const indexRef = useRef(0);
  indexRef.current = index;
  const [screenReader, setScreenReader] = useState(false);
  const manual = screenReader || still;
  const progress = useSharedValue(0);
  const held = useRef(false);

  useEffect(() => {
    void AccessibilityInfo.isScreenReaderEnabled().then(setScreenReader);
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', setScreenReader);
    return () => sub.remove();
  }, []);

  const close = useCallback(() => router.back(), [router]);
  const forward = useCallback(() => {
    if (indexRef.current >= ECHO_CARDS - 1) close();
    else setIndex(indexRef.current + 1);
  }, [close]);
  const back = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  // Depends on whether the year has loaded, not on the object: the player's
  // position saves re-run the query, and must not restart the card.
  const loaded = echo !== undefined;

  // Runs the current card's timer from wherever its progress stands.
  const run = useCallback(() => {
    if (manual || !loaded) return;
    const remaining = (1 - progress.value) * ECHO_CARD_MS;
    // A timer, not motion: with reduce motion on, Reanimated would otherwise
    // finish it at once and race through every card.
    const config = { duration: remaining, easing: Easing.linear, reduceMotion: ReduceMotion.Never };
    progress.value = withTiming(1, config, (finished) => {
      if (finished) runOnJS(forward)();
    });
  }, [loaded, forward, progress, manual]);

  useEffect(() => {
    cancelAnimation(progress);
    progress.value = manual ? 1 : 0;
    if (!held.current) run();
    return () => cancelAnimation(progress);
  }, [index, run, progress, manual]);

  const pause = () => {
    held.current = true;
    cancelAnimation(progress);
  };
  const resume = () => {
    held.current = false;
    run();
  };

  const card = cards[index];

  return (
    <View style={[styles.screen, { backgroundColor: echoPalette.bg }]}>
      <StatusBar style="light" />
      {card ? <EchoBackdrop key={card.key} kind={card.backdrop} /> : <EchoBackdrop kind="waves" />}

      {/* Taps: the left third goes back, the rest goes on; holding pauses. */}
      <View style={StyleSheet.absoluteFill} accessible={false}>
        <View style={styles.tapRow}>
          <Pressable
            style={styles.tapBack}
            onPress={back}
            onLongPress={() => undefined}
            onPressIn={pause}
            onPressOut={resume}
            accessibilityRole="button"
            accessibilityLabel="Previous card"
          />
          <Pressable
            style={styles.tapForward}
            onPress={forward}
            onLongPress={() => undefined}
            onPressIn={pause}
            onPressOut={resume}
            accessibilityRole="button"
            accessibilityLabel={index >= ECHO_CARDS - 1 ? 'Close' : 'Next card'}
          />
        </View>
      </View>

      <View style={[styles.chrome, { paddingTop: insets.top + space.sm }]} pointerEvents="box-none">
        <View style={styles.progressRow}>
          {Array.from({ length: ECHO_CARDS }, (_, i) => (
            <Segment key={i} index={i} current={index} progress={progress} />
          ))}
        </View>
        <Pressable
          onPress={close}
          hitSlop={12}
          style={styles.closeButton}
          accessibilityRole="button"
          accessibilityLabel="Close Echo"
        >
          <Ionicons name="close" size={28} color={echoPalette.text} />
        </Pressable>
      </View>

      <View style={[styles.content, { paddingBottom: insets.bottom + space.xl }]} pointerEvents="box-none">
        {!echo ? (
          <ActivityIndicator color={echoPalette.text} />
        ) : index < cards.length ? (
          <TextCard card={cards[index]} />
        ) : (
          <>
            <TopCard echo={echo} />
            <Pressable
              onPress={() => void Share.share({ message: shareText(echo) })}
              style={[styles.share, { backgroundColor: echoPalette.button }]}
              accessibilityRole="button"
            >
              <Ionicons name="share-outline" size={20} color={echoPalette.onButton} />
              <Text style={[styles.shareText, { color: echoPalette.onButton }]}>Share</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  tapRow: { flex: 1, flexDirection: 'row' },
  tapBack: { flex: 1 },
  tapForward: { flex: 2 },
  chrome: { position: 'absolute', left: 0, right: 0, top: 0, paddingHorizontal: space.md },
  progressRow: { flexDirection: 'row', gap: space.xs },
  segment: { flex: 1, height: 3, borderRadius: 2, overflow: 'hidden' },
  segmentFill: { height: '100%' },
  closeButton: { alignSelf: 'flex-end', marginTop: space.md },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: space.xl,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 560,
  },
  cardBody: { alignItems: 'center', gap: space.md, width: '100%' },
  logo: { width: 72, height: 72, borderRadius: radius.lg, marginBottom: space.md },
  above: { ...typography.subheading, textAlign: 'center' },
  large: { fontSize: 88, fontWeight: '800', textAlign: 'center' },
  below: { ...typography.heading, textAlign: 'center' },
  small: { ...typography.body, textAlign: 'center', lineHeight: 22 },
  topList: { alignSelf: 'stretch', gap: space.md, marginTop: space.md },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  topRank: { ...typography.subheading, width: 20, textAlign: 'right' },
  topText: { flex: 1 },
  topTitle: typography.subheading,
  topMeta: typography.caption,
  share: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.xxl,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    borderRadius: radius.pill,
  },
  shareText: typography.subheading,
});
