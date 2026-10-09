import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import { autoBackupDue, backupsToDelete, fileNameFromUri } from '@/backup/schedule';
import { exportFileName, exportMimeType } from '@/backup/formats';
import { exportDatabaseBytes } from '@/db/backup';
import { getMeta, getSettings, setMeta } from '@/db/settings';

/**
 * A new file in the picked folder. Android renames a taken name itself; iOS
 * refuses it, so a second export on the same day replaces the first there.
 */
export function createIn(folder: Directory, name: string, mimeType: string): File {
  try {
    return folder.createFile(name, mimeType);
  } catch (error) {
    const existing = new File(folder, name);
    if (existing.exists) return existing;
    throw error;
  }
}

const FOLDER_KEY = 'autoBackupFolder';
const LAST_KEY = 'lastAutoBackupAt';

/**
 * Android keeps access to a folder picked once, so automatic backups go where
 * the listener chose. iOS forgets a picked folder when the app restarts, so
 * there they go to Sage Pod's own Backups folder, shown in the Files app.
 */
export const autoBackupFolderIsPicked = Platform.OS === 'android';

/** The picked folder's URI on Android; null until one is picked. */
export function autoBackupFolderUri(): Promise<string | null> {
  return getMeta(FOLDER_KEY);
}

/** Asks for the folder automatic backups go to. Resolves to whether one was picked. */
export async function pickAutoBackupFolder(): Promise<boolean> {
  const folder = await Directory.pickDirectoryAsync();
  await setMeta(FOLDER_KEY, folder.uri);
  return true;
}

async function autoBackupFolder(): Promise<Directory | null> {
  if (autoBackupFolderIsPicked) {
    const uri = await getMeta(FOLDER_KEY);
    return uri ? new Directory(uri) : null;
  }
  const folder = new Directory(Paths.document, 'Backups');
  if (!folder.exists) folder.create({ idempotent: true });
  return folder;
}

/** When the last automatic backup was written, or null if none has been. */
export async function lastAutoBackupAt(): Promise<number | null> {
  const value = await getMeta(LAST_KEY);
  return value == null ? null : Number(value);
}

let running: Promise<boolean> | null = null;

/**
 * AntennaPod's automatic backup: the database every 3 days, keeping the
 * newest 5 in the folder. Runs from the background task and when the app
 * opens; resolves to whether a backup was written.
 */
export function runAutoBackupIfDue(now = Date.now()): Promise<boolean> {
  running ??= (async () => {
    try {
      if (Platform.OS === 'web' || !getSettings().autoBackup) return false;
      if (!autoBackupDue(await lastAutoBackupAt(), now)) return false;
      const folder = await autoBackupFolder();
      if (!folder) return false;

      const file = createIn(folder, exportFileName('database', now), exportMimeType('database'));
      file.write(await exportDatabaseBytes());
      await setMeta(LAST_KEY, String(now));

      const stale = new Set(
        backupsToDelete(folder.list().flatMap((entry) => (entry instanceof File ? [fileNameFromUri(entry.uri)] : [])))
      );
      for (const entry of folder.list()) {
        if (entry instanceof File && stale.has(fileNameFromUri(entry.uri))) entry.delete();
      }
      return true;
    } finally {
      running = null;
    }
  })();
  return running;
}
