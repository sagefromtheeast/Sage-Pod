import { Ionicons } from '@expo/vector-icons';
import React, { memo } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';

import type { EpisodeWithFeed } from '@/db/types';
import { EpisodeRow } from './EpisodeRow';
import { useTheme } from './useTheme';

type Props = {
  episode: EpisodeWithFeed;
  onPlay: (episode: EpisodeWithFeed) => void;
  onRemove: (episode: EpisodeWithFeed) => void;
  onMoveToTop: (episode: EpisodeWithFeed) => void;
  trailing?: React.ReactNode;
};

export const SwipeableQueueRow = memo(function SwipeableQueueRow({
  episode,
  onPlay,
  onRemove,
  onMoveToTop,
  trailing,
}: Props) {
  const theme = useTheme();

  const renderLeftActions = (
    _progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) => {
    const scale = dragX.interpolate({
      inputRange: [0, 80],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    });
    return (
      <View style={[styles.actionContainer, { backgroundColor: theme.accent, justifyContent: 'flex-start' }]}>
        <Animated.View style={[styles.actionIcon, { transform: [{ scale }] }]}>
          <Ionicons name="arrow-up-circle-outline" size={24} color="#fff" />
        </Animated.View>
      </View>
    );
  };

  const renderRightActions = (
    _progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) => {
    const scale = dragX.interpolate({
      inputRange: [-80, 0],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    });
    return (
      <View style={[styles.actionContainer, { backgroundColor: theme.danger, justifyContent: 'flex-end' }]}>
        <Animated.View style={[styles.actionIcon, { transform: [{ scale }] }]}>
          <Ionicons name="trash-outline" size={24} color="#fff" />
        </Animated.View>
      </View>
    );
  };

  return (
    <Swipeable
      renderLeftActions={renderLeftActions}
      renderRightActions={renderRightActions}
      onSwipeableLeftOpen={() => onMoveToTop(episode)}
      onSwipeableRightOpen={() => onRemove(episode)}
      leftThreshold={50}
      rightThreshold={50}
    >
      <View style={{ backgroundColor: theme.bg }}>
        <EpisodeRow episode={episode} onPlay={onPlay} trailing={trailing} />
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
