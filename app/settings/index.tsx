import { useRouter } from 'expo-router';
import { Alert } from 'react-native';

import { DEFAULT_SETTINGS, setSetting, type Settings } from '@/db/settings';
import { player } from '@/player';
import { SettingsScreen } from '@/ui/settings/SettingsScreen';
import { SettingsAction, SettingsLink, SettingsSection } from '@/ui/SettingsRow';
import { useSetThemePreference } from '@/ui/useTheme';

/**
 * Settings, split into pages the way AntennaPod's are: each row opens one
 * area, with a summary of what lives there.
 */
export default function SettingsIndex() {
  const router = useRouter();
  const setThemePreference = useSetThemePreference();

  const resetDefaults = () => {
    Alert.alert('Reset settings?', 'Every preference returns to its default. Podcasts and episodes are kept.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: async () => {
          for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
            await setSetting(key, DEFAULT_SETTINGS[key]);
          }
          setThemePreference(DEFAULT_SETTINGS.themePreference);
          player.setRate(DEFAULT_SETTINGS.playbackRate);
        },
      },
    ]);
  };

  return (
    <SettingsScreen>
      <SettingsLink
        icon="color-palette-outline"
        label="User interface"
        description="Theme, player times, swipe actions, episode order"
        onPress={() => router.push('/settings/interface')}
      />
      <SettingsLink
        icon="play-circle-outline"
        label="Playback"
        description="Skip amounts, speed, queue, marking as played"
        onPress={() => router.push('/settings/playback')}
      />
      <SettingsLink
        icon="arrow-down-circle-outline"
        label="Downloads"
        description="Refresh, mobile data, auto-download, cleanup"
        onPress={() => router.push('/settings/downloads')}
      />
      <SettingsLink
        icon="swap-horizontal-outline"
        label="Import and export"
        description="OPML subscription lists"
        onPress={() => router.push('/settings/import-export')}
      />
      <SettingsLink
        icon="information-circle-outline"
        label="About"
        description="Version, privacy, open-source licences"
        onPress={() => router.push('/settings/about')}
      />

      <SettingsSection title="Reset" />
      <SettingsAction label="Reset settings" onPress={resetDefaults} destructive />
    </SettingsScreen>
  );
}
