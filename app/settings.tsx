import * as Clipboard from 'expo-clipboard';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  DEFAULT_SETTINGS,
  getSettings,
  setSetting,
  type Settings,
} from '@/db/settings';
import { exportOpml, importOpml } from '@/feed/opml';
import { refreshAllFeeds } from '@/feed/sync';
import { PLAYBACK_RATES, player } from '@/player';
import { downloadedBytes, formatBytes } from '@/player/downloads';
import {
  SettingsAction,
  SettingsOptions,
  SettingsSection,
  SettingsSwitch,
} from '@/ui/SettingsRow';
import { MINI_PLAYER_HEIGHT, space, type as typography } from '@/ui/theme';
import { useSetThemePreference, useTheme } from '@/ui/useTheme';

const SKIP_FORWARD_OPTIONS = [10, 15, 30, 45, 60] as const;
const SKIP_BACKWARD_OPTIONS = [5, 10, 15, 30] as const;
const REFRESH_OPTIONS = [15, 30, 60, 180, 720] as const;
const AUTO_DOWNLOAD_OPTIONS = [0, 1, 3, 5, 10] as const;
const EPISODE_STORAGE_OPTIONS = [10, 20, 50, 100, 0] as const;
const THEME_OPTIONS = ['system', 'light', 'dark', 'oled'] as const;

