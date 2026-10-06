/**
 * Sage Pod design tokens.
 *
 * A single palette object per scheme keeps every screen consistent and makes
 * the light/dark swap a one-line lookup (`useTheme()`), rather than scattering
 * `useColorScheme()` conditionals through the component tree.
 */
export type ColorScheme = 'light' | 'dark' | 'oled';

export type Palette = {
  scheme: ColorScheme;
  /** App background, behind everything. */
  bg: string;
  /** Cards, rows, sheets that sit on `bg`. */
  surface: string;
  /** Pressed/selected state for a `surface`. */
  surfaceAlt: string;
  /** Hairlines and dividers. */
  border: string;
  /** Primary body copy. */
  text: string;
  /** Secondary copy: timestamps, bylines, metadata. */
  textMuted: string;
  /** Tertiary copy: disabled state, faint hints. */
  textFaint: string;
  /** Brand green — play buttons, active tab, progress fill. */
  accent: string;
  /** Text/icon colour that sits legibly on `accent`. */
  onAccent: string;
  /** A faint wash of `accent` behind the row that is playing. */
  accentSoft: string;
  /** Destructive actions. */
  danger: string;
  /** Track behind a progress fill. */
  track: string;
  /** Scrim over artwork for legibility. */
  scrim: string;
};

const dark: Palette = {
  scheme: 'dark',
  bg: '#0E1512',
  surface: '#17201C',
  surfaceAlt: '#1F2A25',
  border: '#26332C',
  text: '#ECF3EE',
  textMuted: '#9BAAA1',
  textFaint: '#6B7A72',
  accent: '#4ADE80',
  onAccent: '#06291A',
  accentSoft: 'rgba(74, 222, 128, 0.10)',
  danger: '#F87171',
  track: '#2A3830',
  scrim: 'rgba(14, 21, 18, 0.72)',
};

const light: Palette = {
  scheme: 'light',
  bg: '#F7FAF8',
  surface: '#FFFFFF',
  surfaceAlt: '#EDF3EF',
  border: '#DDE7E1',
  text: '#101A15',
  textMuted: '#5A6A62',
  textFaint: '#8A9992',
  accent: '#16A34A',
  onAccent: '#FFFFFF',
  accentSoft: 'rgba(22, 163, 74, 0.10)',
  danger: '#DC2626',
  track: '#DFE9E3',
  scrim: 'rgba(247, 250, 248, 0.78)',
};

const oled: Palette = {
  scheme: 'oled',
  bg: '#000000',
  surface: '#0A0A0A',
  surfaceAlt: '#141414',
  border: '#1F1F1F',
  text: '#F5F5F5',
  textMuted: '#A0A0A0',
  textFaint: '#666666',
  accent: '#4ADE80',
  onAccent: '#000000',
  accentSoft: 'rgba(74, 222, 128, 0.10)',
  danger: '#F87171',
  track: '#1C1C1C',
  scrim: 'rgba(0, 0, 0, 0.85)',
};

export const palettes: Record<ColorScheme, Palette> = { light, dark, oled };

export type ThemePreference = ColorScheme | 'system';

/** Resolves the active palette from user preference and the system OS colour scheme. */
export function resolvePalette(
  pref: ThemePreference,
  systemScheme?: string | null
): Palette {
  if (pref === 'light') return palettes.light;
  if (pref === 'dark') return palettes.dark;
  if (pref === 'oled') return palettes.oled;
  return systemScheme === 'light' ? palettes.light : palettes.dark;
}

/** Spacing scale, in points. Multiples of 4 keep vertical rhythm predictable. */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

export const type = {
  title: { fontSize: 28, fontWeight: '700' },
  heading: { fontSize: 20, fontWeight: '700' },
  subheading: { fontSize: 16, fontWeight: '600' },
  body: { fontSize: 15, fontWeight: '400' },
  label: { fontSize: 13, fontWeight: '500' },
  caption: { fontSize: 12, fontWeight: '400' },
} as const;

/**
 * Window width breakpoints in dp, following Material's compact / medium /
 * expanded window classes (AntennaPod switches layouts at sw600 and sw720).
 */
export const breakpoints = {
  medium: 600,
  expanded: 840,
} as const;

export type WindowClass = 'compact' | 'medium' | 'expanded';

export type WindowSizes = {
  /** Horizontal page padding. */
  gutter: number;
  /** Artwork on Surprise Me cards. */
  shelfArtwork: number;
  /** Artwork on Continue Listening cards. */
  continueArtwork: number;
  /** Width of a card in a horizontal shelf, and the minimum in a card grid. */
  shelfCardWidth: number;
  /** Width of a Continue Listening card. */
  continueCardWidth: number;
  /** Subscription tile on the Home shelf (compact only; wider windows use a grid). */
  feedTile: number;
};

/** Size tokens that grow with the window, so tablets don't get phone-sized tiles. */
export const windowSizes: Record<WindowClass, WindowSizes> = {
  compact: {
    gutter: space.lg,
    shelfArtwork: 64,
    continueArtwork: 48,
    shelfCardWidth: 300,
    continueCardWidth: 260,
    feedTile: 72,
  },
  medium: {
    gutter: space.xl,
    shelfArtwork: 88,
    continueArtwork: 64,
    shelfCardWidth: 360,
    continueCardWidth: 320,
    feedTile: 104,
  },
  expanded: {
    // AntennaPod adds 56dp of side padding on very wide windows.
    gutter: 56,
    shelfArtwork: 96,
    continueArtwork: 72,
    shelfCardWidth: 340,
    continueCardWidth: 340,
    feedTile: 120,
  },
};

/** Content stops widening here and centres, so lines stay readable on big screens. */
export const MAX_CONTENT_WIDTH = 1040;

/** Smallest podcast tile a grid will shrink to before it drops a column. */
export const MIN_GRID_TILE = 150;

/** Height of the mini player, so screens can pad their scroll content past it. */
export const MINI_PLAYER_HEIGHT = 64;
