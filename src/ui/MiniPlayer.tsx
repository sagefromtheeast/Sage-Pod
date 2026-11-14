import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { player, usePlayerState } from '@/player';

import { Artwork } from './Artwork';
import { GlassSurface, useGlassEffects } from './glass';
import { MINI_PLAYER_HEIGHT, radius, space, type as typography } from './theme';
import { useTheme } from './useTheme';

/**
 * The persistent player bar above the tab bar.
 *
 * Docked by default: a solid strip across the full width with the progress
 * line along its top, AntennaPod's player bar. With Settings › User interface ›
 * Glass effects on, it floats as a glass capsule instead.
 * Renders nothing when no episode is loaded.
 * Tapping it opens the full player.
 */
export function MiniPlayer() {
  const theme = useTheme();
  const router = useRouter();
  const { episode, playing, position, duration, buffering } = usePlayerState();
  const glass = useGlassEffects();

  if (!episode) return null;

  const progress = duration > 0 ? Math.min(1, position / duration) : 0;
  const artwork = episode.image_url ?? episode.feed_image_url;

  const Surface = glass ? GlassSurface : DockedSurface;
  return (
    <View style={glass ? styles.container : undefined}>
      <Surface
        glassEffectStyle="regular"
        isInteractive={true}
        borderRadius={radius.lg}
        style={[
          styles.surface,
          {
            borderColor:
              theme.scheme === 'dark'
                ? 'rgba(255, 255, 255, 0.12)'
                : 'rgba(0, 0, 0, 0.08)',
            shadowColor: theme.scheme === 'dark' ? '#000' : theme.textMuted,
          },
        ]}
      >
        {/* A hairline of progress along the top edge */}
        <View
          style={[
            styles.progressTrack,
            {
              backgroundColor:
                theme.scheme === 'dark'
                  ? 'rgba(255, 255, 255, 0.08)'
                  : 'rgba(0, 0, 0, 0.06)',
            },
          ]}
        >
          <View
            style={[
              styles.progressFill,
              { width: `${progress * 100}%`, backgroundColor: theme.accent },
            ]}
          />
        </View>

        <Pressable
          onPress={() => router.push('/player')}
          style={styles.content}
          accessibilityRole="button"
          accessibilityLabel={`Now playing: ${episode.title}. Open player.`}
        >
          <Artwork uri={artwork} size={42} borderRadius={radius.sm} />

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

          <Pressable
            onPress={() => void player.skipForward()}
            hitSlop={10}
            style={styles.iconButton}
            accessibilityRole="button"
            accessibilityLabel="Skip forward"
          >
            <Ionicons name="play-forward" size={20} color={theme.textMuted} />
          </Pressable>
        </Pressable>
      </Surface>
    </View>
  );
}

/** The solid strip used when glass is off. */
function DockedSurface({ children }: { children: React.ReactNode } & Record<string, unknown>) {
  const theme = useTheme();
  return <View style={[styles.docked, { backgroundColor: theme.surface }]}>{children}</View>;
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: space.md,
    marginBottom: space.xs,
  },
  surface: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 6,
  },
  docked: {
    overflow: 'hidden',
  },
  progressTrack: {
    height: 2,
    width: '100%',
  },
  progressFill: {
    height: '100%',
  },
  content: {
    height: MINI_PLAYER_HEIGHT - 6,
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