export default function SettingsScreen() {
  const theme = useTheme();
  const setThemePreference = useSetThemePreference();

  // Settings live in a module cache the player reads synchronously; this local
  // copy exists only so the screen re-renders when one changes.
  const [settings, setSettings] = useState<Settings>(() => getSettings());
  const [busy, setBusy] = useState<string | null>(null);

  const update = useCallback(async <K extends keyof Settings>(key: K, value: Settings[K]) => {
    await setSetting(key, value);
    setSettings(getSettings());
    // The playback rate must reach the engine immediately, not just on the
    // next episode, or the setting appears not to work.
    if (key === 'playbackRate') player.setRate(value as number);
    // Theme changes must propagate to every screen via context.
    if (key === 'themePreference') setThemePreference(value as Settings['themePreference']);
  }, [setThemePreference]);

  const refreshNow = useCallback(async () => {
    setBusy('refresh');
    try {
      const result = await refreshAllFeeds({ force: true });
      Alert.alert(
        'Refresh complete',
        [
          `${result.refreshed} feed${result.refreshed === 1 ? '' : 's'} checked.`,
          result.newEpisodes > 0 ? `${result.newEpisodes} new episodes.` : 'No new episodes.',
          result.failures.length > 0 ? `${result.failures.length} could not be reached.` : null,
        ]
          .filter(Boolean)
          .join('\n')
      );
    } finally {
      setBusy(null);
    }
  }, []);

  const copyOpml = useCallback(async () => {
    setBusy('opml');
    try {
      const xml = await exportOpml();
      await Clipboard.setStringAsync(xml);
      Alert.alert(
        'Subscriptions copied',
        'Your OPML subscription list is on the clipboard — paste it into a file or another podcast app.'
      );
    } finally {
      setBusy(null);
    }
  }, []);

  const importFromClipboard = useCallback(async () => {
    Alert.alert(
      'Import from clipboard',
      'Copy an OPML file to your clipboard first, then tap Import.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Import',
          onPress: async () => {
            setBusy('import');
            try {
              const xml = await Clipboard.getStringAsync();
              if (!xml || (!xml.includes('<opml') && !xml.includes('<outline'))) {
                Alert.alert(
                  'Not OPML',
                  'The clipboard does not appear to contain an OPML subscription list.'
                );
                return;
              }
              const result = await importOpml(xml);
              Alert.alert(
                'Import complete',
                [
                  result.imported > 0
                    ? `${result.imported} new subscription${result.imported === 1 ? '' : 's'} added.`
                    : null,
                  result.skipped > 0 ? `${result.skipped} already subscribed.` : null,
                  result.failures.length > 0
                    ? `${result.failures.length} could not be reached.`
                    : null,
                ]
                  .filter(Boolean)
                  .join('\n') || 'No feeds found in the OPML data.'
              );
            } finally {
              setBusy(null);
            }
          },
        },
      ]
    );
  }, []);

  const resetDefaults = useCallback(() => {
    Alert.alert('Reset settings?', 'Playback and download preferences return to their defaults.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: async () => {
          for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
            await setSetting(key, DEFAULT_SETTINGS[key]);
          }
          setSettings(getSettings());
          setThemePreference(DEFAULT_SETTINGS.themePreference);
        },
      },
    ]);
  }, [setThemePreference]);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <SettingsSection title="Appearance" />
      <SettingsOptions
        label="Theme"
        description="System matches your device. OLED provides pure black backgrounds."
        value={settings.themePreference}
        options={THEME_OPTIONS}
        format={(theme) => (theme === 'oled' ? 'OLED' : theme[0].toUpperCase() + theme.slice(1))}
        onChange={(value) => void update('themePreference', value)}
      />

      <SettingsSection title="Playback" />
      <SettingsOptions
        label="Skip forward"
        value={settings.skipForward}
        options={SKIP_FORWARD_OPTIONS}
        format={(seconds) => `${seconds}s`}
        onChange={(value) => void update('skipForward', value)}
      />
      <SettingsOptions
        label="Skip back"
        value={settings.skipBackward}
        options={SKIP_BACKWARD_OPTIONS}
        format={(seconds) => `${seconds}s`}
        onChange={(value) => void update('skipBackward', value)}
      />
      <SettingsOptions
        label="Default speed"
        description="Applied when a new episode starts."
        value={settings.playbackRate}
        options={PLAYBACK_RATES}
        format={(rate) => `${rate}×`}
        onChange={(value) => void update('playbackRate', value)}
      />
      <SettingsOptions
        label="Rewind on resume"
        description="Backs up a few seconds when you pick an episode up again."
        value={settings.resumeRewind}
        options={[0, 3, 5, 10] as const}
        format={(seconds) => (seconds === 0 ? 'Off' : `${seconds}s`)}
        onChange={(value) => void update('resumeRewind', value)}
      />
      <SettingsSwitch
        label="Play the next episode"
        description="Continue with the queue when an episode finishes."
        value={settings.continuousPlayback}
        onValueChange={(value) => void update('continuousPlayback', value)}
      />
      <SettingsSwitch
        label="Remove finished episodes"
        description="Take an episode out of the queue once it has played."
        value={settings.removeFromQueueWhenFinished}
        onValueChange={(value) => void update('removeFromQueueWhenFinished', value)}
      />

      <SettingsSection title="Downloads" />
      <SettingsSwitch
        label="Wi-Fi only"
        description="Never download episode audio over cellular data."
        value={settings.downloadOnWifiOnly}
        onValueChange={(value) => void update('downloadOnWifiOnly', value)}
      />
      <SettingsSwitch
        label="Download queue automatically"
        description="Fetch episode audio whenever an episode is added to the queue."
        value={settings.autoDownloadQueue}
        onValueChange={(value) => void update('autoDownloadQueue', value)}
      />
      <SettingsOptions
        label="Auto-download per podcast"
        description="Newest episodes fetched for podcasts with auto-download on."
        value={settings.autoDownloadLimit}
        options={AUTO_DOWNLOAD_OPTIONS}
        format={(count) => (count === 0 ? 'Off' : String(count))}
        onChange={(value) => void update('autoDownloadLimit', value)}
      />
      <SettingsOptions
        label="Storage episode limit"
        description="Keeps newest episodes and prunes oldest played episodes when full."
        value={settings.maxDownloadedEpisodes}
        options={EPISODE_STORAGE_OPTIONS}
        format={(count) => (count === 0 ? 'Unlimited' : `${count} episodes`)}
        onChange={(value) => void update('maxDownloadedEpisodes', value)}
      />
      <SettingsSwitch
        label="Delete when finished"
        description="Free up space by removing a download once its episode ends."
        value={settings.deleteAfterFinished}
        onValueChange={(value) => void update('deleteAfterFinished', value)}
      />
      <View style={styles.note}>
        <Text style={[styles.noteText, { color: theme.textFaint }]}>
          {formatBytes(downloadedBytes())} used by downloaded episodes.
        </Text>
      </View>

      <SettingsSection title="Subscriptions" />
      <SettingsOptions
        label="Refresh interval"
        description="How stale a feed must be before it is checked again."
        value={settings.refreshIntervalMinutes}
        options={REFRESH_OPTIONS}
        format={(minutes) => (minutes >= 60 ? `${minutes / 60}h` : `${minutes}m`)}
        onChange={(value) => void update('refreshIntervalMinutes', value)}
      />
      <SettingsAction
        label="Refresh all feeds now"
        description="Check every subscription for new episodes."
        onPress={() => void refreshNow()}
        busy={busy === 'refresh'}
      />
      <SettingsAction
        label="Export subscriptions (OPML)"
        description="Copy your subscription list to the clipboard."
        onPress={() => void copyOpml()}
        busy={busy === 'opml'}
      />
      <SettingsAction
        label="Import subscriptions (OPML)"
        description="Paste an OPML file from your clipboard."
        onPress={() => void importFromClipboard()}
        busy={busy === 'import'}
      />

      <SettingsSection title="About" />
      <SettingsAction label="Reset settings" onPress={resetDefaults} destructive />
      <View style={styles.note}>
        <Text style={[styles.noteText, { color: theme.textFaint }]}>
          Sage Pod — a podcast player built with Expo and React Native.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: MINI_PLAYER_HEIGHT + space.xxl,
  },
  note: {
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  noteText: {
    ...typography.caption,
    lineHeight: 17,
  },
});
