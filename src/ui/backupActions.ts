import { reloadAppAsync } from 'expo';
import { Directory, File } from 'expo-file-system';

import { createIn } from '@/backup/files';
import { exportFileName, exportMimeType, favouritesHtml, subscriptionsHtml, type ExportKind } from '@/backup/formats';
import {
  discardStagedBackup,
  exportDatabaseBytes,
  listFavouritesForExport,
  listFeedsForExport,
  restoreStagedBackup,
  stageBackup,
} from '@/db/backup';
import { exportOpml } from '@/feed/opml';
import { isRefreshing } from '@/feed/sync';
import { player } from '@/player';
import { isDownloading } from '@/player/downloads';
import { showToast } from '@/ui/UndoToast';
import { showDialog } from './Dialog';

/** The pickers reject, rather than resolve, when the listener backs out. */
function wasCancelled(error: unknown): boolean {
  return error instanceof Error && /cancel/i.test(error.message);
}

function explain(title: string, error: unknown): void {
  showDialog(title, error instanceof Error ? error.message : String(error));
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
 * A refresh or download still running would write rows from the old data into
 * the restored database, so a restore waits until neither is.
 */
function backgroundWorkBlocksRestore(): boolean {
  if (!isRefreshing() && !isDownloading()) return false;
  showDialog(
    'Sage Pod is busy',
    'Podcasts are refreshing or episodes are downloading. Let them finish, or cancel the downloads, then try again.'
  );
  return true;
}

/**
 * AntennaPod's "Database import": pick a backup, check it, warn, then replace
 * everything and restart. Nothing changes until the listener confirms.
 */
export async function importDatabase(): Promise<void> {
  if (backgroundWorkBlocksRestore()) return;
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
  if (!staged.check.ok) {
    await discardStagedBackup(staged);
    showDialog("Can't restore this file", staged.check.reason);
    return;
  }

  const { feeds, episodes } = staged.info;
  showDialog(
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
            // Checked again: a refresh may have started while the warning was up.
            if (backgroundWorkBlocksRestore()) {
              await discardStagedBackup(staged);
              return;
            }
            try {
              await player.release();
              await restoreStagedBackup(staged);
              await reloadAppAsync('Restored a database backup');
            } catch (error) {
              // The player has let go of its episode, so restart either way;
              // a failed restore leaves the old data in place.
              showDialog("Couldn't restore the backup", error instanceof Error ? error.message : String(error), [
                { text: 'Restart', onPress: () => void reloadAppAsync('Restore failed') },
              ]);
            }
          })(),
      },
    ],
    { cancelable: true, onDismiss: () => void discardStagedBackup(staged) }
  );
}
