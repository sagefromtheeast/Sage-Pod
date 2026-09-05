import { Ionicons } from '@expo/vector-icons';
import React, { memo } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { RectButton } from 'react-native-gesture-handler';
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
};

export const SwipeableEpisodeRow = memo(function SwipeableEpisodeRow({
  episode,
  onPlay,
  onDismiss,
  onQueue,
  trailing,
}: Props) {
  const theme = useTheme();

  const renderLeftActions = (progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
    const scale = dragX.interpolate({
      inputRange: [0, 80],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    });
    return (
      <View style={[styles.actionContainer, { backgroundColor: theme.danger, justifyContent: 'flex-start' }]}>
        <Animated.View style={[styles.actionIcon, { transform: [{ scale }] }]}>
          <Ionicons name="trash-outline" size={24} color="#fff" />
        </Animated.View>
      </View>
    );
  };

  const renderRightActions = (progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
    const scale = dragX.interpolate({
      inputRange: [-80, 0],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    });
    return (
      <View style={[styles.actionContainer, { backgroundColor: theme.accent, justifyContent: 'flex-end' }]}>
        <Animated.View style={[styles.actionIcon, { transform: [{ scale }] }]}>
          <Ionicons name="list-outline" size={24} color="#fff" />
        </Animated.View>
      </View>
    );
  };

  return (
    <Swipeable
      renderLeftActions={renderLeftActions}
      renderRightActions={renderRightActions}
      onSwipeableLeftOpen={() => {
        triggerHaptic('medium');
        onDismiss(episode);
      }}
      onSwipeableRightOpen={() => {
        triggerHaptic('medium');
        onQueue(episode);
      }}
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
