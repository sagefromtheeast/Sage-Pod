import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { startDownloads } from '@/actions/startDownloads';
import { clearDownloadLog, listDownloadLog } from '@/db/downloadLog';
import { getEpisode } from '@/db/episodes';
import { useQuery } from '@/db/useQuery';
import { logDetails, type DownloadLogRow } from '@/player/downloadView';
import { BottomSheet } from '@/ui/ActionSheet';
import { radius, space, type as typography } from '@/ui/theme';
import { showToast } from '@/ui/UndoToast';
import { useTheme } from '@/ui/useTheme';
import { formatPublishDate } from '@/util/time';

const when = (ms: number) => {
  const date = new Date(ms);
  return `${formatPublishDate(ms)}, ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

/**
 * AntennaPod's download log: every finished and failed download, newest
 * first. Tap an entry for its details, which can be copied, and Retry for a
 * failed one.
 */
export function DownloadLogSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useTheme();
  const [open, setOpen] = useState<DownloadLogRow | null>(null);
  // Read only while shown: the sheet stays mounted on the Downloads screen.
  const { data: entries = [] } = useQuery(
    () => (visible ? listDownloadLog() : Promise.resolve([])),
    ['download_log'],
    [visible]
  );

  const close = () => {
    setOpen(null);
    onClose();
  };

  const retry = async (entry: DownloadLogRow) => {
    const episode = await getEpisode(entry.episode_id);
    if (!episode) {
      showToast('That episode is no longer on this device');
      return;
    }
    if (episode.download_state === 'done') {
      showToast('Already downloaded');
      return;
    }
    if (episode.download_state === 'queued' || episode.download_state === 'downloading') {
      showToast('Already downloading');
      return;
    }
    if (await startDownloads([episode.id])) {
      setOpen(null);
      showToast('Downloading again');
    }
  };

  // One sheet whose content switches between the list and an entry's details:
  // iOS can't present a second modal while the first is still closing.
  return (
    <BottomSheet
      visible={visible}
      title={open ? (open.status === 'failed' ? 'Download failed' : 'Downloaded') : 'Download log'}
      subtitle={
        open
          ? open.episode_title
          : entries.length === 0
            ? undefined
            : `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`
      }
      onClose={close}
    >
      {open ? (
        <View style={styles.details}>
          <Text selectable style={[styles.detailsText, { color: theme.text, backgroundColor: theme.surfaceAlt }]}>
            {logDetails(open, when)}
          </Text>
          <View style={styles.buttons}>
            <Pressable
              onPress={() => {
                void Clipboard.setStringAsync(logDetails(open, when));
                showToast('Details copied');
              }}
              style={[styles.button, { borderColor: theme.border }]}
              accessibilityRole="button"
            >
              <Ionicons name="copy-outline" size={18} color={theme.text} />
              <Text style={[styles.buttonLabel, { color: theme.text }]}>Copy details</Text>
            </Pressable>
            {open.status === 'failed' ? (
              <Pressable
                onPress={() => void retry(open)}
                style={[styles.button, { backgroundColor: theme.accent, borderColor: theme.accent }]}
                accessibilityRole="button"
              >
                <Ionicons name="refresh" size={18} color={theme.onAccent} />
                <Text style={[styles.buttonLabel, { color: theme.onAccent }]}>Retry</Text>
              </Pressable>
            ) : null}
          </View>
          <Pressable onPress={() => setOpen(null)} style={styles.clear} accessibilityRole="button">
            <Text style={[styles.link, { color: theme.accent }]}>Back to the log</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {entries.length === 0 ? (
            <Text style={[styles.empty, { color: theme.textMuted }]}>Finished and failed downloads are listed here.</Text>
          ) : (
            entries.map((entry) => {
              const failed = entry.status === 'failed';
              return (
                <Pressable
                  key={entry.id}
                  onPress={() => setOpen(entry)}
                  style={({ pressed }) => [styles.row, { backgroundColor: pressed ? theme.surfaceAlt : 'transparent' }]}
                  accessibilityRole="button"
                >
                  <Ionicons
                    name={failed ? 'alert-circle' : 'checkmark-circle'}
                    size={20}
                    color={failed ? theme.danger : theme.accent}
                  />
                  <View style={styles.rowText}>
                    <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
                      {entry.episode_title}
                    </Text>
                    <Text style={[styles.meta, { color: failed ? theme.danger : theme.textMuted }]} numberOfLines={1}>
                      {failed
                        ? (entry.error_message ?? 'Failed')
                        : [entry.feed_title, when(entry.created_at)].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={theme.textFaint} />
                </Pressable>
              );
            })
          )}
          {entries.length > 0 ? (
            <Pressable onPress={() => void clearDownloadLog()} style={styles.clear} accessibilityRole="button">
              <Text style={[styles.link, { color: theme.accent }]}>Clear log</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  list: { maxHeight: 460 },
  listContent: { paddingBottom: space.md },
  empty: { ...typography.body, textAlign: 'center', padding: space.xl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
  },
  rowText: { flex: 1, gap: 2 },
  title: { ...typography.body, fontWeight: '600' },
  meta: { ...typography.caption },
  clear: { alignSelf: 'center', paddingVertical: space.md },
  link: { ...typography.label, fontWeight: '600' },
  details: { gap: space.md, paddingHorizontal: space.xl, paddingBottom: space.md },
  detailsText: { ...typography.caption, padding: space.md, borderRadius: radius.md, lineHeight: 18 },
  buttons: { flexDirection: 'row', gap: space.sm },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    minHeight: 44,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  buttonLabel: { ...typography.label, fontWeight: '600' },
});
