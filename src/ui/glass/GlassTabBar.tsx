import type { BottomTabBarProps } from 'expo-router/js-tabs';
import React, { useEffect, useState } from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { triggerHaptic } from '@/ui/haptics';
import { radius, space, type as typography } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';
import { GlassSurface } from './GlassSurface';

const SPRING_CONFIG = {
  damping: 22,
  stiffness: 220,
  mass: 0.8,
};

export function GlassTabBar({
  state,
  descriptors,
  emitter,
  navigateToTab,
}: BottomTabBarProps) {
  const theme = useTheme();
  const [trackWidth, setTrackWidth] = useState(0);

  const numTabs = state.routes.length;
  const tabWidth = trackWidth > 0 && numTabs > 0 ? (trackWidth - 8) / numTabs : 0;

  const indicatorX = useSharedValue(0);

  useEffect(() => {
    if (tabWidth > 0) {
      indicatorX.value = withSpring(state.index * tabWidth, SPRING_CONFIG);
    }
  }, [state.index, tabWidth, indicatorX]);

  const onLayout = (e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width;
    if (width > 0 && width !== trackWidth) {
      setTrackWidth(width);
      indicatorX.value = state.index * ((width - 8) / numTabs);
    }
  };

  const indicatorAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: indicatorX.value }],
      width: tabWidth > 0 ? tabWidth : `${100 / numTabs}%`,
    };
  });

  return (
    <View style={styles.outerContainer}>
      <GlassSurface
        glassEffectStyle="regular"
        isInteractive={true}
        borderRadius={radius.pill}
        style={[
          styles.surface,
          {
            borderColor:
              theme.scheme === 'dark'
                ? 'rgba(255, 255, 255, 0.12)'
                : 'rgba(0, 0, 0, 0.08)',
            shadowColor: theme.scheme === 'dark' ? '#000' : theme.textMuted,
          },
        ]}
      >
        <View style={styles.innerTrack} onLayout={onLayout}>
          {/* Sliding Liquid Glass Indicator */}
          {tabWidth > 0 && (
            <Animated.View
              style={[
                styles.activeIndicator,
                indicatorAnimatedStyle,
                {
                  backgroundColor:
                    theme.scheme === 'dark'
                      ? 'rgba(255, 255, 255, 0.1)'
                      : 'rgba(0, 0, 0, 0.06)',
                },
              ]}
            />
          )}

          {/* Tab Buttons */}
          <View style={styles.tabsRow}>
            {state.routes.map((route, index) => {
              const { options } = descriptors[route.key];
              const isFocused = state.index === index;
              const label =
                options.tabBarLabel !== undefined
                  ? options.tabBarLabel
                  : options.title !== undefined
                  ? options.title
                  : route.name;

              const color = isFocused ? theme.accent : theme.textMuted;
              const icon = options.tabBarIcon
                ? options.tabBarIcon({
                    focused: isFocused,
                    color,
                    size: 20,
                  })
                : null;

              const badge = options.tabBarBadge;

              const onPress = () => {
                triggerHaptic('selection');
                const event = emitter.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });

                if (!isFocused && !event.defaultPrevented) {
                  navigateToTab(route.key);
                }
              };

              const onLongPress = () => {
                emitter.emit({
                  type: 'tabLongPress',
                  target: route.key,
                });
              };

              return (
                <Pressable
                  key={route.key}
                  onPress={onPress}
                  onLongPress={onLongPress}
                  accessibilityRole="tab"
                  accessibilityState={isFocused ? { selected: true } : {}}
                  accessibilityLabel={
                    options.tabBarAccessibilityLabel ??
                    (typeof label === 'string' ? label : undefined)
                  }
                  style={styles.tabButton}
                >
                  <View style={styles.iconWrapper}>
                    {icon}
                    {badge != null && (
                      <View
                        style={[
                          styles.badge,
                          { backgroundColor: theme.danger },
                        ]}
                      >
                        <Text style={styles.badgeText}>{badge}</Text>
                      </View>
                    )}
                  </View>
                  <Text
                    style={[
                      styles.tabLabel,
                      {
                        color,
                        fontWeight: isFocused ? '600' : '400',
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {typeof label === 'string' ? label : route.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    paddingHorizontal: space.md,
  },
  surface: {
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 8,
  },
  innerTrack: {
    height: 56,
    paddingHorizontal: 4,
    justifyContent: 'center',
    position: 'relative',
  },
  activeIndicator: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    borderRadius: radius.pill,
  },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    height: '100%',
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    gap: 2,
  },
  iconWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    ...typography.caption,
    fontSize: 10,
    lineHeight: 12,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    minWidth: 16,
    height: 16,
    borderRadius: radius.pill,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '700',
    lineHeight: 11,
  },
});
