import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { ActionSheet, type IconName } from './ActionSheet';
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

/** A row that opens a sub-screen of settings: icon, title, summary, chevron. */
export function SettingsLink({
  label,
  description,
  icon,
  onPress,
}: BaseProps & { icon: IconName; onPress: () => void }) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: theme.border, backgroundColor: pressed ? theme.surfaceAlt : 'transparent' },
      ]}
      accessibilityRole="button"
    >
      <View style={[styles.linkIcon, { backgroundColor: theme.surfaceAlt }]}>
        <Ionicons name={icon} size={20} color={theme.accent} />
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
        {description ? (
          <Text style={[styles.description, { color: theme.textMuted }]}>{description}</Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.textFaint} />
    </Pressable>
  );
}

/**
 * A row showing the current choice that opens a sheet of all of them — for
 * lists too long or too wordy for SettingsOptions' chips.
 */
export function SettingsChoice<T extends string | number>({
  label,
  description,
  value,
  options,
  format = (option) => String(option),
  icon = 'radio-button-off',
  onChange,
}: BaseProps & {
  value: T;
  options: readonly T[];
  format?: (option: T) => string;
  /** One icon for every choice, or a function picking one per choice. */
  icon?: IconName | ((option: T) => IconName);
  onChange: (value: T) => void;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.row,
          { borderBottomColor: theme.border, backgroundColor: pressed ? theme.surfaceAlt : 'transparent' },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${format(value)}`}
      >
        <View style={styles.rowText}>
          <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
          {description ? (
            <Text style={[styles.description, { color: theme.textMuted }]}>{description}</Text>
          ) : null}
        </View>
        <Text style={[styles.value, { color: theme.accent }]} numberOfLines={1}>
          {format(value)}
        </Text>
      </Pressable>
      <ActionSheet
        visible={open}
        title={label}
        items={options.map((option) => ({
          key: String(option),
          label: format(option),
          icon: typeof icon === 'function' ? icon(option) : icon,
          selected: option === value,
          onPress: () => onChange(option),
        }))}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

/**
 * A row with a text field that saves when editing ends (blur or the return
 * key), not on every keystroke. `value` is the saved value; editing starts
 * from it again whenever it changes outside the field.
 */
export function SettingsTextInput({
  label,
  description,
  value,
  placeholder,
  onSubmit,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
}: BaseProps & {
  value: string;
  placeholder?: string;
  onSubmit: (value: string) => void;
  keyboardType?: 'default' | 'url' | 'number-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words';
}) {
  const theme = useTheme();
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    if (draft !== value) onSubmit(draft.trim());
  };

  return (
    <View style={[styles.stacked, { borderBottomColor: theme.border }]}>
      <View style={styles.rowText}>
        <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
        {description ? (
          <Text style={[styles.description, { color: theme.textMuted }]}>{description}</Text>
        ) : null}
      </View>
      <TextInput
        value={draft}
        onChangeText={setDraft}
        onBlur={commit}
        onSubmitEditing={commit}
        placeholder={placeholder}
        placeholderTextColor={theme.textFaint}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        returnKeyType="done"
        style={[styles.input, { color: theme.text, backgroundColor: theme.surfaceAlt }]}
        accessibilityLabel={label}
      />
    </View>
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
  linkIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    ...typography.label,
    fontWeight: '600',
    maxWidth: '60%',
    textAlign: 'right',
  },
  input: {
    ...typography.body,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
  },
});
