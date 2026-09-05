import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { radius, space, type as typography } from './theme';
import { useTheme } from './useTheme';

type BaseProps = {
  label: string;
  description?: string;
};

/** Section heading above a group of settings rows. */
export function SettingsSection({ title }: { title: string }) {
  const theme = useTheme();
  return (
    <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>{title.toUpperCase()}</Text>
  );
}

/** A row with an on/off switch. */
export function SettingsSwitch({
  label,
  description,
  value,
  onValueChange,
}: BaseProps & { value: boolean; onValueChange: (value: boolean) => void }) {
  const theme = useTheme();

  return (
    <View style={[styles.row, { borderBottomColor: theme.border }]}>
      <View style={styles.rowText}>
        <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
        {description ? (
          <Text style={[styles.description, { color: theme.textMuted }]}>{description}</Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: theme.accent, false: theme.track }}
        thumbColor={theme.surface}
        accessibilityLabel={label}
      />
    </View>
  );
}

/** A row that cycles through a fixed set of values when tapped. */
export function SettingsOptions<T extends string | number>({
  label,
  description,
  value,
  options,
  format = (option) => String(option),
  onChange,
}: BaseProps & {
  value: T;
  options: readonly T[];
  format?: (option: T) => string;
  onChange: (value: T) => void;
}) {
  const theme = useTheme();

  return (
    <View style={[styles.stacked, { borderBottomColor: theme.border }]}>
      <View style={styles.rowText}>
        <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
        {description ? (
          <Text style={[styles.description, { color: theme.textMuted }]}>{description}</Text>
        ) : null}
      </View>

      <View style={styles.chips}>
        {options.map((option) => {
          const selected = option === value;
          return (
            <Pressable
              key={String(option)}
              onPress={() => onChange(option)}
              style={[
                styles.chip,
                {
                  backgroundColor: selected ? theme.accent : theme.surfaceAlt,
                  borderColor: selected ? theme.accent : theme.border,
                },
              ]}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${label}: ${format(option)}`}
            >
              <Text
                style={[styles.chipLabel, { color: selected ? theme.onAccent : theme.textMuted }]}
              >
                {format(option)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** A tappable row that performs an action. */
export function SettingsAction({
  label,
  description,
  onPress,
  destructive = false,
  busy = false,
}: BaseProps & { onPress: () => void; destructive?: boolean; busy?: boolean }) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      style={({ pressed }) => [
        styles.row,
        {
          borderBottomColor: theme.border,
          backgroundColor: pressed ? theme.surfaceAlt : 'transparent',
          opacity: busy ? 0.5 : 1,
        },
      ]}
      accessibilityRole="button"
    >
      <View style={styles.rowText}>
        <Text style={[styles.label, { color: destructive ? theme.danger : theme.text }]}>
          {label}
        </Text>
        {description ? (
          <Text style={[styles.description, { color: theme.textMuted }]}>{description}</Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.textFaint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    ...typography.caption,
    fontWeight: '700',
    letterSpacing: 0.6,
    paddingHorizontal: space.lg,
    paddingTop: space.xl,
    paddingBottom: space.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  stacked: {
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    gap: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  label: {
    ...typography.body,
    fontWeight: '500',
  },
  description: {
    ...typography.caption,
    lineHeight: 16,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipLabel: {
    ...typography.caption,
    fontWeight: '600',
  },
});
