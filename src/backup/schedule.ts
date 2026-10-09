/**
 * AntennaPod's automatic database backup: one every 3 days, keeping the
 * newest 5 in the chosen folder. Pure, so the rules are tested without a phone.
 */

export const AUTO_BACKUP_EVERY_MS = 3 * 24 * 60 * 60 * 1000;
export const AUTO_BACKUP_KEEP = 5;

/** The system won't wake a background task more often than every 15 minutes. */
export const MIN_BACKGROUND_MINUTES = 15;

export function autoBackupDue(lastAt: number | null, now: number): boolean {
  return lastAt == null || !Number.isFinite(lastAt) || now - lastAt >= AUTO_BACKUP_EVERY_MS || lastAt > now;
}

/**
 * A file's name from its URI. Android's folder picker hands out content URIs
 * whose last segment is an encoded document id ("primary%3ADownload%2Fx.db").
 */
export function fileNameFromUri(uri: string): string {
  const last = uri.replace(/\/+$/, '').split('/').pop() ?? '';
  let decoded = last;
  try {
    decoded = decodeURIComponent(last);
  } catch {
    // Not percent-encoded after all.
  }
  return decoded.split(/[/:]/).pop() ?? decoded;
}

/** "sagepod-backup-2026-10-09.db", or Android's renamed copy "sagepod-backup-2026-10-09 (1).db". */
const BACKUP_NAME = /^sagepod-backup-(\d{4}-\d{2}-\d{2})(?: \((\d+)\))?\.db$/;

/**
 * The backups beyond the newest `keep`, to delete. Only Sage Pod's own backup
 * names count: anything else in the folder is never touched.
 */
export function backupsToDelete(names: readonly string[], keep = AUTO_BACKUP_KEEP): string[] {
  const backups = names.flatMap((name) => {
    const match = BACKUP_NAME.exec(name);
    return match ? [{ name, day: match[1], copy: Number(match[2] ?? 0) }] : [];
  });
  backups.sort((a, b) => (a.day === b.day ? b.copy - a.copy : a.day < b.day ? 1 : -1));
  return backups.slice(keep).map((backup) => backup.name);
}

/** How often the background refresh asks to run, from the refresh interval setting. */
export function backgroundIntervalMinutes(refreshIntervalMinutes: number): number {
  return Math.max(MIN_BACKGROUND_MINUTES, refreshIntervalMinutes);
}
