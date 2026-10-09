import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import type { IconName } from './ActionSheet';
import { radius, space, type as typography } from './theme';
import { useTheme } from './useTheme';

/** A pill button with an icon, filled with the accent while `active` (filters, toggles, page actions). */
export function Chip({
  icon,
  label,
  onPress,
  active = false,
  accessibilityLabel,
  style,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  active?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        style,
        { backgroundColor: active ? theme.accent : theme.surfaceAlt, opacity: pressed ? 0.8 : 1 },
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={accessibilityLabel}
    >
      <Ionicons name={icon} size={16} color={active ? theme.onAccent : theme.textMuted} />
      <Text style={[styles.label, { color: active ? theme.onAccent : theme.textMuted }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
  },
  label: {
    ...typography.caption,
    fontWeight: '600',
  },
});
