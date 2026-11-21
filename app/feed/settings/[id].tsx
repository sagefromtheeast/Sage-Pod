import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';

import { getFeed, setFeedPrefs, setFeedUrl, type FeedPrefs } from '@/db/feeds';
import { useSetting } from '@/db/settings';
import type { FeedRow } from '@/db/types';
import { useQuery } from '@/db/useQuery';
import { splitCredentials, type FeedCredentials } from '@/feed/auth';
import { getStoredCredentials, setFeedCredentials } from '@/feed/credentials';
import { normalizeFeedUrl } from '@/feed/fetch';
import {
  boolOverride,
  globalLabel,
  NEW_EPISODE_ACTIONS,
  parseNewEpisodesAction,
  serializeTags,
  VOLUME_ADAPTATIONS,
  VOLUME_REDUCTIONS,
  volumeFor,
  type NewEpisodesAction,
  type VolumeAdaptation,
} from '@/feed/feedPrefs';
import { refreshFeed } from '@/feed/sync';
import { askForNotifications } from '@/notify';
import { PLAYBACK_RATES, player } from '@/player';
import { supportsAudioEffects } from '@/player/audioExtras';
import { showDialog } from '@/ui/Dialog';
import { SettingsOptions, SettingsSection, SettingsSwitch, SettingsTextInput } from '@/ui/SettingsRow';
import { space } from '@/ui/theme';
import { showToast } from '@/ui/UndoToast';
import { useTheme } from '@/ui/useTheme';

// Skip intro and ending are per podcast only (as in AntennaPod): there is no
// global value to inherit, so "not set" simply means Off.
const SKIP_INTRO_OPTIONS = [0, 10, 15, 30, 45, 60] as const;
const SKIP_ENDING_OPTIONS = [0, 10, 15, 30, 45, 60, 90, 120] as const;
const SPEED_OPTIONS = [-1, ...PLAYBACK_RATES] as const;
const VOLUME_LABELS: Record<VolumeAdaptation, string> = {
  1: 'Off',
  0.5: 'Light reduction',
  0.2: 'Heavy reduction',
  1.5: 'Light boost',
  2: 'Medium boost',
  2.5: 'Heavy boost',
};
// Boosts need the Android engine's loudness enhancer.
const VOLUME_OPTIONS: readonly VolumeAdaptation[] = supportsAudioEffects(Platform.OS)
  ? VOLUME_ADAPTATIONS
  : VOLUME_REDUCTIONS;
const TRI_STATE = ['global', 'on', 'off'] as const;
const ACTION_OPTIONS = ['global', ...NEW_EPISODE_ACTIONS] as const;
const ACTION_LABELS: Record<NewEpisodesAction, string> = { inbox: 'Inbox', queue: 'Add to queue', nothing: 'Nothing' };
const MIN_MINUTE_OPTIONS = [0, 5, 10, 20, 30, 45] as const;

type TriState = (typeof TRI_STATE)[number];
const toTri = (value: boolean | null | undefined): TriState => (value == null ? 'global' : value ? 'on' : 'off');
const fromTri = (value: TriState): boolean | null => (value === 'global' ? null : value === 'on');

/**
 * Per-podcast settings in AntennaPod's groups. Every setting that has a global
 * counterpart offers "Global (x)", showing what the global value is now.
 */
