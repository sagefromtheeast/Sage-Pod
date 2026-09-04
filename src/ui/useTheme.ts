import { useColorScheme } from 'react-native';

import { palettes, type Palette } from './theme';

/** Resolves the active palette from the OS colour scheme. */
export function useTheme(): Palette {
  const scheme = useColorScheme();
  return scheme === 'light' ? palettes.light : palettes.dark;
}
