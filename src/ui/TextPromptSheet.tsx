import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { BottomSheet } from './ActionSheet';
import { radius, space, type as typography } from './theme';
import { useTheme } from './useTheme';

type Props = {
  visible: boolean;
  title: string;
  subtitle?: string;
  /** Starting text each time the sheet opens. */
  initialValue?: string;
  placeholder?: string;
  confirmLabel: string;
  onSubmit: (value: string) => void;
  onClose: () => void;
};

/** A one-field sheet (Android has no Alert.prompt): rename a tag, add a tag. */
export function TextPromptSheet({
  visible,
  title,
  subtitle,
  initialValue = '',
  placeholder,
  confirmLabel,
  onSubmit,
  onClose,
}: Props) {
  const theme = useTheme();
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (visible) setValue(initialValue);
  }, [visible, initialValue]);

  const submit = () => {
    if (!value.trim()) return;
    onSubmit(value.trim());
    onClose();
  };

  return (
    <BottomSheet visible={visible} title={title} subtitle={subtitle} onClose={onClose}>
      <View style={styles.body}>
        <TextInput
          value={value}
          onChangeText={setValue}
          placeholder={placeholder}
          placeholderTextColor={theme.textFaint}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={submit}
          style={[styles.input, { color: theme.text, backgroundColor: theme.surfaceAlt }]}
          accessibilityLabel={title}
        />
        <Pressable
          onPress={submit}
          disabled={!value.trim()}
          style={[styles.button, { backgroundColor: theme.accent, opacity: value.trim() ? 1 : 0.5 }]}
          accessibilityRole="button"
        >
          <Text style={[styles.buttonLabel, { color: theme.onAccent }]}>{confirmLabel}</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: space.md,
    paddingHorizontal: space.xl,
    paddingBottom: space.md,
  },
  input: {
    ...typography.body,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    borderRadius: radius.md,
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    borderRadius: radius.pill,
  },
  buttonLabel: {
    ...typography.subheading,
  },
});
