/**
 * Per-podcast settings rules (AntennaPod's feed preferences), pure so they can
 * be tested: overrides that fall back to a global value, the skip-ending
 * check, the auto-download filter and tags.
 */

/**
 * A per-podcast value that is either set or follows the global setting.
 * `null` (or undefined) means "use the global value".
 */
export type FeedOverride<T> = T | null | undefined;

export function resolveOverride<T>(value: FeedOverride<T>, global: T): { value: T; inherited: boolean } {
  return value === null || value === undefined ? { value: global, inherited: true } : { value, inherited: false };
}

/** The label for the "follow global" choice, showing what that resolves to: "Global (1.5×)". */
export function globalLabel(globalDisplay: string): string {
  return `Global (${globalDisplay})`;
}

/** 0/1/null from SQLite → boolean override. */
export const boolOverride = (value: number | null | undefined): FeedOverride<boolean> =>
  value === null || value === undefined ? null : value === 1;

/**
 * Whether playback has reached a podcast's "skip ending" point: within the
 * last `skipEndingSeconds` of a known duration. A skip as long as the episode
 * (or longer) is ignored, as in AntennaPod, so a bad setting can't skip
 * everything.
 */
export function shouldSkipEnding(position: number, duration: number, skipEndingSeconds: number | null): boolean {
  if (!skipEndingSeconds || skipEndingSeconds <= 0 || duration <= 0) return false;
  if (skipEndingSeconds >= duration) return false;
  return position >= duration - skipEndingSeconds;
}

/** AntennaPod's volume reduction choices: off, light (half) and heavy (a fifth). */
export const VOLUME_REDUCTIONS = [1, 0.5, 0.2] as const;
export type VolumeReduction = (typeof VOLUME_REDUCTIONS)[number];

export function volumeFor(reduction: number | null | undefined): VolumeReduction {
  return (VOLUME_REDUCTIONS as readonly number[]).includes(reduction ?? 1) ? ((reduction ?? 1) as VolumeReduction) : 1;
}

export type NewEpisodesAction = 'inbox' | 'queue' | 'nothing';
export const NEW_EPISODE_ACTIONS: readonly NewEpisodesAction[] = ['inbox', 'queue', 'nothing'];

export function parseNewEpisodesAction(raw: string | null | undefined): NewEpisodesAction | null {
  return NEW_EPISODE_ACTIONS.includes(raw as NewEpisodesAction) ? (raw as NewEpisodesAction) : null;
}

/** Comma-separated words or phrases → trimmed, lower-cased, de-duplicated list. */
export function parseWords(raw: string | null | undefined): string[] {
  const words = (raw ?? '')
    .split(',')
    .map((word) => word.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(words)];
}

/** Tags keep their case for display but are compared without it. */
export function parseTags(raw: string | null | undefined): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const tag of (raw ?? '').split(',').map((part) => part.trim())) {
    if (!tag || seen.has(tag.toLowerCase())) continue;
    seen.add(tag.toLowerCase());
    tags.push(tag);
  }
  return tags;
}

export function serializeTags(tags: readonly string[]): string {
  return parseTags(tags.join(',')).join(', ');
}

export type DownloadRules = {
  /** Only download episodes whose title contains one of these (empty = any). */
  include: string[];
  /** Never download episodes whose title contains one of these. */
  exclude: string[];
  /** Skip episodes shorter than this many minutes (0 = no minimum). */
  minMinutes: number;
};

export const DEFAULT_DOWNLOAD_RULES: DownloadRules = { include: [], exclude: [], minMinutes: 0 };

/** Titles that are almost never worth downloading automatically, whatever the podcast's rules. */
const ALWAYS_EXCLUDED = [/\btrailer\b/i, /\bteaser\b/i, /\bpromo\b/i, /\bsneak peek\b/i];
/** Clips under this length are skipped when the podcast sets no minimum of its own. */
const DEFAULT_MIN_SECONDS = 180;

/**
 * AntennaPod's auto-download episode filter, plus Sage Pod's built-in skip of
 * trailers and short clips. Manual downloads ignore all of this.
 */
export function shouldAutoDownload(
  episode: { title: string; duration?: number | null },
  rules: DownloadRules = DEFAULT_DOWNLOAD_RULES
): boolean {
  const title = episode.title.toLowerCase();
  if (ALWAYS_EXCLUDED.some((pattern) => pattern.test(episode.title))) return false;
  if (rules.exclude.some((word) => title.includes(word))) return false;
  if (rules.include.length > 0 && !rules.include.some((word) => title.includes(word))) return false;
  const minSeconds = rules.minMinutes > 0 ? rules.minMinutes * 60 : DEFAULT_MIN_SECONDS;
  if (episode.duration != null && episode.duration > 0 && episode.duration < minSeconds) return false;
  return true;
}
