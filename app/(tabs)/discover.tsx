import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

import { listSubscribedUrls } from '@/db/feeds';
import { setSetting, useSetting } from '@/db/settings';
import { useQuery } from '@/db/useQuery';
import { BROWSE_CATEGORIES, fetchTopPodcasts, type PodcastResult } from '@/discover/itunes';
import { searchOnline } from '@/discover/online';
import { CHART_COUNTRIES, countryName, feedUrlKey, parseCountry } from '@/discover/providers';
import { previewFeed } from '@/feed/sync';
import { BottomSheet } from '@/ui/ActionSheet';
import { Artwork } from '@/ui/Artwork';
import { GlassSurface } from '@/ui/glass';
import { importOpmlFile } from '@/ui/opmlImport';
import { MINI_PLAYER_HEIGHT, radius, space, type as typography } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

/** Pause after the last keystroke before searching, so typing isn't chatty. */
const SEARCH_DEBOUNCE_MS = 400;

export default function DiscoverScreen() {
  const theme = useTheme();
  const router = useRouter();
  // "Search online" from the library search hands its words over as `q`.
  const { q } = useLocalSearchParams<{ q?: string }>();
  const country = parseCountry(useSetting('discoverCountry'));
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);

  const [term, setTerm] = useState(q ?? '');
  const [results, setResults] = useState<PodcastResult[]>([]);
  const [charts, setCharts] = useState<PodcastResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Identifies the newest search so a slow earlier request can't overwrite it.
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (q) setTerm(q);
  }, [q]);

  // Podcasts you follow: marked in search results and left out of the charts.
  const { data: subscribedRows = [] } = useQuery(() => listSubscribedUrls(), ['feeds'], []);
  const subscribed = useMemo(
    () => new Map(subscribedRows.map((feed) => [feedUrlKey(feed.feed_url), feed.id])),
    [subscribedRows]
  );

  useEffect(() => {
    let current = true;
    setCharts([]);
    // A few extra, so the chart still fills up after hiding subscribed shows.
    fetchTopPodcasts({ limit: 50, country })
      .then((found) => {
        if (current) setCharts(found);
      })
      .catch(() => {
        // The charts are a nicety; a failure here should not block search.
      });
    return () => {
      current = false;
    };
  }, [country]);

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
      searchOnline(query, country)
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
  }, [term, country]);

  const showCharts = term.trim().length === 0;
  const visibleCharts = useMemo(
    () => charts.filter((podcast) => !subscribed.has(feedUrlKey(podcast.feedUrl))).slice(0, 25),
    [charts, subscribed]
  );
  const data = showCharts ? visibleCharts : results;

  return (
    <View style={styles.root}>
      <GlassSurface
        glassEffectStyle="regular"
        isInteractive={true}
        borderRadius={radius.pill}
        style={[
          styles.searchBar,
          {
            borderColor:
              theme.scheme === 'dark'
                ? 'rgba(255, 255, 255, 0.12)'
                : 'rgba(0, 0, 0, 0.08)',
          },
        ]}
      >
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
      </GlassSurface>

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

              <View style={styles.addRow}>
                <Pressable
                  onPress={() => router.push('/add-feed')}
                  style={[styles.urlButton, { borderColor: theme.border }]}
                  accessibilityRole="button"
                >
                  <Ionicons name="link-outline" size={18} color={theme.accent} />
                  <Text style={[styles.urlLabel, { color: theme.text }]}>Add by RSS URL</Text>
                </Pressable>
                <Pressable
                  onPress={() => void importOpmlFile(router)}
                  style={[styles.urlButton, { borderColor: theme.border }]}
                  accessibilityRole="button"
                >
                  <Ionicons name="document-text-outline" size={18} color={theme.accent} />
                  <Text style={[styles.urlLabel, { color: theme.text }]}>Import OPML file</Text>
                </Pressable>
              </View>

              <View style={styles.chartHeader}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Top podcasts</Text>
                <Pressable
                  onPress={() => setCountryPickerOpen(true)}
                  style={[styles.countryChip, { backgroundColor: theme.surfaceAlt }]}
                  accessibilityRole="button"
                  accessibilityLabel={`Chart country: ${countryName(country)}. Change`}
                >
                  <Text style={[styles.chipLabel, { color: theme.text }]}>{countryName(country)}</Text>
                  <Ionicons name="chevron-down" size={14} color={theme.textMuted} />
                </Pressable>
              </View>
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
        ListFooterComponent={
          !showCharts && results.length > 0 ? (
            <Text style={[styles.credit, { color: theme.textFaint }]}>Results from Apple Podcasts and fyyd</Text>
          ) : null
        }
        renderItem={({ item }) => (
          <PodcastResultRow podcast={item} subscribedId={subscribed.get(feedUrlKey(item.feedUrl)) ?? null} />
        )}
      />

      <BottomSheet
        visible={countryPickerOpen}
        title="Country"
        subtitle="For the charts and Apple's search results"
        onClose={() => setCountryPickerOpen(false)}
      >
        <ScrollView style={styles.countryList}>
          {CHART_COUNTRIES.map((option) => {
            const selected = option.code === country;
            return (
              <Pressable
                key={option.code}
                onPress={() => {
                  void setSetting('discoverCountry', option.code);
                  setCountryPickerOpen(false);
                }}
                style={({ pressed }) => [
                  styles.countryRow,
                  { backgroundColor: pressed ? theme.surfaceAlt : 'transparent' },
                ]}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
              >
                <Text style={[styles.countryName, { color: theme.text }]}>{option.name}</Text>
                {selected ? <Ionicons name="checkmark" size={20} color={theme.accent} /> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </BottomSheet>
    </View>
  );
}

function PodcastResultRow({ podcast, subscribedId }: { podcast: PodcastResult; subscribedId: number | null }) {
  const theme = useTheme();
  const router = useRouter();
  const [adding, setAdding] = useState(false);

  const add = useCallback(async () => {
    // Already followed: straight to its page, no preview.
    if (subscribedId !== null) {
      router.push(`/feed/${subscribedId}`);
      return;
    }
    setAdding(true);
    try {
      // Opens a preview first (AntennaPod, D-003.4); its page has the Subscribe button.
      const { feedId } = await previewFeed(podcast.feedUrl);
      router.push(`/feed/${feedId}`);
    } catch (error) {
      Alert.alert(
        'Could not open podcast',
        error instanceof Error ? error.message : 'That feed could not be loaded.'
      );
    } finally {
      setAdding(false);
    }
  }, [podcast.feedUrl, router, subscribedId]);

  return (
    <Pressable
      onPress={add}
      disabled={adding}
      style={({ pressed }) => [
        styles.resultRow,
        { backgroundColor: pressed ? theme.surfaceAlt : 'transparent' },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Open ${podcast.title}`}
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
        {subscribedId !== null ? (
          <View style={styles.subscribed}>
            <Ionicons name="checkmark-circle" size={14} color={theme.accent} />
            <Text style={[styles.resultMeta, { color: theme.accent }]}>Subscribed</Text>
          </View>
        ) : (
          <Text style={[styles.resultMeta, { color: theme.textFaint }]} numberOfLines={1}>
            {[podcast.genre, podcast.episodeCount ? `${podcast.episodeCount} episodes` : null]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        )}
      </View>

      {adding ? (
        <ActivityIndicator size="small" color={theme.accent} />
      ) : (
        <Ionicons name="chevron-forward" size={22} color={theme.textMuted} />
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
    overflow: 'hidden',
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
  addRow: {
    flexDirection: 'row',
    gap: space.sm,
    marginHorizontal: space.lg,
  },
  urlButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingVertical: space.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
  },
  urlLabel: {
    ...typography.label,
    fontWeight: '600',
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
  },
  sectionTitle: {
    ...typography.subheading,
  },
  countryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
  },
  countryList: {
    maxHeight: 420,
  },
  countryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
  },
  countryName: {
    ...typography.body,
  },
  subscribed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  credit: {
    ...typography.caption,
    textAlign: 'center',
    padding: space.lg,
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
