import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { isFavorite, toggleFavorite } from '@/db/episodes';
import { setSetting, SKIP_AMOUNTS, useSetting } from '@/db/settings';
import { useQuery } from '@/db/useQuery';
import { player, usePlayerState } from '@/player';
import { currentChapterIndex, nextChapterTarget, prevChapterTarget } from '@/player/chapters';
import { describeTimer } from '@/player/sleepTimer';
import { formatSpeed } from '@/player/speed';
import { useChapters } from '@/player/useChapters';
import { ActionSheet } from '@/ui/ActionSheet';
import { Artwork } from '@/ui/Artwork';
import { triggerHaptic } from '@/ui/haptics';
import { OverflowMenu } from '@/ui/OverflowMenu';
import { ChaptersSheet } from '@/ui/player/ChaptersSheet';
import { SeekBar } from '@/ui/player/SeekBar';
import { SleepSheet } from '@/ui/player/SleepSheet';
import { SpeedSheet } from '@/ui/player/SpeedSheet';
import { radius, space, type as typography } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';
import { shareEpisode } from '@/util/share';

type Sheet = 'speed' | 'sleep' | 'chapters' | 'skipBackward' | 'skipForward' | null;

/** Artwork never grows past this, so tablets keep room for the controls. */
const MAX_ARTWORK = 360;

