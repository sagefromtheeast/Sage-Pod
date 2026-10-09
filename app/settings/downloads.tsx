import { useState } from 'react';
import { Alert } from 'react-native';

import { useSetting } from '@/db/settings';
import { refreshAllFeeds } from '@/feed/sync';
import { formatCleanup } from '@/player/cleanup';
import { downloadedBytes, formatBytes } from '@/player/downloads';
import { formatRefresh, NEW_EPISODE_LABELS, SETTING_OPTIONS } from '@/settings/options';
import { SettingsNote, SettingsScreen } from '@/ui/settings/SettingsScreen';
import { useUpdateSetting } from '@/ui/settings/useUpdateSetting';
import { SettingsAction, SettingsChoice, SettingsOptions, SettingsSection, SettingsSwitch } from '@/ui/SettingsRow';

/** AntennaPod's Settings › Downloads: updates, mobile data, automatic downloads and cleanup. */
export default function DownloadSettings() {
  const update = useUpdateSetting();
  const [refreshing, setRefreshing] = useState(false);
  const refreshInterval = useSetting('refreshIntervalMinutes');
  const newEpisodes = useSetting('newEpisodesAction');
  const wifiOnly = useSetting('downloadOnWifiOnly');
  const mobileRefresh = useSetting('mobileRefresh');
  const mobileStreaming = useSetting('mobileStreaming');
  const autoQueue = useSetting('autoDownloadQueue');
  const autoNew = useSetting('autoDownloadNew');
  const autoLimit = useSetting('autoDownloadLimit');
  const maxEpisodes = useSetting('maxDownloadedEpisodes');
  const cleanup = useSetting('episodeCleanup');
  const deleteFinished = useSetting('deleteAfterFinished');
  const deleteRemoves = useSetting('deleteRemovesFromQueue');

  const refreshNow = async () => {
    setRefreshing(true);
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
      setRefreshing(false);
    }
  };

  return (
    <SettingsScreen>
      <SettingsSection title="Updates" />
      <SettingsOptions
        label="Refresh interval"
        description="How often podcasts are checked for new episodes, in the background and when the app opens. The system decides the exact time."
        value={refreshInterval}
        options={SETTING_OPTIONS.refreshIntervalMinutes}
        format={formatRefresh}
        onChange={(value) => void update('refreshIntervalMinutes', value)}
      />
      <SettingsOptions
        label="New episodes"
        description="Where new episodes go, unless a podcast sets its own choice."
        value={newEpisodes}
        options={SETTING_OPTIONS.newEpisodesAction}
        format={(action) => NEW_EPISODE_LABELS[action]}
        onChange={(value) => void update('newEpisodesAction', value)}
      />
      <SettingsAction
        label="Refresh all podcasts now"
        description="Check every subscription for new episodes."
        onPress={() => void refreshNow()}
        busy={refreshing}
      />

      <SettingsSection title="Mobile data" />
      <SettingsSwitch
        label="Downloads"
        description="Download automatically over mobile data. When off, auto-downloads wait for Wi-Fi and a download you start asks first."
        value={!wifiOnly}
        onValueChange={(value) => void update('downloadOnWifiOnly', !value)}
      />
      <SettingsSwitch
        label="Refresh"
        description="Check for new episodes over mobile data when the app opens. Pulling to refresh always works."
        value={mobileRefresh}
        onValueChange={(value) => void update('mobileRefresh', value)}
      />
      <SettingsSwitch
        label="Streaming"
        description="Play episodes that aren't downloaded over mobile data. When off, playing one asks first."
        value={mobileStreaming}
        onValueChange={(value) => void update('mobileStreaming', value)}
      />

      <SettingsSection title="Automatic download" />
      <SettingsSwitch
        label="Download the queue"
        description="Fetch episode audio whenever an episode is added to the queue."
        value={autoQueue}
        onValueChange={(value) => void update('autoDownloadQueue', value)}
      />
      <SettingsSwitch
        label="Download new episodes"
        description="For podcasts that don't set their own choice (Podcast settings, Auto-download)."
        value={autoNew}
        onValueChange={(value) => void update('autoDownloadNew', value)}
      />
      <SettingsOptions
        label="Episodes per podcast"
        description="Newest episodes fetched for podcasts with auto-download on."
        value={autoLimit}
        options={SETTING_OPTIONS.autoDownloadLimit}
        format={(count) => (count === 0 ? 'Off' : String(count))}
        onChange={(value) => void update('autoDownloadLimit', value)}
      />

      <SettingsSection title="Storage" />
      <SettingsOptions
        label="Episode limit"
        description="Auto-downloads stop when this many episodes are downloaded and none can be cleaned up."
        value={maxEpisodes}
        options={SETTING_OPTIONS.maxDownloadedEpisodes}
        format={(count) => (count === 0 ? 'Unlimited' : `${count} episodes`)}
        onChange={(value) => void update('maxDownloadedEpisodes', value)}
      />
      <SettingsChoice
        label="Episode cleanup"
        description="Which played downloads may be deleted automatically. Favourites and queued episodes are always kept."
        value={cleanup}
        options={SETTING_OPTIONS.episodeCleanup}
        format={formatCleanup}
        icon="trash-bin-outline"
        onChange={(value) => void update('episodeCleanup', value)}
      />
      <SettingsSwitch
        label="Delete when finished"
        description="Remove a download as soon as its episode ends. Podcasts can override this."
        value={deleteFinished}
        onValueChange={(value) => void update('deleteAfterFinished', value)}
      />
      <SettingsSwitch
        label="Delete removes from queue"
        description="Deleting a download also takes the episode out of the queue."
        value={deleteRemoves}
        onValueChange={(value) => void update('deleteRemovesFromQueue', value)}
      />
      <SettingsNote>{formatBytes(downloadedBytes())} used by downloaded episodes.</SettingsNote>
    </SettingsScreen>
  );
}
