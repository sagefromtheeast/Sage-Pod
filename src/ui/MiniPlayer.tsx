import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { player, usePlayerState } from '@/player';

import { Artwork } from './Artwork';
import { MINI_PLAYER_HEIGHT, radius, space, type as typography } from './theme';
import { useTheme } from './useTheme';

/**
 * The persistent player bar above the tab bar.
 *
 * Renders nothing when no episode is loaded, so the tab bar sits flush on a
 * fresh install. Tapping it opens the full player.
 */
export function MiniPlayer() {
  const theme = useTheme();
  const router = useRouter();
  const { episode, playing, position, duration, buffering } = usePlayerState();

  if (!episode) return null;

  const progress = duration > 0 ? Math.min(1, position / duration) : 0;
  const artwork = episode.image_url ?? episode.feed_image_url;

  return (
    <View style={[styles.wrapper, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
      {/* A hairline of progress along the top edge — visible at a glance
          without spending any of the bar's limited height. */}
      <View style={[styles.progressTrack, { backgroundColor: theme.track }]}>
        <View
          style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: theme.accent }]}
        />
      </View>

      <Pressable
        onPress={() => router.push('/player')}
        style={styles.content}
        accessibilityRole="button"
        accessibilityLabel={`Now playing: ${episode.title}. Open player.`}
      >
        <Artwork uri={artwork} size={44} borderRadius={radius.sm} />

        <View style={styles.text}>
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
            {episode.title}
          </Text>
          <Text style={[styles.subtitle, { color: theme.textMuted }]} numberOfLines={1}>
            {episode.feed_title}
          </Text>
        </View>

        <Pressable
          onPress={() => void player.skipBackward()}
          hitSlop={10}
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel="Skip backward"
        >
          <Ionicons name="play-back" size={20} color={theme.textMuted} />
        </Pressable>

        <Pressable
          onPress={() => player.togglePlayPause()}
          hitSlop={10}
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel={playing ? 'Pause' : 'Play'}
        >
          <Ionicons
            name={buffering && !playing ? 'ellipsis-horizontal' : playing ? 'pause' : 'play'}
            size={26}
            color={theme.accent}
          />
        </Pressable>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  progressTrack: {
    height: 2,
    width: '100%',
  },
  progressFill: {
    height: '100%',
  },
  content: {
    height: MINI_PLAYER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.md,
  },
  text: {
    flex: 1,
    gap: 1,
  },
  title: {
    ...typography.label,
    fontWeight: '600',
  },
  subtitle: {
    ...typography.caption,
  },
  iconButton: {
    padding: space.xs,
  },
});
