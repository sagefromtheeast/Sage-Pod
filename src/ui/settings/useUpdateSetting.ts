import { useCallback } from 'react';

import { setSetting, type Settings } from '@/db/settings';
import { player } from '@/player';
import { useSetThemePreference } from '@/ui/useTheme';

/**
 * Saves a setting from a Settings screen, plus the two that must take effect
 * at once rather than on next use: the speed reaches the engine, and the theme
 * reaches every screen through context.
 */
export function useUpdateSetting() {
  const setThemePreference = useSetThemePreference();
  return useCallback(
    async <K extends keyof Settings>(key: K, value: Settings[K]) => {
      await setSetting(key, value);
      if (key === 'playbackRate') player.setRate(value as number);
      if (key === 'themePreference') setThemePreference(value as Settings['themePreference']);
    },
    [setThemePreference]
  );
}
