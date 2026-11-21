import { Ionicons } from '@expo/vector-icons';
import React, { memo, useCallback } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  interpolateColor,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { subjectFor } from '@/actions/episodeActions';
import { ACTION_META, runEpisodeAction } from '@/actions/runEpisodeAction';
import { isQueuedNow, useIsQueued } from '@/db/queueMembership';
import { useSetting } from '@/db/settings';
import type { EpisodeWithFeed } from '@/db/types';
import { player } from '@/player';
import {
  parseSwipes,
  resolveSwipe,
  SWIPE_ICONS,
  SWIPE_LABELS,
  SWIPE_SCREENS,
  type SwipeAction,
  type SwipeScreen,
} from '@/settings/swipes';

import type { IconName } from './ActionSheet';
import { EpisodeRow } from './EpisodeRow';
import { triggerHaptic } from './haptics';
import { armProgress, releaseDirection, rowOffset } from './swipeMath';
import { space, type as typography, type Palette } from './theme';
import { showToast } from './UndoToast';
import { useTheme } from './useTheme';

type Props = {
  episode: EpisodeWithFeed;
  /** Whose swipe settings apply (Settings › User interface › Swipe actions). */
  screen: SwipeScreen;
  onPlay: (episode: EpisodeWithFeed) => void;
  trailing?: React.ReactNode;
  /** Off while episodes are being selected or the queue is locked. */
  swipeEnabled?: boolean;
  /** Swipes the list can't run right now, e.g. Move to top while the queue is kept sorted. */
  unavailable?: readonly SwipeAction[];
} & Pick<
  React.ComponentProps<typeof EpisodeRow>,
  'actionHooks' | 'selecting' | 'selected' | 'onToggleSelect' | 'onSelectRange'
>;

/** Strip colours: removing things is red, inbox and played state are quiet, the rest use the accent. */
function colorsFor(action: SwipeAction, theme: Palette): { bg: string; fg: string } {
  if (action === 'delete' || action === 'removeFromQueue') return { bg: theme.danger, fg: theme.onAccent };
  if (action === 'removeFromInbox' || action === 'togglePlayed') return { bg: theme.textMuted, fg: theme.bg };
  return { bg: theme.accent, fg: theme.onAccent };
}

/** How long the row stays off screen before sliding back, if the list kept it. */
const RETURN_DELAY_MS = 380;

/**
 * An episode row with the list's configured swipes (AntennaPod's swipe
 * actions). The row follows the finger over a strip that names the action;
 * once the swipe passes the commit point the strip fills with the action's
 * colour, the icon grows and the phone ticks. Letting go there slides the row
 * away and runs the action through `runEpisodeAction` (same Undo toast or
 * confirmation as the long-press menu); letting go short springs it back.
 * Screen readers get the same two actions from the row's actions menu.
 */
