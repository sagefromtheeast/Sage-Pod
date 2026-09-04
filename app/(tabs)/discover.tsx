import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  BROWSE_CATEGORIES,
  fetchTopPodcasts,
  searchPodcasts,
  type PodcastResult,
} from '@/discover/itunes';
import { subscribe } from '@/feed/sync';
import { Artwork } from '@/ui/Artwork';
import { MINI_PLAYER_HEIGHT, radius, space, type as typography } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

/** Pause after the last keystroke before searching, so typing isn't chatty. */
const SEARCH_DEBOUNCE_MS = 400;

export default function DiscoverScreen() {
  const theme = useTheme();
  const router = useRouter();

  const [term, setTerm] = useState('');
  const [results, setResults] = useState<PodcastResult[]>([]);
  const [charts, setCharts] = useState<PodcastResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Identifies the newest search so a slow earlier request can't overwrite it.
  const requestIdRef = useRef(0);

  useEffect(() => {
    fetchTopPodcasts({ limit: 25 })
      .then(setCharts)
      .catch(() => {
        // The charts are a nicety; a failure here should not block search.
      });
  }, []);

  useEffect(() => {
    const query = term.trim();
    if (!query) {
      setResults([]);
      setError(null);
      setSearching(false);
      return;
    }

    setSearching(true);
    const requestId = ++requestIdRef.current;

    const handle = setTimeout(() => {
      searchPodcasts(query)
        .then((found) => {
          if (requestId !== requestIdRef.current) return;
          setResults(found);
          setError(null);
        })
        .catch((err: unknown) => {
          if (requestId !== requestIdRef.current) return;
          setResults([]);
          setError(err instanceof Error ? err.message : 'Search failed.');
        })
        .finally(() => {
          if (requestId === requestIdRef.current) setSearching(false);
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(handle);
  }, [term]);

  const showCharts = term.trim().length === 0;
  const data = showCharts ? charts : results;

  return (
    <View style={styles.root}>
      <View style={[styles.searchBar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Ionicons name="search" size={18} color={theme.textFaint} />
        <TextInput
          value={term}
          onChangeText={setTerm}
          placeholder="Search podcasts"
          placeholderTextColor={theme.textFaint}
          style={[styles.searchInput, { color: theme.text }]}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={() => Keyboard.dismiss()}
          clearButtonMode="while-editing"
          accessibilityLabel="Search podcasts"
        />
        {searching ? <ActivityIndicator size="small" color={theme.textFaint} /> : null}
      </View>

      <FlatList
        data={data}
        keyExtractor={(podcast) => podcast.id}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          showCharts ? (
            <View style={styles.headerBlock}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chips}
              >
                {BROWSE_CATEGORIES.map((category) => (
                  <Pressable
                    key={category}
                    onPress={() => setTerm(category)}
                    style={[styles.chip, { backgroundColor: theme.surfaceAlt }]}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.chipLabel, { color: theme.text }]}>{category}</Text>
                  </Pressable>
                ))}
              </ScrollView>

              <Pressable
                onPress={() => router.push('/add-feed')}
                style={[styles.urlButton, { borderColor: theme.border }]}
                accessibilityRole="button"
              >
                <Ionicons name="link-outline" size={18} color={theme.accent} />
                <Text style={[styles.urlLabel, { color: theme.text }]}>Add by RSS URL</Text>
              </Pressable>

              {charts.length > 0 ? (
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Top podcasts</Text>
              ) : null}
            </View>
          ) : null
        }
        ListEmptyComponent={
          error ? (
            <Text style={[styles.message, { color: theme.danger }]}>{error}</Text>
          ) : searching ? null : term.trim() ? (
            <Text style={[styles.message, { color: theme.textMuted }]}>
              Nothing found for “{term.trim()}”.
            </Text>
          ) : (
            <ActivityIndicator style={styles.loader} color={theme.textFaint} />
          )
        }
        renderItem={({ item }) => <PodcastResultRow podcast={item} />}
      />
    </View>
  );
}

function PodcastResultRow({ podcast }: { podcast: PodcastResult }) {
  const theme = useTheme();
  const router = useRouter();
  const [adding, setAdding] = useState(false);

  const add = useCallback(async () => {
    setAdding(true);
    try {
      const { feedId } = await subscribe(podcast.feedUrl);
      router.push(`/feed/${feedId}`);
    } catch (error) {
      Alert.alert(
        'Could not subscribe',
        error instanceof Error ? error.message : 'That feed could not be loaded.'
      );
    } finally {
      setAdding(false);
    }
  }, [podcast.feedUrl, router]);

  return (
    <Pressable
      onPress={add}
      disabled={adding}
      style={({ pressed }) => [
        styles.resultRow,
        { backgroundColor: pressed ? theme.surfaceAlt : 'transparent' },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Subscribe to ${podcast.title}`}
    >
      <Artwork uri={podcast.artworkUrl} size={56} />

      <View style={styles.resultBody}>
        <Text style={[styles.resultTitle, { color: theme.text }]} numberOfLines={2}>
          {podcast.title}
        </Text>
        {podcast.author ? (
          <Text style={[styles.resultMeta, { color: theme.textMuted }]} numberOfLines={1}>
            {podcast.author}
          </Text>
        ) : null}
        <Text style={[styles.resultMeta, { color: theme.textFaint }]} numberOfLines={1}>
          {[podcast.genre, podcast.episodeCount ? `${podcast.episodeCount} episodes` : null]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      </View>

      {adding ? (
        <ActivityIndicator size="small" color={theme.accent} />
      ) : (
        <Ionicons name="add-circle-outline" size={24} color={theme.accent} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginHorizontal: space.lg,
    marginTop: space.sm,
    marginBottom: space.xs,
    paddingHorizontal: space.md,
    height: 42,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    paddingVertical: 0,
  },
  content: {
    paddingBottom: MINI_PLAYER_HEIGHT + space.xl,
  },
  headerBlock: {
    gap: space.md,
    paddingTop: space.sm,
  },
  chips: {
    paddingHorizontal: space.lg,
    gap: space.sm,
  },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
  },
  chipLabel: {
    ...typography.label,
  },
  urlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    marginHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
  },
  urlLabel: {
    ...typography.label,
    fontWeight: '600',
  },
  sectionTitle: {
    ...typography.subheading,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  resultBody: {
    flex: 1,
    gap: 2,
  },
  resultTitle: {
    ...typography.body,
    fontWeight: '600',
  },
  resultMeta: {
    ...typography.caption,
  },
  message: {
    ...typography.body,
    textAlign: 'center',
    padding: space.xl,
  },
  loader: {
    paddingVertical: space.xxl,
  },
});
