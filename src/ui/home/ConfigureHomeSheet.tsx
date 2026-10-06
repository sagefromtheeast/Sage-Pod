import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { setSetting, useSetting } from '@/db/settings';
import {
  HOME_SECTION_TITLES,
  moveSection,
  parseHomeSections,
  serializeHomeSections,
  setSectionVisible,
} from '@/home/sections';
import { BottomSheet } from '@/ui/ActionSheet';
import { space, type as typography } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

type Props = {
  visible: boolean;
  onClose: () => void;
};

/** AntennaPod's "Configure home screen": show, hide and reorder Home's sections. */
export function ConfigureHomeSheet({ visible, onClose }: Props) {
  const theme = useTheme();
  const sections = parseHomeSections(useSetting('homeSections'));
  const save = (next: typeof sections) => void setSetting('homeSections', serializeHomeSections(next));

  return (
    <BottomSheet visible={visible} title="Configure home screen" subtitle="Show, hide and reorder sections" onClose={onClose}>
      <ScrollView bounces={false} contentContainerStyle={styles.body}>
        {sections.map((section, index) => {
          const title = HOME_SECTION_TITLES[section.id];
          return (
            <View key={section.id} style={[styles.row, { borderBottomColor: theme.border }]}>
              <Switch
                value={section.visible}
                onValueChange={(value) => save(setSectionVisible(sections, section.id, value))}
                trackColor={{ true: theme.accent, false: theme.track }}
                accessibilityLabel={`Show ${title}`}
              />
              <Text style={[styles.title, { color: section.visible ? theme.text : theme.textFaint }]}>{title}</Text>
              <Pressable
                onPress={() => save(moveSection(sections, index, -1))}
                disabled={index === 0}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Move ${title} up`}
              >
                <Ionicons name="chevron-up" size={22} color={index === 0 ? theme.textFaint : theme.textMuted} />
              </Pressable>
              <Pressable
                onPress={() => save(moveSection(sections, index, 1))}
                disabled={index === sections.length - 1}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Move ${title} down`}
              >
                <Ionicons
                  name="chevron-down"
                  size={22}
                  color={index === sections.length - 1 ? theme.textFaint : theme.textMuted}
                />
              </Pressable>
            </View>
          );
        })}
        <Pressable onPress={() => void setSetting('homeSections', '')} style={styles.reset} accessibilityRole="button">
          <Text style={[styles.resetLabel, { color: theme.accent }]}>Reset to default</Text>
        </Pressable>
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: space.xl,
    paddingBottom: space.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    ...typography.body,
    flex: 1,
  },
  reset: {
    alignSelf: 'center',
    paddingVertical: space.md,
  },
  resetLabel: {
    ...typography.label,
    fontWeight: '600',
  },
});
