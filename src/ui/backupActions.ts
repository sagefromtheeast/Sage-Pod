import { reloadAppAsync } from 'expo';
import { Directory, File } from 'expo-file-system';
import { Alert } from 'react-native';

import {
  checkBackup,
  exportFileName,
  exportMimeType,
  favouritesHtml,
  subscriptionsHtml,
  type ExportKind,
} from '@/backup/formats';
import {
  discardStagedBackup,
  exportDatabaseBytes,
  listFavouritesForExport,
  listFeedsForExport,
  restoreStagedBackup,
  stageBackup,
} from '@/db/backup';
import { LATEST_SCHEMA_VERSION } from '@/db/schema';
import { exportOpml } from '@/feed/opml';
import { player } from '@/player';
import { showToast } from '@/ui/UndoToast';

/** The pickers reject, rather than resolve, when the listener backs out. */
function wasCancelled(error: unknown): boolean {
  return error instanceof Error && /cancel/i.test(error.message);
}

function explain(title: string, error: unknown): void {
  Alert.alert(title, error instanceof Error ? error.message : String(error));
}

async function contentFor(kind: ExportKind): Promise<string | Uint8Array> {
  switch (kind) {
    case 'opml':
      return exportOpml();
    case 'html':
      return subscriptionsHtml(await listFeedsForExport());
    case 'favourites':
      return favouritesHtml(await listFavouritesForExport());
    case 'database':
      return exportDatabaseBytes();
  }
}

/**
 * A new file in the picked folder. Android renames a taken name itself; iOS
 * refuses it, so a second export on the same day replaces the first there.
 */
function createIn(folder: Directory, name: string, mimeType: string): File {
  try {
    return folder.createFile(name, mimeType);
  } catch (error) {
    const existing = new File(folder, name);
    if (existing.exists) return existing;
    throw error;
  }
}

/**
 * AntennaPod's exports: the listener picks a folder (the system picker, so
 * Downloads, a cloud drive or a USB stick all work) and the file is written
 * there. Resolves to whether a file was saved.
 */
export async function exportToFolder(kind: ExportKind): Promise<boolean> {
  let folder: Directory;
  try {
    folder = await Directory.pickDirectoryAsync();
  } catch (error) {
    if (!wasCancelled(error)) explain("Couldn't open the folder picker", error);
    return false;
  }
  try {
    const name = exportFileName(kind, Date.now());
    const file = createIn(folder, name, exportMimeType(kind));
    file.write(await contentFor(kind));
    showToast(`Saved ${name}`);
    return true;
  } catch (error) {
    explain("Couldn't save the export", error);
    return false;
  }
}

/**
 * AntennaPod's "Database import": pick a backup, check it, warn, then replace
 * everything and restart. Nothing changes until the listener confirms.
 */
export async function importDatabase(): Promise<void> {
  let bytes: Uint8Array;
  try {
    const picked = await File.pickFileAsync({ mimeTypes: '*/*' });
    if (!picked || picked.canceled) return;
    bytes = await picked.result.bytes();
  } catch (error) {
    if (!wasCancelled(error)) explain("Couldn't read that file", error);
    return;
  }

  let staged: Awaited<ReturnType<typeof stageBackup>>;
  try {
    staged = await stageBackup(bytes);
  } catch (error) {
    explain("Couldn't read that file", error);
    return;
  }
  const check = checkBackup(staged.info, LATEST_SCHEMA_VERSION);
  if (!check.ok) {
    await discardStagedBackup(staged);
    Alert.alert("Can't restore this file", check.reason);
    return;
  }

  const { feeds, episodes } = staged.info;
  Alert.alert(
    'Replace everything?',
    `This backup has ${feeds} podcast${feeds === 1 ? '' : 's'} and ${episodes} episode${episodes === 1 ? '' : 's'}. ` +
      'It replaces all of Sage Pod’s data on this phone: subscriptions, queue, progress, history and settings. ' +
      'Sage Pod restarts afterwards. Export a database backup first if you might want today’s data back.',
    [
      { text: 'Cancel', style: 'cancel', onPress: () => void discardStagedBackup(staged) },
      {
        text: 'Replace and restart',
        style: 'destructive',
        onPress: () =>
          void (async () => {
            try {
              await player.release();
              await restoreStagedBackup(staged);
              await reloadAppAsync('Restored a database backup');
            } catch (error) {
              // The player has let go of its episode, so restart either way;
              // a failed restore leaves the old data in place.
              Alert.alert("Couldn't restore the backup", error instanceof Error ? error.message : String(error), [
                { text: 'Restart', onPress: () => void reloadAppAsync('Restore failed') },
              ]);
            }
          })(),
      },
    ],
    { cancelable: true, onDismiss: () => void discardStagedBackup(staged) }
  );
}
