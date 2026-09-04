/** Formats a duration in seconds as `h:mm:ss` or `m:ss`. */
export function formatDuration(totalSeconds: number | null | undefined): string {
  if (totalSeconds == null || !Number.isFinite(totalSeconds) || totalSeconds < 0) return '--:--';
  const seconds = Math.floor(totalSeconds % 60);
  const minutes = Math.floor((totalSeconds / 60) % 60);
  const hours = Math.floor(totalSeconds / 3600);
  const pad = (n: number) => String(n).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

/**
 * Formats remaining time the way a listener thinks about it: whole minutes for
 * anything under an hour, `1h 05m` beyond that.
 */
export function formatRemaining(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return '';
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${Math.max(1, mins)} min left`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem === 0 ? `${hours}h left` : `${hours}h ${String(rem).padStart(2, '0')}m left`;
}

/** Relative publish date: "today", "3d ago", "12 Mar", "12 Mar 2023". */
export function formatPublishDate(epochMs: number | null | undefined): string {
  if (!epochMs) return '';
  const date = new Date(epochMs);
  if (Number.isNaN(date.getTime())) return '';

  const now = Date.now();
  const dayMs = 86_400_000;
  const days = Math.floor((now - epochMs) / dayMs);

  if (days < 0) return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;

  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  return date.toLocaleDateString(
    undefined,
    sameYear
      ? { day: 'numeric', month: 'short' }
      : { day: 'numeric', month: 'short', year: 'numeric' }
  );
}

/**
 * Parses an iTunes `<itunes:duration>` value, which feeds publish inconsistently
 * as `HH:MM:SS`, `MM:SS`, or a bare seconds count.
 */
export function parseDuration(raw: string | number | null | undefined): number | null {
  if (raw == null) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : null;

  const text = String(raw).trim();
  if (!text) return null;

  if (!text.includes(':')) {
    const asNumber = Number(text);
    return Number.isFinite(asNumber) && asNumber > 0 ? Math.floor(asNumber) : null;
  }

  const parts = text.split(':').map((p) => Number(p.trim()));
  if (parts.some((p) => !Number.isFinite(p))) return null;

  const seconds = parts.reduce((acc, part) => acc * 60 + part, 0);
  return seconds > 0 ? Math.floor(seconds) : null;
}

/** Parses an RFC-822 / ISO publish date into epoch millis. */
export function parseDate(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const parsed = Date.parse(String(raw).trim());
  return Number.isNaN(parsed) ? null : parsed;
}
