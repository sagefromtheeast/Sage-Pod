import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  LayoutChangeEvent,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { GestureDetector, useCompetingGestures, usePanGesture, useTapGesture } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { triggerHaptic } from '@/ui/haptics';
import { radius, space, type as typography } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';
import { GlassContainer } from './GlassContainer';
import { GlassSurface } from './GlassSurface';

export interface SegmentOption<T extends string = string> {
  readonly key: T;
  readonly label: string;
  readonly badge?: number | string;
  readonly icon?: keyof typeof Ionicons.glyphMap;
}

export interface GlassSegmentedControlProps<T extends string> {
  segments: readonly SegmentOption<T>[];
  selectedKey: T;
  onSelect: (key: T) => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

const SPRING_CONFIG = {
  damping: 22,
  stiffness: 220,
  mass: 0.8,
};

export function GlassSegmentedControl<T extends string>({
  segments,
  selectedKey,
  onSelect,
  style,
  accessibilityLabel,
}: GlassSegmentedControlProps<T>) {
  const theme = useTheme();
  const [trackWidth, setTrackWidth] = useState(0);

  const selectedIndex = Math.max(
    0,
    segments.findIndex((s) => s.key === selectedKey)
  );

  const x = useSharedValue(0);
  const activeIndex = useSharedValue(selectedIndex);
  const segWidth = useSharedValue(0);
  const maxTranslate = useSharedValue(0);
  const numSegments = useSharedValue(segments.length);

  useEffect(() => {
    numSegments.value = segments.length;
  }, [segments.length, numSegments]);

  useEffect(() => {
    if (trackWidth > 0 && segments.length > 0) {
      const width = trackWidth / segments.length;
      segWidth.value = width;
      maxTranslate.value = width * (segments.length - 1);
      activeIndex.value = selectedIndex;
      x.value = withSpring(selectedIndex * width, SPRING_CONFIG);
    }
  }, [trackWidth, selectedIndex, segments.length, segWidth, maxTranslate, activeIndex, x]);

  const onLayout = (e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width;
    if (width > 0 && width !== trackWidth) {
      setTrackWidth(width);
    }
  };

  const handleBoundaryHaptic = () => {
    triggerHaptic('selection');
  };

  const handleSelectKey = (index: number) => {
    const segment = segments[index];
    if (segment && segment.key !== selectedKey) {
      onSelect(segment.key);
    }
  };

  const panGesture = usePanGesture({
    onUpdate: (e) => {
      'worklet';
      if (segWidth.value <= 0) return;
      const rawX = e.x - segWidth.value / 2;
      const clampedX = Math.max(0, Math.min(rawX, maxTranslate.value));
      x.value = clampedX;

      const idx = Math.round(clampedX / segWidth.value);
      if (idx !== activeIndex.value && idx >= 0 && idx < numSegments.value) {
        activeIndex.value = idx;
        runOnJS(handleBoundaryHaptic)();
      }
    },
    onDeactivate: () => {
      'worklet';
      if (segWidth.value <= 0) return;
      x.value = withSpring(activeIndex.value * segWidth.value, SPRING_CONFIG);
      runOnJS(handleSelectKey)(activeIndex.value);
    },
  });

  const tapGesture = useTapGesture({
    onDeactivate: (e) => {
      'worklet';
      if (e.canceled || segWidth.value <= 0) return;
      const idx = Math.max(0, Math.min(Math.floor(e.x / segWidth.value), numSegments.value - 1));
      activeIndex.value = idx;
      x.value = withSpring(idx * segWidth.value, SPRING_CONFIG);
      runOnJS(handleBoundaryHaptic)();
      runOnJS(handleSelectKey)(idx);
    },
  });

  const composedGesture = useCompetingGestures(panGesture, tapGesture);

  const thumbAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: x.value }],
      width: segWidth.value > 0 ? segWidth.value : `${100 / segments.length}%`,
    };
  });

  return (
    <View
      style={[
        styles.wrapper,
        {
          backgroundColor: theme.surfaceAlt,
          borderColor: theme.border,
        },
        style,
      ]}
      onLayout={onLayout}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel ?? 'Filter segments'}
    >
      <GestureDetector gesture={composedGesture}>
        <View style={StyleSheet.absoluteFill}>
          <GlassContainer spacing={8} style={StyleSheet.absoluteFill}>
            {/* Sliding Glass Highlight Thumb */}
            <Animated.View style={[styles.thumb, thumbAnimatedStyle]}>
              <GlassSurface
                glassEffectStyle="regular"
                isInteractive={true}
                borderRadius={radius.pill}
                style={[
                  styles.thumbSurface,
                  {
                    backgroundColor: theme.accent,
                    shadowColor: theme.scheme === 'dark' ? '#000' : theme.textMuted,
                  },
                ]}
              />
            </Animated.View>

            {/* Segment Labels Grid */}
            <View style={styles.labelsRow} pointerEvents="none">
              {segments.map((segment, index) => {
                const isSelected = index === selectedIndex;
                return (
                  <View key={segment.key} style={styles.segmentCell}>
                    {segment.icon ? (
                      <Ionicons
                        name={segment.icon}
                        size={14}
                        color={isSelected ? theme.onAccent : theme.textMuted}
                        style={styles.segmentIcon}
                      />
                    ) : null}
                    <Text
                      style={[
                        styles.segmentText,
                        {
                          color: isSelected ? theme.onAccent : theme.textMuted,
                          fontWeight: isSelected ? '700' : '500',
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {segment.label}
                    </Text>
                    {segment.badge != null ? (
                      <View
                        style={[
                          styles.badge,
                          {
                            backgroundColor: isSelected
                              ? 'rgba(0,0,0,0.15)'
                              : theme.surfaceAlt,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.badgeText,
                            {
                              color: isSelected ? theme.onAccent : theme.textFaint,
                            },
                          ]}
                        >
                          {segment.badge}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </GlassContainer>
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    height: 38,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
  },
  thumb: {
    position: 'absolute',
    top: 2,
    bottom: 2,
    left: 0,
    paddingHorizontal: 2,
  },
  thumbSurface: {
    flex: 1,
    borderRadius: radius.pill,
    elevation: 2,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  labelsRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  segmentCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xs,
    gap: 4,
  },
  segmentIcon: {
    marginRight: 2,
  },
  segmentText: {
    ...typography.caption,
    fontSize: 12,
  },
  badge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: radius.pill,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
});
