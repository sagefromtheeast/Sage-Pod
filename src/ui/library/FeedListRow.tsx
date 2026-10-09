import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { LibraryFeed } from '@/db/types';
import { counterValue, type LibraryCounter } from '@/library/libraryView';
import { Artwork } from '@/ui/Artwork';
import { radius, space, type as typography } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

/** A podcast as a list row: the Library's list layout and the archive. */
export function FeedListRow({
  feed,
  counter,
  selecting = false,
  selected = false,
  onPress,
  onLongPress,
}: {
  feed: LibraryFeed;
  counter: LibraryCounter;
  selecting?: boolean;
  selected?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const theme = useTheme();
  const count = counterValue(feed, counter);
  const counted: Record<LibraryCounter, string> = {
    unplayed: 'unplayed',
    inbox: 'in the inbox',
    downloaded: 'downloaded',
    downloaded_unplayed: 'downloaded, unplayed',
    none: '',
  };
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
      style={({ pressed }) => [
        styles.listRow,
        {
          backgroundColor: pressed || selected ? theme.surfaceAlt : 'transparent',
          borderBottomColor: theme.border,
        },
      ]}
      accessibilityRole={selecting ? 'checkbox' : 'button'}
      accessibilityState={selecting ? { checked: selected } : undefined}
    >
      <Artwork uri={feed.image_url} size={52} borderRadius={radius.md} />
      <View style={styles.listRowBody}>
        <Text style={[styles.listRowTitle, { color: theme.text }]} numberOfLines={1}>
          {feed.title}
        </Text>
        {feed.author ? (
          <Text style={[styles.listRowSubtitle, { color: theme.textMuted }]} numberOfLines={1}>
            {feed.author}
          </Text>
        ) : null}
        <Text style={[styles.listRowMeta, { color: feed.last_refresh_error ? theme.danger : theme.textFaint }]}>
          {feed.last_refresh_error
            ? 'Last refresh failed'
            : `${counter !== 'none' && count > 0 ? `${count} ${counted[counter]} · ` : ''}${feed.episode_count} episode${
                feed.episode_count === 1 ? '' : 's'
              }`}
        </Text>
      </View>
      {selecting ? (
        <Ionicons
          name={selected ? 'checkmark-circle' : 'ellipse-outline'}
          size={24}
          color={selected ? theme.accent : theme.textMuted}
        />
      ) : (
        <Ionicons name="chevron-forward" size={18} color={theme.textFaint} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  listRowBody: {
    flex: 1,
    gap: 2,
  },
  listRowTitle: {
    ...typography.body,
    fontWeight: '600',
  },
  listRowSubtitle: {
    ...typography.caption,
  },
  listRowMeta: {
    ...typography.caption,
    fontSize: 11,
    marginTop: 2,
  },
});