export const SwipeableEpisodeRow = memo(function SwipeableEpisodeRow({
  episode,
  screen,
  onPlay,
  trailing,
  swipeEnabled = true,
  unavailable = [],
  ...rowProps
}: Props) {
  const theme = useTheme();
  const pair = parseSwipes(screen, useSetting(SWIPE_SCREENS[screen].setting));
  const right = unavailable.includes(pair.right) ? 'none' : pair.right;
  const left = unavailable.includes(pair.left) ? 'none' : pair.left;
  const canRight = right !== 'none';
  const canLeft = left !== 'none';
  const enabled = swipeEnabled && (canRight || canLeft);

  // What the strip says: a queue toggle on a queued episode shows "remove", not "add".
  const queued = useIsQueued(episode.id);
  const describe = (swipe: SwipeAction): { icon: IconName; label: string } => {
    const action = resolveSwipe(swipe, subjectFor(episode, { queued, playing: false }));
    return action
      ? { icon: ACTION_META[action].icon, label: ACTION_META[action].label }
      : { icon: SWIPE_ICONS[swipe] as IconName, label: SWIPE_LABELS[swipe] };
  };

  const run = useCallback(
    (swipe: SwipeAction) => {
      triggerHaptic('medium');
      const state = player.getState();
      const action = resolveSwipe(
        swipe,
        subjectFor(episode, {
          queued: isQueuedNow(episode.id),
          playing: state.episode?.id === episode.id && state.playing,
        })
      );
      if (action) void runEpisodeAction(action, [episode]);
      else showToast(`${SWIPE_LABELS[swipe]}: not available for this episode`);
    },
    [episode]
  );

  const width = useSharedValue(0);
  const offset = useSharedValue(0);
  const armed = useSharedValue(0);

  const tick = useCallback(() => triggerHaptic('selection'), []);
  const commit = useCallback(
    (direction: 'right' | 'left') => {
      run(direction === 'right' ? right : left);
      // A toggle leaves the row in the list: bring it back.
      setTimeout(() => {
        offset.value = withSpring(0, { damping: 20, stiffness: 220 });
      }, RETURN_DELAY_MS);
    },
    [run, right, left, offset]
  );

  const pan = usePanGesture({
    enabled,
    // Horizontal only: a vertical drag still scrolls the list.
    activeOffsetX: [-14, 14],
    failOffsetY: [-12, 12],
    onUpdate: (event) => {
      'worklet';
      offset.value = rowOffset(event.translationX, canRight, canLeft, width.value);
    },
    onDeactivate: (event) => {
      'worklet';
      // A cancelled gesture (the system took the touch) never commits.
      const direction = event.canceled
        ? null
        : releaseDirection(offset.value, event.velocityX, canRight, canLeft, width.value);
      if (direction) {
        const target = direction === 'right' ? width.value : -width.value;
        offset.value = withTiming(target, { duration: 160 }, (finished) => {
          if (finished) runOnJS(commit)(direction);
        });
      } else {
        offset.value = withSpring(0, { damping: 20, stiffness: 260 });
      }
    },
  });

  // One tick each time the swipe crosses the commit point, either way.
  useAnimatedReaction(
    () => (armProgress(offset.value, width.value) >= 1 ? 1 : 0),
    (now, before) => {
      if (before !== null && now !== before) {
        armed.value = withTiming(now, { duration: 120 });
        if (now === 1) runOnJS(tick)();
      }
    }
  );

  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }] }));

  const onLayout = (e: LayoutChangeEvent) => {
    width.value = e.nativeEvent.layout.width;
  };

  const accessibilityActions = [
    ...(canRight ? [{ name: 'swipeRight', label: describe(right).label }] : []),
    ...(canLeft ? [{ name: 'swipeLeft', label: describe(left).label }] : []),
  ];

  return (
    <View
      onLayout={onLayout}
      accessibilityActions={enabled ? accessibilityActions : undefined}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'swipeRight') run(right);
        if (event.nativeEvent.actionName === 'swipeLeft') run(left);
      }}
    >
      {enabled ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {canRight ? (
            <Strip side="right" offset={offset} armed={armed} {...describe(right)} {...colorsFor(right, theme)} theme={theme} />
          ) : null}
          {canLeft ? (
            <Strip side="left" offset={offset} armed={armed} {...describe(left)} {...colorsFor(left, theme)} theme={theme} />
          ) : null}
        </View>
      ) : null}
      <GestureDetector gesture={pan}>
        <Animated.View style={[{ backgroundColor: theme.bg }, rowStyle]}>
          <EpisodeRow episode={episode} onPlay={onPlay} trailing={trailing} {...rowProps} />
        </Animated.View>
      </GestureDetector>
    </View>
  );
});

type StripProps = {
  /** right: revealed by a swipe to the right, so it sits on the row's left edge. */
  side: 'right' | 'left';
  offset: { value: number };
  armed: { value: number };
  icon: IconName;
  label: string;
  bg: string;
  fg: string;
  theme: Palette;
};

/** The strip behind the row: quiet until the swipe is far enough, then the action's colour. */
function Strip({ side, offset, armed, icon, label, bg, fg, theme }: StripProps) {
  const stripStyle = useAnimatedStyle(() => {
    const showing = side === 'right' ? offset.value > 0 : offset.value < 0;
    return {
      opacity: showing ? 1 : 0,
      backgroundColor: interpolateColor(armed.value, [0, 1], [theme.surfaceAlt, bg]),
    };
  });
  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.9 + 0.2 * armed.value }],
  }));
  const tintStyle = useAnimatedStyle(() => ({
    color: interpolateColor(armed.value, [0, 1], [theme.textMuted, fg]),
  }));
  // Icons can't take an animated colour, so the armed one fades in over the quiet one.
  const armedIconStyle = useAnimatedStyle(() => ({ opacity: armed.value }));

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        styles.strip,
        { justifyContent: side === 'right' ? 'flex-start' : 'flex-end' },
        stripStyle,
      ]}
    >
      <Animated.View style={[styles.stripContent, side === 'left' && styles.stripContentEnd, contentStyle]}>
        <View>
          <Ionicons name={icon} size={22} color={theme.textMuted} />
          <Animated.View style={[StyleSheet.absoluteFill, armedIconStyle]}>
            <Ionicons name={icon} size={22} color={fg} />
          </Animated.View>
        </View>
        <Animated.Text style={[styles.stripLabel, tintStyle]} numberOfLines={1}>
          {label}
        </Animated.Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stripContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.xl,
  },
  stripContentEnd: {
    flexDirection: 'row-reverse',
  },
  stripLabel: {
    ...typography.label,
    fontWeight: '700',
  },
});

