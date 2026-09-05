import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { getSettings, setSetting } from '@/db/settings';
import { palettes, resolvePalette, type Palette, type ThemePreference } from './theme';

type ThemeContextValue = {
  palette: Palette;
  preference: ThemePreference;
  /** Update the active theme and persist the setting. */
  setThemePreference: (pref: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({
  initialPreference,
  children,
}: {
  initialPreference?: ThemePreference;
  children: ReactNode;
}) {
  const systemScheme = useColorScheme();
  const [pref, setPref] = useState<ThemePreference>(
    () => initialPreference ?? getSettings().themePreference
  );

  const setThemePreference = useCallback((next: ThemePreference) => {
    setPref(next);
    void setSetting('themePreference', next);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      palette: resolvePalette(pref, systemScheme),
      preference: pref,
      setThemePreference,
    }),
    [pref, systemScheme, setThemePreference]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Resolves the active palette from user settings and the OS colour scheme. */
export function useTheme(): Palette {
  const ctx = useContext(ThemeContext);
  return ctx?.palette ?? palettes.dark;
}

export function useThemePreference(): [ThemePreference, (pref: ThemePreference) => void] {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemePreference must be used within ThemeProvider');
  return [ctx.preference, ctx.setThemePreference];
}

export function useSetThemePreference(): (pref: ThemePreference) => void {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useSetThemePreference must be used within ThemeProvider');
  return ctx.setThemePreference;
}