export default function PlayerScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();

  const { episode, position, duration, playing, buffering, rate, sleepTimer, error } =
    usePlayerState();
  const { chapters } = useChapters(episode?.chapters_url);
  const skipBackward = useSetting('skipBackward');
  const skipForward = useSetting('skipForward');
  const episodeId = episode?.id ?? null;
  const { data: favorite = false } = useQuery(
    () => (episodeId === null ? Promise.resolve(false) : isFavorite(episodeId)),
    ['episodes'],
    [episodeId]
  );

  const [sheet, setSheet] = useState<Sheet>(null);
  // While the seek bar is dragged, chapter title and art follow the finger.
  const [scrub, setScrub] = useState<number | null>(null);

  if (!episode) {
    return (
      <View style={[styles.empty, { backgroundColor: theme.bg }]}>
        <Text style={[styles.emptyText, { color: theme.textMuted }]}>Nothing is playing.</Text>
        <Pressable onPress={() => router.back()} accessibilityRole="button">
          <Text style={[styles.emptyAction, { color: theme.accent }]}>Close</Text>
        </Pressable>
      </View>
    );
  }

  const shown = scrub ?? position;
  const chapterIndex = currentChapterIndex(chapters, shown);
  const chapter = chapterIndex >= 0 ? chapters[chapterIndex] : null;
  const nextChapter = nextChapterTarget(chapters, position);
  const artwork = chapter?.img ?? episode.image_url ?? episode.feed_image_url;
  const artworkSize = Math.max(160, Math.min(window.width - space.xl * 2, window.height * 0.4, MAX_ARTWORK));
  const sleepLabel = sleepTimer ? describeTimer(sleepTimer, Date.now()) : null;

  const seek = (seconds: number) => void player.seekTo(seconds);
  const openPodcast = () => {
    router.back();
    router.push(`/feed/${episode.feed_id}`);
  };
  const openNotes = () => {
    router.back();
    router.push(`/episode/${episode.id}`);
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + space.xl },
        ]}
      >
        <View style={styles.topBar}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Close player"
          >
            <Ionicons name="chevron-down" size={28} color={theme.textMuted} />
          </Pressable>
          <View style={styles.topBarRight}>
            <Pressable
              onPress={() => {
                triggerHaptic('light');
                void toggleFavorite(episode.id);
              }}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={favorite ? 'Remove from favourites' : 'Add to favourites'}
              accessibilityState={{ selected: favorite }}
            >
              <Ionicons
                name={favorite ? 'heart' : 'heart-outline'}
                size={24}
                color={favorite ? theme.accent : theme.textMuted}
              />
            </Pressable>
            <Pressable
              onPress={() => setSheet('sleep')}
              hitSlop={10}
              style={[styles.sleepIcon, sleepLabel ? { backgroundColor: theme.accent } : null]}
              accessibilityRole="button"
              accessibilityLabel={sleepLabel ? `Sleep timer. ${sleepLabel.long}` : 'Sleep timer'}
            >
              <Ionicons
                name={sleepLabel ? 'moon' : 'moon-outline'}
                size={sleepLabel ? 15 : 22}
                color={sleepLabel ? theme.onAccent : theme.textMuted}
              />
              {sleepLabel ? (
                <Text style={[styles.sleepLabel, { color: theme.onAccent }]}>{sleepLabel.short}</Text>
              ) : null}
            </Pressable>
            <OverflowMenu
              color={theme.textMuted}
              title={episode.title}
              items={[
                { key: 'podcast', label: 'Open podcast', icon: 'albums-outline', onPress: openPodcast },
                ...(episode.link
                  ? [
                      {
                        key: 'website',
                        label: 'Visit website',
                        icon: 'globe-outline' as const,
                        onPress: () => void Linking.openURL(episode.link!),
                      },
                    ]
                  : []),
                {
                  key: 'share',
                  label: 'Share…',
                  icon: 'share-outline',
                  onPress: () =>
                    void shareEpisode({
                      title: episode.title,
                      podcastTitle: episode.feed_title,
                      url: episode.link ?? episode.media_url,
                      positionSeconds: position,
                    }),
                },
              ]}
            />
          </View>
        </View>

        <Pressable
          onPress={() => {
            triggerHaptic('medium');
            player.togglePlayPause();
          }}
          style={styles.artworkWrap}
          accessibilityRole="button"
          accessibilityLabel={playing ? 'Artwork. Pause.' : 'Artwork. Play.'}
        >
          <Artwork uri={artwork} size={artworkSize} borderRadius={radius.xl} />
        </Pressable>

        <View style={styles.titles}>
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={3}>
            {episode.title}
          </Text>
          <Pressable onPress={openPodcast} hitSlop={6} accessibilityRole="link">
            <Text style={[styles.podcast, { color: theme.accent }]} numberOfLines={1}>
              {episode.feed_title}
            </Text>
          </Pressable>
        </View>

        {chapters.length > 0 ? (
          <View style={styles.chapterRow}>
            <Pressable
              onPress={() => seek(prevChapterTarget(chapters, position, rate))}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Previous chapter"
            >
              <Ionicons name="play-skip-back" size={20} color={theme.textMuted} />
            </Pressable>
            <Pressable
              onPress={() => setSheet('chapters')}
              style={[styles.chapterTitle, { backgroundColor: theme.surfaceAlt }]}
              accessibilityRole="button"
              accessibilityLabel={`Chapter: ${chapter?.title || 'none'}. Show all chapters.`}
            >
              <Ionicons name="list" size={16} color={theme.textMuted} />
              <Text style={[styles.chapterText, { color: theme.text }]} numberOfLines={1}>
                {chapter ? chapter.title || `Chapter ${chapterIndex + 1}` : 'Chapters'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => nextChapter !== null && seek(nextChapter)}
              disabled={nextChapter === null}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Next chapter"
              style={{ opacity: nextChapter === null ? 0.35 : 1 }}
            >
              <Ionicons name="play-skip-forward" size={20} color={theme.textMuted} />
            </Pressable>
          </View>
        ) : null}

        {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}

        <SeekBar position={position} duration={duration} chapters={chapters} onSeek={seek} onScrub={setScrub} />

        <View style={styles.transport}>
          <Pressable
            onPress={() => setSheet('speed')}
            hitSlop={8}
            style={[styles.speed, { backgroundColor: theme.surfaceAlt }]}
            accessibilityRole="button"
            accessibilityLabel={`Playback speed ${formatSpeed(rate)}. Change speed.`}
          >
            <Text style={[styles.speedLabel, { color: theme.text }]} numberOfLines={1} adjustsFontSizeToFit>
              {formatSpeed(rate)}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              triggerHaptic('light');
              void player.skipBackward();
            }}
            onLongPress={() => setSheet('skipBackward')}
            hitSlop={10}
            style={styles.skip}
            accessibilityRole="button"
            accessibilityLabel={`Skip back ${skipBackward} seconds`}
            accessibilityHint="Long press to change the amount"
          >
            <Ionicons name="play-back" size={30} color={theme.text} />
            <Text style={[styles.skipLabel, { color: theme.textFaint }]}>{skipBackward}</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              triggerHaptic('medium');
              player.togglePlayPause();
            }}
            style={[styles.playButton, { backgroundColor: theme.accent }]}
            accessibilityRole="button"
            accessibilityLabel={playing ? 'Pause' : 'Play'}
          >
            <Ionicons
              name={buffering && !playing ? 'ellipsis-horizontal' : playing ? 'pause' : 'play'}
              size={34}
              color={theme.onAccent}
              style={!playing && !buffering ? styles.playGlyph : undefined}
            />
          </Pressable>

          <Pressable
            onPress={() => {
              triggerHaptic('light');
              void player.skipForward();
            }}
            onLongPress={() => setSheet('skipForward')}
            hitSlop={10}
            style={styles.skip}
            accessibilityRole="button"
            accessibilityLabel={`Skip forward ${skipForward} seconds`}
            accessibilityHint="Long press to change the amount"
          >
            <Ionicons name="play-forward" size={30} color={theme.text} />
            <Text style={[styles.skipLabel, { color: theme.textFaint }]}>{skipForward}</Text>
          </Pressable>

          <Pressable
            onPress={() => void player.skipToNext()}
            hitSlop={8}
            style={styles.next}
            accessibilityRole="button"
            accessibilityLabel="Skip to next in queue"
          >
            <Ionicons name="play-skip-forward" size={22} color={theme.text} />
          </Pressable>
        </View>

        <Pressable
          onPress={openNotes}
          style={[styles.notes, { borderColor: theme.border }]}
          accessibilityRole="button"
        >
          <Ionicons name="document-text-outline" size={18} color={theme.textMuted} />
          <Text style={[styles.notesLabel, { color: theme.text }]}>Show notes</Text>
        </Pressable>
      </ScrollView>

      <SpeedSheet
        visible={sheet === 'speed'}
        rate={rate}
        feedTitle={episode.feed_playback_speed !== null ? episode.feed_title : null}
        onClose={() => setSheet(null)}
      />
      <SleepSheet visible={sheet === 'sleep'} timer={sleepTimer} onClose={() => setSheet(null)} />
      <ChaptersSheet
        visible={sheet === 'chapters'}
        chapters={chapters}
        position={position}
        onSeek={seek}
        onClose={() => setSheet(null)}
      />
      <SkipAmountSheet
        kind={sheet === 'skipBackward' || sheet === 'skipForward' ? sheet : null}
        current={sheet === 'skipForward' ? skipForward : skipBackward}
        onClose={() => setSheet(null)}
      />
    </View>
  );
}

