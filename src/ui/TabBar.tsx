import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { triggerHaptic } from './haptics';
import { radius, space, type as typography } from './theme';
import { useTheme } from './useTheme';

/**
 * The bottom navigation bar: solid, full width and docked to the screen edge,
 * as AntennaPod draws it (3.13 made its bottom navigation the only layout).
 * The selected tab gets a soft pill behind its icon, Material 3's indicator.
 * The glass capsule (`GlassTabBar`) is the opt-in alternative
 * (Settings › User interface › Glass effects).
 */
export function TabBar({ state, descriptors, emitter, navigateToTab }: BottomTabBarProps) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const focused = state.index === index;
        const label = typeof options.title === 'string' ? options.title : route.name;
        const color = focused ? theme.accent : theme.textMuted;
        const onPress = () => {
          triggerHaptic('selection');
          const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigateToTab(route.key);
        };
        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            onLongPress={() => emitter.emit({ type: 'tabLongPress', target: route.key })}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
            style={styles.tab}
          >
            <Indicator focused={focused} color={theme.accentSoft}>
              {options.tabBarIcon?.({ focused, color, size: 22 })}
              {options.tabBarBadge != null ? (
                <View style={[styles.badge, { backgroundColor: theme.danger, borderColor: theme.surface }]}>
                  <Text style={styles.badgeText}>{options.tabBarBadge}</Text>
                </View>
              ) : null}
            </Indicator>
            <Text
              style={[styles.label, { color: focused ? theme.text : theme.textMuted, fontWeight: focused ? '700' : '500' }]}
              numberOfLines={1}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** The pill behind the selected icon; it fades and widens in when the tab is chosen. */
function Indicator({ focused, color, children }: { focused: boolean; color: string; children: React.ReactNode }) {
  const shown = useSharedValue(focused ? 1 : 0);
  useEffect(() => {
    shown.value = withTiming(focused ? 1 : 0, { duration: 180 });
  }, [focused, shown]);
  const pill = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ scaleX: 0.6 + 0.4 * shown.value }],
  }));
  return (
    <View style={styles.iconSlot}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.pill, { backgroundColor: color }, pill]} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingTop: space.sm,
    paddingBottom: space.xs,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: space.xs,
    minHeight: 52,
  },
  iconSlot: {
    width: 60,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    borderRadius: radius.pill,
  },
  label: {
    ...typography.caption,
    fontSize: 11,
  },
  badge: {
    position: 'absolute',
    top: -2,
    left: 34,
    minWidth: 18,
    height: 18,
    borderRadius: radius.pill,
    borderWidth: 2,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
  },
});
