import { useRouter } from 'expo-router';

import { EPISODE_SORT_KEYS, EPISODE_SORT_LABELS, parseEpisodeSort, type EpisodeSortKey } from '@/db/episodes';
import { useSetting } from '@/db/settings';
import { formatTheme, SETTING_OPTIONS } from '@/settings/options';
import { SettingsScreen } from '@/ui/settings/SettingsScreen';
import { useUpdateSetting } from '@/ui/settings/useUpdateSetting';
import { SettingsChoice, SettingsLink, SettingsOptions, SettingsSection, SettingsSwitch } from '@/ui/SettingsRow';

/** AntennaPod's Settings › User interface. */
export default function InterfaceSettings() {
  const router = useRouter();
  const update = useUpdateSetting();
  const theme = useSetting('themePreference');
  const showRemaining = useSetting('showRemainingTime');
  const adjust = useSetting('adjustTimesToSpeed');
  const preferStreaming = useSetting('streamOverDownload');
  const defaultSort = parseEpisodeSort(useSetting('defaultEpisodeSort'));

  return (
    <SettingsScreen>
      <SettingsSection title="Appearance" />
      <SettingsOptions
        label="Theme"
        description="System matches your device. OLED provides pure black backgrounds."
        value={theme}
        options={SETTING_OPTIONS.themePreference}
        format={formatTheme}
        onChange={(value) => void update('themePreference', value)}
      />

      <SettingsSection title="Player" />
      <SettingsSwitch
        label="Show remaining time"
        description="The right-hand time counts down what's left. Off shows the episode's length. Tapping the time in the player switches it too."
        value={showRemaining}
        onValueChange={(value) => void update('showRemainingTime', value)}
      />
      <SettingsSwitch
        label="Adjust times to speed"
        description="At 2×, an hour-long episode shows 30 minutes: how long it takes you to listen."
        value={adjust}
        onValueChange={(value) => void update('adjustTimesToSpeed', value)}
      />

      <SettingsSection title="Episode lists" />
      <SettingsSwitch
        label="Prefer streaming"
        description="The button on each episode plays it straight away. Turn off to make it a Download button instead."
        value={preferStreaming}
        onValueChange={(value) => void update('streamOverDownload', value)}
      />
      <SettingsChoice<EpisodeSortKey>
        label="Episode order"
        description="On podcast pages, unless a podcast has its own order."
        value={defaultSort}
        options={EPISODE_SORT_KEYS}
        format={(key) => EPISODE_SORT_LABELS[key]}
        icon="swap-vertical"
        onChange={(value) => void update('defaultEpisodeSort', value)}
      />
      <SettingsLink
        icon="hand-left-outline"
        label="Swipe actions"
        description="What swiping an episode does in the Inbox, Queue, Episodes and Downloads."
        onPress={() => router.push('/settings/swipes')}
      />
    </SettingsScreen>
  );
}
