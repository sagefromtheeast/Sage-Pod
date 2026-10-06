import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { currentChapterIndex, type Chapter } from '@/player/chapters';
import { BottomSheet } from '@/ui/ActionSheet';
import { radius, space, type as typography } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';
import { formatDuration } from '@/util/time';

type Props = {
  visible: boolean;
  chapters: readonly Chapter[];
  position: number;
  onSeek: (seconds: number) => void;
  onClose: () => void;
};

/** Every chapter with its start time; the playing one is highlighted and tapping one jumps there. */
export function ChaptersSheet({ visible, chapters, position, onSeek, onClose }: Props) {
  const theme = useTheme();
  const active = currentChapterIndex(chapters, position);

  return (
    <BottomSheet visible={visible} title="Chapters" subtitle={`${chapters.length} chapters`} onClose={onClose}>
      <ScrollView bounces={false} contentContainerStyle={styles.list}>
        {chapters.map((chapter, index) => {
          const current = index === active;
          return (
            <Pressable
              key={`${chapter.startTime}-${index}`}
              onPress={() => {
                onSeek(chapter.startTime);
                onClose();
              }}
              style={({ pressed }) => [
                styles.row,
                { backgroundColor: current ? theme.accentSoft : pressed ? theme.surfaceAlt : 'transparent' },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: current }}
            >
              <Text style={[styles.time, { color: current ? theme.accent : theme.textMuted }]}>
                {formatDuration(chapter.startTime)}
              </Text>
              <Text style={[styles.title, { color: current ? theme.text : theme.textMuted }]} numberOfLines={2}>
                {chapter.title || `Chapter ${index + 1}`}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: space.md,
    paddingBottom: space.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    borderRadius: radius.md,
  },
  time: {
    ...typography.caption,
    fontVariant: ['tabular-nums'],
    minWidth: 48,
  },
  title: {
    ...typography.body,
    flex: 1,
  },
});
