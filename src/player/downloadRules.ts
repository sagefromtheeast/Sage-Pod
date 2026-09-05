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

export const KNOWN_AUDIO_EXTENSIONS = new Set([
  'mp3',
  'm4a',
  'aac',
  'ogg',
  'opus',
  'wav',
  'flac',
  'm4b',
  'mp4',
]);

export function guessExtension(mimeType: string | null | undefined): string {
  if (!mimeType) return 'mp3';
  const lower = mimeType.toLowerCase();
  if (lower.includes('mp4') || lower.includes('m4a') || lower.includes('aac')) return 'm4a';
  if (lower.includes('ogg')) return 'ogg';
  if (lower.includes('opus')) return 'opus';
  if (lower.includes('wav')) return 'wav';
  if (lower.includes('flac')) return 'flac';
  return 'mp3';
}

/** Derives a stable, collision-free filename for an episode. */
export function fileNameFor(episode: {
  id: number;
  media_url: string;
  media_type?: string | null;
}): string {
  const fromUrl = /\.([a-z0-9]{2,5})(?:\?|#|$)/i.exec(episode.media_url)?.[1]?.toLowerCase();
  const extension =
    fromUrl && KNOWN_AUDIO_EXTENSIONS.has(fromUrl)
      ? fromUrl
      : guessExtension(episode.media_type);
  return `episode-${episode.id}.${extension}`;
}

