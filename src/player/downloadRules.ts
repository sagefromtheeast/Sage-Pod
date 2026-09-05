const AUTO_DOWNLOAD_EXCLUDED_PATTERNS = [
  /\btrailer\b/i,
  /\bteaser\b/i,
  /\bpromo\b/i,
  /\bsneak peek\b/i,
];

/** Human-readable byte count, e.g. "1.4 GB". */
export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return '0 MB';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value < 10 && unit > 1 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}

/**
 * Decides whether an episode is suitable for automated background download.
 * Filters out promotional clips, trailers, teasers, and micro-clips (< 3 mins / 180s).
 * Manual downloads bypass this check.
 */
export function shouldAutoDownloadEpisode(episode: {
  title: string;
  duration?: number | null;
}): boolean {
  for (const pattern of AUTO_DOWNLOAD_EXCLUDED_PATTERNS) {
    if (pattern.test(episode.title)) {
      return false;
    }
  }

  // Minimum duration threshold: ignore episodes shorter than 3 minutes (180s)
  // if duration is known and positive.
  if (episode.duration != null && episode.duration > 0 && episode.duration < 180) {
    return false;
  }

  return true;
}
