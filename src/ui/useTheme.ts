import { useColorScheme } from 'react-native';

import { getSettings } from '@/db/settings';
import { palettes, type Palette } from './theme';

/** Resolves the active palette from user settings and the OS colour scheme. */
export function useTheme(): Palette {
  const systemScheme = useColorScheme();
  const pref = getSettings().themePreference;

  if (pref === 'light') return palettes.light;
  if (pref === 'dark') return palettes.dark;
  if (pref === 'oled') return palettes.oled;

  return systemScheme === 'light' ? palettes.light : palettes.dark;
}