/** Long-press on rewind / forward: pick how far it skips (saved as the global setting). */
function SkipAmountSheet({
  kind,
  current,
  onClose,
}: {
  kind: 'skipBackward' | 'skipForward' | null;
  current: number;
  onClose: () => void;
}) {
  // Remember the last kind so the sheet keeps its title while it fades out.
  const [shownKind, setShownKind] = useState<'skipBackward' | 'skipForward'>('skipBackward');
  if (kind !== null && kind !== shownKind) setShownKind(kind);

  return (
    <ActionSheet
      visible={kind !== null}
      title={shownKind === 'skipForward' ? 'Skip forward by' : 'Skip back by'}
      items={SKIP_AMOUNTS.map((seconds) => ({
        key: String(seconds),
        label: `${seconds} seconds`,
        icon: shownKind === 'skipForward' ? 'play-forward-outline' : 'play-back-outline',
        selected: seconds === current,
        onPress: () => void setSetting(shownKind, seconds),
      }))}
      onClose={onClose}
    />
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: space.xl,
    gap: space.lg,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
  },
  emptyText: {
    ...typography.body,
  },
  emptyAction: {
    ...typography.subheading,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
  },
  sleepIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    minHeight: 26,
    paddingHorizontal: space.xs,
    borderRadius: radius.pill,
  },
  sleepLabel: {
    ...typography.caption,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    paddingRight: 2,
  },
  artworkWrap: {
    alignItems: 'center',
    paddingVertical: space.sm,
  },
  titles: {
    alignItems: 'center',
    gap: space.xs,
  },
  title: {
    ...typography.heading,
    textAlign: 'center',
    lineHeight: 26,
  },
  podcast: {
    ...typography.label,
    fontWeight: '600',
  },
  chapterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  chapterTitle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
  },
  chapterText: {
    ...typography.label,
    flex: 1,
  },
  error: {
    ...typography.caption,
    textAlign: 'center',
  },
  transport: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  speed: {
    width: 56,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xs,
  },
  speedLabel: {
    ...typography.label,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  skip: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipLabel: {
    ...typography.caption,
    fontSize: 10,
    marginTop: -4,
  },
  playButton: {
    width: 76,
    height: 76,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playGlyph: {
    marginLeft: 4,
  },
  next: {
    width: 56,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notes: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    alignSelf: 'center',
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: space.sm,
  },
  notesLabel: {
    ...typography.label,
    fontWeight: '600',
  },
});
