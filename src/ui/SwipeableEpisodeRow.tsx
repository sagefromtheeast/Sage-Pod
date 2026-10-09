import { Ionicons } from '@expo/vector-icons';
import React, { memo, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';

import { subjectFor } from '@/actions/episodeActions';
import { runEpisodeAction } from '@/actions/runEpisodeAction';
import { isQueuedNow } from '@/db/queueMembership';
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

import { EpisodeRow } from './EpisodeRow';
import { triggerHaptic } from './haptics';
import type { Palette } from './theme';
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
  if (action === 'removeFromInbox' || action === 'togglePlayed') return { bg: theme.surfaceAlt, fg: theme.text };
  return { bg: theme.accent, fg: theme.onAccent };
}

/**
 * An episode row with the list's configured swipes (AntennaPod's swipe
 * actions). Each swipe runs through `runEpisodeAction`, so it gets the same
 * Undo toast or confirmation as the long-press menu.
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
  const ref = useRef<Swipeable>(null);
  const pair = parseSwipes(screen, useSetting(SWIPE_SCREENS[screen].setting));
  const right = unavailable.includes(pair.right) ? 'none' : pair.right;
  const left = unavailable.includes(pair.left) ? 'none' : pair.left;

  const run = (swipe: SwipeAction) => {
    triggerHaptic('medium');
    // Close first: a toggle leaves the row in place.
    ref.current?.close();
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
  };

  const strip = (swipe: SwipeAction, side: 'left' | 'right') => {
    const { bg, fg } = colorsFor(swipe, theme);
    return (_progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
      const scale = dragX.interpolate({
        inputRange: side === 'left' ? [0, 80] : [-80, 0],
        outputRange: side === 'left' ? [0, 1] : [1, 0],
        extrapolate: 'clamp',
      });
      return (
        <View
          style={[
            styles.actionContainer,
            { backgroundColor: bg, justifyContent: side === 'left' ? 'flex-start' : 'flex-end' },
          ]}
        >
          <Animated.View style={[styles.actionIcon, { transform: [{ scale }] }]}>
            <Ionicons name={SWIPE_ICONS[swipe] as React.ComponentProps<typeof Ionicons>['name']} size={24} color={fg} />
          </Animated.View>
        </View>
      );
    };
  };

  return (
    <Swipeable
      ref={ref}
      enabled={swipeEnabled && (right !== 'none' || left !== 'none')}
      // Swiping right reveals the left edge.
      renderLeftActions={right !== 'none' ? strip(right, 'left') : undefined}
      renderRightActions={left !== 'none' ? strip(left, 'right') : undefined}
      onSwipeableOpen={(direction) => run(direction === 'left' ? right : left)}
      leftThreshold={50}
      rightThreshold={50}
    >
      <View style={{ backgroundColor: theme.bg }}>
        <EpisodeRow episode={episode} onPlay={onPlay} trailing={trailing} {...rowProps} />
      </View>
    </Swipeable>
  );
});

const styles = StyleSheet.create({
  actionContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionIcon: {
    paddingHorizontal: 20,
  },
});
