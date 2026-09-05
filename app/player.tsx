import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getSettings } from '@/db/settings';
import { PLAYBACK_RATES, player, usePlayerState } from '@/player';
import { useChapters } from '@/player/useChapters';
import { Artwork } from '@/ui/Artwork';
import { triggerHaptic } from '@/ui/haptics';
import { radius, space, type as typography } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';
import { shareEpisode } from '@/util/share';
import { formatDuration } from '@/util/time';

const SLEEP_TIMER_OPTIONS = [5, 10, 15, 30, 45, 60] as const;

export default function PlayerScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { episode, position, duration, playing, buffering, rate, sleepTimerEndsAt, error } =
    usePlayerState();

  // While the user drags the scrubber, show their finger position rather than
  // the engine's — otherwise the thumb fights the playback ticks.
  const [scrubbing, setScrubbing] = useState<number | null>(null);
  const [showSleepOptions, setShowSleepOptions] = useState(false);

  const settings = getSettings();
  const displayPosition = scrubbing ?? position;

  const commitSeek = useCallback(async (value: number) => {
    triggerHaptic('selection');
    await player.seekTo(value);
    setScrubbing(null);
  }, []);

  if (!episode) {
    return (
      <View style={[styles.empty, { backgroundColor: theme.bg }]}>
        <Text style={[styles.emptyText, { color: theme.textMuted }]}>Nothing is playing.</Text>
        <Pressable onPress={() => router.back()} accessibilityRole="button">
          <Text style={[styles.emptyAction, { color: theme.accent }]}>Close</Text>
        </Pressable>
      </View>
    );
  }

  const artwork = episode.image_url ?? episode.feed_image_url;

  return (
    <ScrollView
      style={{ backgroundColor: theme.bg }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + space.xl },
      ]}
    >
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Close player"
        >
          <Ionicons name="chevron-down" size={28} color={theme.textMuted} />
        </Pressable>
        <Text style={[styles.topBarTitle, { color: theme.textMuted }]} numberOfLines={1}>
          {episode.feed_title}
        </Text>
        <View style={styles.topBarRight}>
          <Pressable
            onPress={() =>
              void shareEpisode({
                title: episode.title,
                podcastTitle: episode.feed_title,
                url: episode.link ?? episode.media_url,
                positionSeconds: displayPosition,
              })
            }
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Share episode"
          >
            <Ionicons name="share-outline" size={22} color={theme.textMuted} />
          </Pressable>
          <Pressable
            onPress={() => router.push(`/episode/${episode.id}`)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Episode details"
          >
            <Ionicons name="information-circle-outline" size={24} color={theme.textMuted} />
          </Pressable>
        </View>
      </View>

      <View style={styles.artworkWrap}>
        <Artwork uri={artwork} size={300} borderRadius={radius.xl} />
      </View>

      <Text style={[styles.title, { color: theme.text }]} numberOfLines={3}>
        {episode.title}
      </Text>

      {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}

      <View style={styles.scrubber}>
        <Slider
          value={displayPosition}
          minimumValue={0}
          // A zero maximum makes the slider unusable before metadata loads, so
          // fall back to a nominal length until the real duration arrives.
          maximumValue={duration > 0 ? duration : 1}
          minimumTrackTintColor={theme.accent}
          maximumTrackTintColor={theme.track}
          thumbTintColor={theme.accent}
          onValueChange={setScrubbing}
          onSlidingComplete={(value) => void commitSeek(value)}
          disabled={duration <= 0}
          accessibilityLabel="Seek"
        />
        <View style={styles.times}>
          <Text style={[styles.time, { color: theme.textFaint }]}>
            {formatDuration(displayPosition)}
          </Text>
          <Text style={[styles.time, { color: theme.textFaint }]}>
            −{formatDuration(Math.max(0, duration - displayPosition))}
          </Text>
        </View>
      </View>

      <View style={styles.transport}>
        <Pressable
          onPress={() => {
            triggerHaptic('light');
            void player.skipBackward();
          }}
          hitSlop={10}
          style={styles.skip}
          accessibilityRole="button"
          accessibilityLabel={`Skip back ${settings.skipBackward} seconds`}
        >
          <Ionicons name="play-back" size={30} color={theme.text} />
          <Text style={[styles.skipLabel, { color: theme.textFaint }]}>{settings.skipBackward}</Text>
        </Pressable>

        <Pressable
          onPress={() => {
            triggerHaptic('medium');
            player.togglePlayPause();
          }}
          style={[styles.playButton, { backgroundColor: theme.accent }]}
          accessibilityRole="button"
          accessibilityLabel={playing ? 'Pause' : 'Play'}
        >
          <Ionicons
            name={buffering && !playing ? 'ellipsis-horizontal' : playing ? 'pause' : 'play'}
            size={34}
            color={theme.onAccent}
            style={!playing && !buffering ? styles.playGlyph : undefined}
          />
        </Pressable>

        <Pressable
          onPress={() => {
            triggerHaptic('light');
            void player.skipForward();
          }}
          hitSlop={10}
          style={styles.skip}
          accessibilityRole="button"
          accessibilityLabel={`Skip forward ${settings.skipForward} seconds`}
        >
          <Ionicons name="play-forward" size={30} color={theme.text} />
          <Text style={[styles.skipLabel, { color: theme.textFaint }]}>{settings.skipForward}</Text>
        </Pressable>
      </View>

      <View style={styles.secondaryRow}>
        <Pressable
          onPress={() => player.cycleRate()}
          style={[styles.pill, { backgroundColor: theme.surfaceAlt }]}
          accessibilityRole="button"
          accessibilityLabel={`Playback speed ${rate}x`}
        >
          <Text style={[styles.pillLabel, { color: theme.text }]}>{rate}×</Text>
        </Pressable>

        <SleepTimerButton
          endsAt={sleepTimerEndsAt}
          expanded={showSleepOptions}
          onToggle={() => setShowSleepOptions((value) => !value)}
        />

        <Pressable
          onPress={() => void player.skipToNext()}
          style={[styles.pill, { backgroundColor: theme.surfaceAlt }]}
          accessibilityRole="button"
          accessibilityLabel="Next in queue"
        >
          <Ionicons name="play-skip-forward" size={17} color={theme.text} />
        </Pressable>
      </View>

      {showSleepOptions ? (
        <View style={styles.sleepOptions}>
          <Pressable
            onPress={() => {
              player.startSleepTimerUntilEndOfEpisode();
              setShowSleepOptions(false);
            }}
            style={[styles.sleepChip, { backgroundColor: theme.surfaceAlt }]}
            accessibilityRole="button"
          >
            <Text style={[styles.pillLabel, { color: theme.text }]}>End of episode</Text>
          </Pressable>
          {SLEEP_TIMER_OPTIONS.map((minutes) => (
            <Pressable
              key={minutes}
              onPress={() => {
                player.startSleepTimer(minutes);
                setShowSleepOptions(false);
              }}
              style={[styles.sleepChip, { backgroundColor: theme.surfaceAlt }]}
              accessibilityRole="button"
            >
              <Text style={[styles.pillLabel, { color: theme.text }]}>{minutes}m</Text>
            </Pressable>
          ))}
          {sleepTimerEndsAt ? (
            <Pressable
              onPress={() => {
                player.cancelSleepTimer();
                setShowSleepOptions(false);
              }}
              style={[styles.sleepChip, { backgroundColor: theme.surfaceAlt }]}
              accessibilityRole="button"
            >
              <Text style={[styles.pillLabel, { color: theme.danger }]}>Off</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View style={styles.rateRow}>
        {PLAYBACK_RATES.map((option) => {
          const selected = Math.abs(option - rate) < 0.01;
          return (
            <Pressable
              key={option}
              onPress={() => player.setRate(option)}
              style={[
                styles.rateChip,
                { backgroundColor: selected ? theme.accent : 'transparent' },
              ]}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
            >
              <Text
                style={[styles.rateLabel, { color: selected ? theme.onAccent : theme.textFaint }]}
              >
                {option}×
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ChaptersList chaptersUrl={episode.chapters_url} position={displayPosition} />
    </ScrollView>
  );
}

function ChaptersList({ chaptersUrl, position }: { chaptersUrl?: string | null; position: number }) {
  const theme = useTheme();
  const { chapters } = useChapters(chaptersUrl);

  if (!chapters || chapters.length === 0) return null;

  return (
    <View style={styles.chapters}>
      <Text style={[styles.chaptersTitle, { color: theme.textMuted }]}>CHAPTERS</Text>
      {chapters.map((ch, i) => {
        const nextTime = i < chapters.length - 1 ? chapters[i + 1].startTime : Infinity;
        const active = position >= ch.startTime && position < nextTime;
        return (
          <Pressable
            key={i}
            onPress={() => void player.seekTo(ch.startTime)}
            style={[styles.chapterRow, active ? { backgroundColor: theme.surfaceAlt } : null]}
          >
            <Text style={[styles.chapterTime, { color: active ? theme.accent : theme.textMuted }]}>
              {formatDuration(ch.startTime)}
            </Text>
            <Text style={[styles.chapterLabel, { color: active ? theme.text : theme.textMuted }]} numberOfLines={1}>
              {ch.title}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Shows the sleep timer's remaining minutes, ticking once a minute. */
function SleepTimerButton({
  endsAt,
  expanded,
  onToggle,
}: {
  endsAt: number | null;
  expanded: boolean;
  onToggle: () => void;
}) {
  const theme = useTheme();
  const [, forceTick] = useState(0);

  useEffect(() => {
    if (!endsAt) return;
    // A minute-resolution label needs a minute-resolution timer; anything
    // faster just burns wakeups while the screen is on.
    const handle = setInterval(() => forceTick((value) => value + 1), 30_000);
    return () => clearInterval(handle);
  }, [endsAt]);

  const remaining = endsAt ? Math.max(0, Math.ceil((endsAt - Date.now()) / 60_000)) : null;
  const active = remaining !== null && remaining > 0;

  return (
    <Pressable
      onPress={onToggle}
      style={[
        styles.pill,
        { backgroundColor: active ? theme.accent : theme.surfaceAlt },
        expanded && !active ? { borderColor: theme.accent, borderWidth: 1 } : null,
      ]}
      accessibilityRole="button"
      accessibilityLabel={active ? `Sleep timer, ${remaining} minutes left` : 'Sleep timer'}
    >
      <Ionicons name="moon" size={15} color={active ? theme.onAccent : theme.text} />
      {active ? (
        <Text style={[styles.pillLabel, { color: theme.onAccent }]}>{remaining}m</Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: space.xl,
    gap: space.lg,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
  },
  emptyText: {
    ...typography.body,
  },
  emptyAction: {
    ...typography.subheading,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  topBarTitle: {
    ...typography.caption,
    flex: 1,
    textAlign: 'center',
    fontWeight: '600',
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  artworkWrap: {
    alignItems: 'center',
    paddingVertical: space.md,
  },
  title: {
    ...typography.heading,
    textAlign: 'center',
    lineHeight: 26,
  },
  error: {
    ...typography.caption,
    textAlign: 'center',
  },
  scrubber: {
    gap: space.xs,
  },
  times: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: space.xs,
  },
  time: {
    ...typography.caption,
    fontVariant: ['tabular-nums'],
  },
  transport: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xxl,
  },
  skip: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipLabel: {
    ...typography.caption,
    fontSize: 10,
    marginTop: -4,
  },
  playButton: {
    width: 76,
    height: 76,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playGlyph: {
    marginLeft: 4,
  },
  secondaryRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: space.md,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    minWidth: 56,
    justifyContent: 'center',
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
  },
  pillLabel: {
    ...typography.label,
    fontWeight: '600',
  },
  sleepOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: space.sm,
  },
  sleepChip: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
  },
  rateRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: space.xs,
  },
  rateChip: {
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
  },
  rateLabel: {
    ...typography.caption,
    fontWeight: '600',
  },
  chapters: {
    marginTop: space.lg,
    gap: space.xs,
  },
  chaptersTitle: {
    ...typography.caption,
    fontWeight: '700',
    letterSpacing: 0.6,
    paddingHorizontal: space.xs,
    marginBottom: space.xs,
  },
  chapterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.sm,
    paddingVertical: space.sm,
    borderRadius: radius.sm,
  },
  chapterTime: {
    ...typography.caption,
    fontVariant: ['tabular-nums'],
    minWidth: 45,
  },
  chapterLabel: {
    ...typography.body,
    flex: 1,
  },
});
