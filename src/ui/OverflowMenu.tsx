import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable } from 'react-native';

import { ActionSheet, type SheetItem } from './ActionSheet';
import { useTheme } from './useTheme';

type Props = {
  items: readonly SheetItem[];
  /** Optional sheet heading, e.g. the podcast title. */
  title?: string;
  accessibilityLabel?: string;
};

/** A header ⋯ button that opens a sheet of screen actions (AntennaPod's overflow menu). */
export function OverflowMenu({ items, title, accessibilityLabel = 'More options' }: Props) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        <Ionicons name="ellipsis-horizontal-circle" size={24} color={theme.text} />
      </Pressable>
      <ActionSheet visible={open} title={title} items={items} onClose={() => setOpen(false)} />
    </>
  );
}
