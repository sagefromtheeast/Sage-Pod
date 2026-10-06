import { Ionicons } from '@expo/vector-icons';
import React, { memo } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';

import type { EpisodeWithFeed } from '@/db/types';
import { EpisodeRow } from './EpisodeRow';
import { triggerHaptic } from './haptics';
import { useTheme } from './useTheme';

type Props = {
  episode: EpisodeWithFeed;
  onPlay: (episode: EpisodeWithFeed) => void;
  onDismiss: (episode: EpisodeWithFeed) => void;
  onQueue: (episode: EpisodeWithFeed) => void;
  trailing?: React.ReactNode;
  /** Off while episodes are being selected. */
  swipeEnabled?: boolean;
} & Pick<
  React.ComponentProps<typeof EpisodeRow>,
  'actionHooks' | 'selecting' | 'selected' | 'onToggleSelect' | 'onSelectRange'
>;

/**
 * An inbox row with AntennaPod's default swipes: right adds to the queue,
 * left removes from the inbox (D-003.2). The screen offers Undo for both.
 */
export const SwipeableEpisodeRow = memo(function SwipeableEpisodeRow({
  episode,
  onPlay,
  onDismiss,
  onQueue,
  trailing,
  swipeEnabled = true,
  ...rowProps
}: Props) {
  const theme = useTheme();

  // Revealed by swiping right.
  const renderLeftActions = (
    _progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) => {
    const scale = dragX.interpolate({ inputRange: [0, 80], outputRange: [0, 1], extrapolate: 'clamp' });
    return (
      <View style={[styles.actionContainer, { backgroundColor: theme.accent, justifyContent: 'flex-start' }]}>
        <Animated.View style={[styles.actionIcon, { transform: [{ scale }] }]}>
          <Ionicons name="add-circle-outline" size={24} color={theme.onAccent} />
        </Animated.View>
      </View>
    );
  };

  // Revealed by swiping left.
  const renderRightActions = (
    _progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) => {
    const scale = dragX.interpolate({ inputRange: [-80, 0], outputRange: [1, 0], extrapolate: 'clamp' });
    return (
      <View style={[styles.actionContainer, { backgroundColor: theme.surfaceAlt, justifyContent: 'flex-end' }]}>
        <Animated.View style={[styles.actionIcon, { transform: [{ scale }] }]}>
          <Ionicons name="checkmark-done-outline" size={24} color={theme.text} />
        </Animated.View>
      </View>
    );
  };

  return (
    <Swipeable
      enabled={swipeEnabled}
      renderLeftActions={renderLeftActions}
      renderRightActions={renderRightActions}
      onSwipeableLeftOpen={() => {
        triggerHaptic('medium');
        onQueue(episode);
      }}
      onSwipeableRightOpen={() => {
        triggerHaptic('medium');
        onDismiss(episode);
      }}
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
