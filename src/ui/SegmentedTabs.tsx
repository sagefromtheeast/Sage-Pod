import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { triggerHaptic } from './haptics';
import { radius, space, type as typography } from './theme';
import { useTheme } from './useTheme';

/**
 * A row of tabs in a pill track (AntennaPod's statistics tabs). Solid colours,
 * so the selected tab reads the same on every platform.
 */
export function SegmentedTabs<T extends string>({
  tabs,
  selected,
  onSelect,
  style,
}: {
  tabs: readonly { key: T; label: string }[];
  selected: T;
  onSelect: (key: T) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  return (
    <View
      style={[styles.track, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }, style]}
      accessibilityRole="tablist"
    >
      {tabs.map((tab) => {
        const active = tab.key === selected;
        return (
          <Pressable
            key={tab.key}
            onPress={() => {
              if (active) return;
              triggerHaptic('selection');
              onSelect(tab.key);
            }}
            style={[styles.tab, active && { backgroundColor: theme.accent }]}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Text
              style={[
                styles.label,
                { color: active ? theme.onAccent : theme.textMuted, fontWeight: active ? '700' : '500' },
              ]}
              numberOfLines={1}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space.xs + 2,
    borderRadius: radius.pill,
  },
  label: {
    ...typography.label,
  },
});
