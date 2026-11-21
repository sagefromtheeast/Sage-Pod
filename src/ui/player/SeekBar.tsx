import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { GestureDetector, useCompetingGestures, usePanGesture, useTapGesture } from 'react-native-gesture-handler';

import { setSetting, useSetting } from '@/db/settings';
import { chapterTicks, currentChapterIndex, type Chapter } from '@/player/chapters';
import { adjustForSpeed } from '@/player/speed';
import { triggerHaptic } from '@/ui/haptics';
import { radius, space, type as typography } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';
import { formatDuration } from '@/util/time';

const TRACK_HEIGHT = 4;
const THUMB = 14;
const BUBBLE_WIDTH = 160;
/** Accessibility increments: one swipe up/down on the seek bar moves this far. */
const A11Y_STEP_SECONDS = 30;

type Props = {
  position: number;
  duration: number;
  /** Playback speed, for "Adjust times to speed". */
  rate?: number;
  chapters: readonly Chapter[];
  onSeek: (seconds: number) => void;
  /** Reports the finger position while dragging (null when released), so the screen can follow it. */
  onScrub?: (seconds: number | null) => void;
};

/**
 * The Now Playing seek bar: a track with gaps at chapter boundaries (as
 * AntennaPod's ChapterSeekBar draws them), a bubble with the time and chapter
 * under the finger while scrubbing, and the elapsed / remaining-or-total
 * labels. Tapping the right-hand label switches between remaining and total.
 */
export function SeekBar({ position, duration, rate = 1, chapters, onSeek, onScrub }: Props) {
  const theme = useTheme();
  const showRemaining = useSetting('showRemainingTime');
  // Settings › User interface › "Adjust times to speed": labels show listening time.
  const adjust = useSetting('adjustTimesToSpeed');
  const listening = (seconds: number) => formatDuration(adjustForSpeed(seconds, rate, adjust));
  const [width, setWidth] = useState(0);
  const [scrub, setScrub] = useState<number | null>(null);

  const usable = duration > 0 && width > 0;
  const shown = scrub ?? position;
  const fraction = duration > 0 ? Math.min(1, Math.max(0, shown / duration)) : 0;

  const toSeconds = (x: number) => Math.min(1, Math.max(0, x / width)) * duration;
  const update = (seconds: number | null) => {
    setScrub(seconds);
    onScrub?.(seconds);
  };

  // The player scrolls vertically, so a drag only becomes a scrub once it
  // moves sideways; a tap seeks straight to the spot.
  const pan = usePanGesture({
    runOnJS: true,
    enabled: usable,
    activeOffsetX: [-4, 4],
    failOffsetY: [-12, 12],
    onActivate: (event) => update(toSeconds(event.x)),
    onUpdate: (event) => update(toSeconds(event.x)),
    onDeactivate: (event) => {
      if (event.canceled) return;
      triggerHaptic('selection');
      onSeek(toSeconds(event.x));
    },
    onFinalize: () => update(null),
  });
  const tap = useTapGesture({
    runOnJS: true,
    enabled: usable,
    onDeactivate: (event) => {
      if (event.canceled) return;
      triggerHaptic('selection');
      onSeek(toSeconds(event.x));
    },
  });
  const gesture = useCompetingGestures(pan, tap);

  const chapterIndex = currentChapterIndex(chapters, shown);
  const chapterTitle = chapterIndex >= 0 ? chapters[chapterIndex].title : null;
  const bubbleLeft = Math.min(Math.max(0, fraction * width - BUBBLE_WIDTH / 2), Math.max(0, width - BUBBLE_WIDTH));

  return (
    <View style={styles.container}>
      {scrub !== null && usable ? (
        <View
          pointerEvents="none"
          style={[styles.bubble, { left: bubbleLeft, backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}
        >
          <Text style={[styles.bubbleTime, { color: theme.text }]}>{formatDuration(scrub)}</Text>
          {chapterTitle ? (
            <Text style={[styles.bubbleChapter, { color: theme.textMuted }]} numberOfLines={1}>
              {chapterTitle}
            </Text>
          ) : null}
        </View>
      ) : null}

      <GestureDetector gesture={gesture}>
        <View
          style={styles.hitArea}
          onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel="Seek"
          accessibilityValue={{ text: `${formatDuration(shown)} of ${formatDuration(duration)}` }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(event) => {
            const step = event.nativeEvent.actionName === 'increment' ? A11Y_STEP_SECONDS : -A11Y_STEP_SECONDS;
            onSeek(Math.min(duration, Math.max(0, position + step)));
          }}
        >
          <View style={[styles.track, { backgroundColor: theme.track }]}>
            <View style={[styles.fill, { width: `${fraction * 100}%`, backgroundColor: theme.accent }]} />
            {chapterTicks(chapters, duration).map((tick, index) => (
              <View
                key={index}
                style={[styles.tick, { left: `${tick * 100}%`, backgroundColor: theme.bg }]}
              />
            ))}
          </View>
          <View
            style={[
              styles.thumb,
              {
                left: fraction * width - THUMB / 2,
                backgroundColor: theme.accent,
                transform: [{ scale: scrub !== null ? 1.3 : 1 }],
              },
            ]}
          />
        </View>
      </GestureDetector>

      <View style={styles.times}>
        <Text style={[styles.time, { color: theme.textFaint }]}>{listening(shown)}</Text>
        <Pressable
          onPress={() => void setSetting('showRemainingTime', !showRemaining)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={showRemaining ? 'Time remaining. Show total length.' : 'Total length. Show time remaining.'}
        >
          <Text style={[styles.time, { color: theme.textFaint }]}>
            {showRemaining ? `−${listening(Math.max(0, duration - shown))}` : listening(duration)}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: space.xs,
  },
  hitArea: {
    height: 32,
    justifyContent: 'center',
  },
  track: {
    height: TRACK_HEIGHT,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
  tick: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    marginLeft: -1,
  },
  thumb: {
    position: 'absolute',
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
  },
  bubble: {
    position: 'absolute',
    bottom: '100%',
    width: BUBBLE_WIDTH,
    marginBottom: space.xs,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    zIndex: 1,
  },
  bubbleTime: {
    ...typography.label,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  bubbleChapter: {
    ...typography.caption,
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
});
