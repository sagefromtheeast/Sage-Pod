import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { listSubscribedUrls } from '@/db/feeds';
import { useQuery } from '@/db/useQuery';
import { feedUrlKey } from '@/discover/providers';
import { getOpmlDraft, importFeeds } from '@/feed/opml';
import { radius, space, type as typography } from '@/ui/theme';
import { useLayout } from '@/ui/useLayout';
import { showToast } from '@/ui/UndoToast';
import { useTheme } from '@/ui/useTheme';

/**
 * AntennaPod's OPML import checklist: every podcast in the file, ticked,
 * with the ones you already follow marked and left out. Imports one at a time
 * with progress, then summarises.
 */
export default function OpmlImportScreen() {
  const theme = useTheme();
  const router = useRouter();
  const layout = useLayout();
  const [outlines] = useState(getOpmlDraft);
  const { data: subscribed = [] } = useQuery(() => listSubscribedUrls(), ['feeds'], []);
  const followed = useMemo(() => new Set(subscribed.map((feed) => feedUrlKey(feed.feed_url))), [subscribed]);
  const [unticked, setUnticked] = useState<Set<string>>(() => new Set());
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  // The import carries on if the listener leaves; then it ends with a toast,
  // not an alert whose OK would pop whatever screen they are on now.
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    []
  );

  const available = outlines.filter((outline) => !followed.has(feedUrlKey(outline.feedUrl)));
  const chosen = available.filter((outline) => !unticked.has(outline.feedUrl));
  const allTicked = chosen.length === available.length;

  const toggle = (feedUrl: string) =>
    setUnticked((current) => {
      const next = new Set(current);
      if (next.has(feedUrl)) next.delete(feedUrl);
      else next.add(feedUrl);
      return next;
    });

  const run = async () => {
    setProgress({ done: 0, total: chosen.length });
    const result = await importFeeds(chosen, (done, total) => {
      if (mounted.current) setProgress({ done, total });
    });
    if (!mounted.current) {
      showToast(
        `Import finished: ${result.imported} podcast${result.imported === 1 ? '' : 's'} added` +
          (result.failures.length > 0 ? `, ${result.failures.length} couldn't be reached` : '')
      );
      return;
    }
    setProgress(null);
    const lines = [
      `${result.imported} podcast${result.imported === 1 ? '' : 's'} added.`,
      result.failures.length > 0
        ? `${result.failures.length} couldn't be reached:\n${result.failures.map((f) => `• ${f.title}`).join('\n')}`
        : null,
    ].filter(Boolean);
    Alert.alert('Import finished', lines.join('\n\n'), [{ text: 'OK', onPress: () => router.back() }]);
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <Stack.Screen options={{ title: 'Import podcasts' }} />
      <View style={[styles.header, { paddingHorizontal: layout.gutter, borderBottomColor: theme.border }]}>
        <Text style={[styles.summary, { color: theme.textMuted }]}>
          {outlines.length} in the file
          {outlines.length > available.length ? ` · ${outlines.length - available.length} already followed` : ''}
        </Text>
        {available.length > 0 ? (
          <Pressable
            onPress={() => setUnticked(allTicked ? new Set(available.map((o) => o.feedUrl)) : new Set())}
            hitSlop={8}
            accessibilityRole="button"
            disabled={progress !== null}
          >
            <Text style={[styles.link, { color: theme.accent }]}>{allTicked ? 'Select none' : 'Select all'}</Text>
          </Pressable>
        ) : null}
      </View>

      <FlatList
        data={outlines}
        keyExtractor={(outline) => outline.feedUrl}
        extraData={[unticked, followed]}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: theme.textMuted }]}>Nothing to import. Pick an OPML file first.</Text>
        }
        renderItem={({ item }) => {
          const already = followed.has(feedUrlKey(item.feedUrl));
          const ticked = !already && !unticked.has(item.feedUrl);
          return (
            <Pressable
              onPress={() => toggle(item.feedUrl)}
              disabled={already || progress !== null}
              style={({ pressed }) => [
                styles.row,
                { paddingHorizontal: layout.gutter, backgroundColor: pressed ? theme.surfaceAlt : 'transparent' },
              ]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: ticked, disabled: already }}
            >
              <Ionicons
                name={already ? 'checkmark-circle' : ticked ? 'checkbox' : 'square-outline'}
                size={22}
                color={already ? theme.textFaint : ticked ? theme.accent : theme.textMuted}
              />
              <View style={styles.rowText}>
                <Text style={[styles.title, { color: already ? theme.textMuted : theme.text }]} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={[styles.url, { color: theme.textFaint }]} numberOfLines={1}>
                  {already ? 'Already following' : item.feedUrl}
                </Text>
              </View>
            </Pressable>
          );
        }}
      />

      <View style={[styles.footer, { paddingHorizontal: layout.gutter, borderTopColor: theme.border }]}>
        <Pressable
          onPress={() => void run()}
          disabled={chosen.length === 0 || progress !== null}
          style={[styles.button, { backgroundColor: theme.accent, opacity: chosen.length === 0 ? 0.5 : 1 }]}
          accessibilityRole="button"
        >
          {progress ? (
            <View style={styles.progress}>
              <ActivityIndicator size="small" color={theme.onAccent} />
              <Text style={[styles.buttonLabel, { color: theme.onAccent }]}>
                Importing {Math.min(progress.done + 1, progress.total)} of {progress.total}…
              </Text>
            </View>
          ) : (
            <Text style={[styles.buttonLabel, { color: theme.onAccent }]}>
              {chosen.length === 0 ? 'Nothing selected' : `Import ${chosen.length} podcast${chosen.length === 1 ? '' : 's'}`}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  summary: { ...typography.caption },
  link: { ...typography.label, fontWeight: '600' },
  list: { paddingVertical: space.xs },
  empty: { ...typography.body, textAlign: 'center', padding: space.xl },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  rowText: { flex: 1, gap: 2 },
  title: { ...typography.body, fontWeight: '600' },
  url: { ...typography.caption },
  footer: { paddingVertical: space.md, borderTopWidth: StyleSheet.hairlineWidth },
  button: { alignItems: 'center', justifyContent: 'center', minHeight: 48, borderRadius: radius.pill },
  progress: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  buttonLabel: { ...typography.subheading },
});
