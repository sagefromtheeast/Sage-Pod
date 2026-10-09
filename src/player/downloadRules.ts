// Relative, not '@/': the node test runner resolves this file too.
import { shouldAutoDownload } from '../feed/feedPrefs';

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
 * Whether an episode is suitable for automated background download, with no
 * podcast-specific rules: skips trailers, teasers, promos and clips under three
 * minutes. Manual downloads bypass this check. (Per-podcast rules: see
 * `shouldAutoDownload` in src/feed/feedPrefs.ts, which this delegates to.)
 */
export function shouldAutoDownloadEpisode(episode: { title: string; duration?: number | null }): boolean {
  return shouldAutoDownload(episode);
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

