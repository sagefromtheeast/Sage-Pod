import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

import {
  autoBackupFolderIsPicked,
  autoBackupFolderUri,
  lastAutoBackupAt,
  pickAutoBackupFolder,
  runAutoBackupIfDue,
} from '@/backup/files';
import type { ExportKind } from '@/backup/formats';
import { AUTO_BACKUP_KEEP, fileNameFromUri } from '@/backup/schedule';
import { useSetting } from '@/db/settings';
import { exportOpml } from '@/feed/opml';
import { exportToFolder, importDatabase } from '@/ui/backupActions';
import { importOpmlFile, importOpmlFromClipboard } from '@/ui/opmlImport';
import { SettingsNote, SettingsScreen } from '@/ui/settings/SettingsScreen';
import { useUpdateSetting } from '@/ui/settings/useUpdateSetting';
import { SettingsAction, SettingsSection, SettingsSwitch } from '@/ui/SettingsRow';
import { showToast } from '@/ui/UndoToast';

type Busy = ExportKind | 'clipboard' | 'restore' | 'auto' | null;

/** AntennaPod's Settings › Import/Export: OPML, HTML and favourites exports, and database backup and restore. */
export default function ImportExportSettings() {
  const router = useRouter();
  const [busy, setBusy] = useState<Busy>(null);
  const update = useUpdateSetting();
  const autoBackup = useSetting('autoBackup');
  const [folderUri, setFolderUri] = useState<string | null>(null);
  const [lastBackup, setLastBackup] = useState<number | null>(null);

  const readAutoBackup = useCallback(() => {
    void autoBackupFolderUri().then(setFolderUri);
    void lastAutoBackupAt().then(setLastBackup);
  }, []);
  useFocusEffect(readAutoBackup);

  const run = async (what: Exclude<Busy, null>, task: () => Promise<unknown>) => {
    setBusy(what);
    try {
      await task();
    } finally {
      setBusy(null);
    }
  };

  const copyOpml = async () => {
    await Clipboard.setStringAsync(await exportOpml());
    showToast('Subscriptions copied as OPML');
  };

  const chooseFolder = async (): Promise<boolean> => {
    try {
      await pickAutoBackupFolder();
      return true;
    } catch (error) {
      if (!(error instanceof Error && /cancel/i.test(error.message))) {
        Alert.alert("Couldn't open the folder picker", error instanceof Error ? error.message : String(error));
      }
      return false;
    } finally {
      readAutoBackup();
    }
  };

  const setAutoBackup = (on: boolean) =>
    void run('auto', async () => {
      if (on && autoBackupFolderIsPicked && !folderUri && !(await chooseFolder())) return;
      await update('autoBackup', on);
      if (!on) return;
      // The first one now, so the listener sees where it goes.
      try {
        if (await runAutoBackupIfDue()) showToast('Backup saved');
      } catch (error) {
        Alert.alert("Couldn't write the backup", error instanceof Error ? error.message : String(error));
      }
      readAutoBackup();
    });

  const exportRow = (kind: ExportKind, label: string, description: string) => (
    <SettingsAction
      label={label}
      description={description}
      onPress={() => void run(kind, () => exportToFolder(kind))}
      busy={busy === kind}
    />
  );

  return (
    <SettingsScreen>
      <SettingsSection title="Database" />
      {exportRow(
        'database',
        'Export database',
        'Everything in one file: podcasts, episodes, queue, progress, history and settings.'
      )}
      <SettingsAction
        label="Import database"
        description="Restore a database export. Replaces everything in Sage Pod."
        onPress={() => void run('restore', importDatabase)}
        busy={busy === 'restore'}
        destructive
      />
      <SettingsNote>
        Audio files aren’t in the backup: restored on another phone, episodes show as not downloaded.
      </SettingsNote>

      <SettingsSection title="Automatic backup" />
      <SettingsSwitch
        label="Automatic database backup"
        description={`A database export every 3 days. The newest ${AUTO_BACKUP_KEEP} are kept.${
          lastBackup ? ` Last: ${new Date(lastBackup).toLocaleDateString()}.` : ''
        }`}
        value={autoBackup}
        onValueChange={setAutoBackup}
      />
      {autoBackupFolderIsPicked ? (
        <SettingsAction
          label="Backup folder"
          description={folderUri ? fileNameFromUri(folderUri) || 'Chosen folder' : 'Not chosen yet'}
          onPress={() => void run('auto', chooseFolder)}
          busy={busy === 'auto'}
        />
      ) : (
        <SettingsNote>Backups are saved in the Files app, under On My iPhone › Sage Pod › Backups.</SettingsNote>
      )}

      <SettingsSection title="Export" />
      {exportRow('opml', 'OPML export', 'Your subscriptions, for another podcast app.')}
      <SettingsAction
        label="Copy OPML"
        description="The same list, on the clipboard."
        onPress={() => void run('clipboard', copyOpml)}
        busy={busy === 'clipboard'}
      />
      {exportRow('html', 'HTML export', 'A web page listing your subscriptions.')}
      {exportRow('favourites', 'Favourites export', 'A web page of your favourite episodes.')}

      <SettingsSection title="Import" />
      <SettingsAction
        label="OPML import"
        description="Pick a subscription list exported from another podcast app."
        onPress={() => void importOpmlFile(router)}
      />
      <SettingsAction
        label="Import OPML from clipboard"
        description="For a subscription list you’ve copied as text."
        onPress={() => void importOpmlFromClipboard(router)}
      />
      <SettingsNote>Exports are saved to a folder you choose. OPML carries your podcasts, not progress.</SettingsNote>
    </SettingsScreen>
  );
}