export default function FeedSettingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const feedId = Number(id);
  const theme = useTheme();

  const globalSpeed = useSetting('playbackRate');
  const globalAction = useSetting('newEpisodesAction');
  const globalAutoDownload = useSetting('autoDownloadNew');
  const globalAutoDelete = useSetting('deleteAfterFinished');

  const { data: feed } = useQuery<FeedRow | null>(() => getFeed(feedId), ['feeds'], [feedId]);

  const update = useCallback(
    async (prefs: Partial<FeedPrefs>) => {
      await setFeedPrefs(feedId, prefs);
      // Applies at once if one of this podcast's episodes is loaded.
      player.applyFeedPrefs(feedId, prefs, globalSpeed);
    },
    [feedId, globalSpeed]
  );

  const [login, setLogin] = useState<FeedCredentials>({ username: '', password: '' });
  useEffect(() => {
    void getStoredCredentials(feedId).then((stored) =>
      setLogin({ username: stored?.username ?? '', password: stored?.password ?? '' })
    );
  }, [feedId]);

  const saveLogin = async (next: FeedCredentials) => {
    if (!feed) return;
    setLogin(next);
    try {
      await setFeedCredentials(feedId, feed.feed_url, next);
    } catch (error) {
      showDialog("Couldn't save the login", error instanceof Error ? error.message : String(error));
      return;
    }
    // Tried at once; a refusal shows on the podcast page's banner.
    await refreshFeed({ ...feed, etag: null, last_modified: null }).catch(() => undefined);
  };

  const changeUrl = useCallback(
    async (raw: string) => {
      if (!feed || !raw) return;
      try {
        // A pasted "user:pass@" goes to the keychain, not the address.
        const { url, credentials } = splitCredentials(normalizeFeedUrl(raw));
        if (url === feed.feed_url && !credentials) return;
        await setFeedUrl(feedId, url);
        // The login moves with the podcast, now for the new address's host.
        const login = credentials ?? (await getStoredCredentials(feedId));
        if (login) await setFeedCredentials(feedId, url, login);
        if (credentials) setLogin(credentials);
        showToast('Feed address changed');
        // Reads the new address now; a failure shows on the podcast page's banner.
        await refreshFeed({ ...feed, feed_url: url, etag: null, last_modified: null }).catch(() => undefined);
      } catch (error) {
        showDialog("Couldn't change the address", error instanceof Error ? error.message : String(error));
      }
    },
    [feed, feedId]
  );

  const setNotify = async (value: boolean) => {
    await update({ notify: value });
    if (value && !(await askForNotifications())) {
      showToast('Notifications are off for Sage Pod in the system settings');
    }
  };

  if (!feed) {
    return <View style={[styles.root, { backgroundColor: theme.bg }]} />;
  }

  const action = parseNewEpisodesAction(feed.new_episodes_action);
  const onOff = (value: boolean) => (value ? 'On' : 'Off');

  return (
    <ScrollView style={[styles.root, { backgroundColor: theme.bg }]} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: 'Podcast Settings' }} />

      <SettingsSection title="Display" />
      <SettingsTextInput
        label="Name"
        description="Your name for this podcast. Leave empty to use the feed's title."
        value={feed.custom_title ?? ''}
        placeholder="Name from the feed"
        onSubmit={(value) => void update({ customTitle: value || null })}
        autoCapitalize="words"
      />
      <SettingsTextInput
        label="Tags"
        description="Separate with commas, e.g. News, Tech. The Library can filter by tag."
        value={feed.tags ?? ''}
        placeholder="No tags"
        onSubmit={(value) => void update({ tags: serializeTags(value.split(',')) || null })}
      />

      <SettingsSection title="Playback" />
      <SettingsOptions
        label="Playback speed"
        value={feed.playback_speed ?? -1}
        options={SPEED_OPTIONS}
        format={(rate) => (rate === -1 ? globalLabel(`${globalSpeed}×`) : `${rate}×`)}
        onChange={(value) => void update({ playbackSpeed: value === -1 ? null : value })}
      />
      <SettingsOptions
        label="Skip intro"
        description="Start every episode this far in."
        value={feed.skip_intro_seconds ?? 0}
        options={SKIP_INTRO_OPTIONS}
        format={(seconds) => (seconds === 0 ? 'Off' : `${seconds}s`)}
        onChange={(value) => void update({ skipIntroSeconds: value === 0 ? null : value })}
      />
      <SettingsOptions
        label="Skip ending"
        description="Treat this much of the end of each episode as finished and move on."
        value={feed.skip_ending_seconds ?? 0}
        options={SKIP_ENDING_OPTIONS}
        format={(seconds) => (seconds === 0 ? 'Off' : `${seconds}s`)}
        onChange={(value) => void update({ skipEndingSeconds: value === 0 ? null : value })}
      />
      <SettingsOptions
        label="Volume adaptation"
        description={
          supportsAudioEffects(Platform.OS)
            ? 'Quieter or louder than the rest of your podcasts.'
            : 'For podcasts that are much louder than the rest.'
        }
        value={volumeFor(feed.volume_reduction)}
        options={VOLUME_OPTIONS}
        format={(volume) => VOLUME_LABELS[volume]}
        onChange={(value) => void update({ volumeReduction: value === 1 ? null : value })}
      />

      <SettingsSection title="Notifications" />
      <SettingsSwitch
        label="Episode notifications"
        description="A notification when a refresh finds new episodes."
        value={feed.notify === 1}
        onValueChange={(value) => void setNotify(value)}
      />

      <SettingsSection title="Automation" />
      <SettingsSwitch
        label="Keep updated"
        description="Check for new episodes when refreshing all podcasts."
        value={feed.keep_updated === 1}
        onValueChange={(value) => void update({ keepUpdated: value })}
      />
      <SettingsOptions
        label="New episodes"
        description="Where this podcast's new episodes go."
        value={action ?? 'global'}
        options={ACTION_OPTIONS}
        format={(option) => (option === 'global' ? globalLabel(ACTION_LABELS[globalAction]) : ACTION_LABELS[option])}
        onChange={(value) => void update({ newEpisodesAction: value === 'global' ? null : value })}
      />
      <SettingsOptions
        label="Auto-download"
        description="Download new episodes when the podcast refreshes."
        value={toTri(boolOverride(feed.auto_download_override))}
        options={TRI_STATE}
        format={(option) => (option === 'global' ? globalLabel(onOff(globalAutoDownload)) : onOff(option === 'on'))}
        onChange={(value) => void update({ autoDownload: fromTri(value) })}
      />
      <SettingsTextInput
        label="Only download titles with"
        description="Comma-separated words; leave empty to allow any."
        value={feed.download_include ?? ''}
        placeholder="Any title"
        onSubmit={(value) => void update({ downloadInclude: value || null })}
        autoCapitalize="none"
      />
      <SettingsTextInput
        label="Never download titles with"
        description="Trailers, teasers and promos are always skipped."
        value={feed.download_exclude ?? ''}
        placeholder="e.g. bonus, live"
        onSubmit={(value) => void update({ downloadExclude: value || null })}
        autoCapitalize="none"
      />
      <SettingsOptions
        label="Shortest episode to download"
        value={feed.download_min_minutes ?? 0}
        options={MIN_MINUTE_OPTIONS}
        format={(minutes) => (minutes === 0 ? 'Default (3 min)' : `${minutes} min`)}
        onChange={(value) => void update({ downloadMinMinutes: value === 0 ? null : value })}
      />
      <SettingsOptions
        label="Auto-delete"
        description="Delete downloads once they're played."
        value={toTri(boolOverride(feed.auto_delete))}
        options={TRI_STATE}
        format={(option) => (option === 'global' ? globalLabel(onOff(globalAutoDelete)) : onOff(option === 'on'))}
        onChange={(value) => void update({ autoDelete: fromTri(value) })}
      />

      <SettingsSection title="Authentication" />
      <SettingsTextInput
        label="Username"
        value={login.username}
        onSubmit={(username) => void saveLogin({ ...login, username })}
        autoCapitalize="none"
      />
      <SettingsTextInput
        label="Password"
        description="For a password-protected feed. Kept in the phone’s secure storage and sent only to the feed’s own server."
        value={login.password}
        onSubmit={(password) => void saveLogin({ ...login, password })}
        autoCapitalize="none"
        secure
      />

      <SettingsSection title="Advanced" />
      <SettingsTextInput
        label="Feed address"
        description="Change it if the podcast moved and the old address stopped working."
        value={feed.feed_url}
        onSubmit={(value) => void changeUrl(value)}
        keyboardType="url"
        autoCapitalize="none"
      />
      <View style={styles.end} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  end: {
    height: space.xxl,
  },
});
