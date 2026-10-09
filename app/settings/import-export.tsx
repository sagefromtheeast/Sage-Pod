import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useState } from 'react';

import type { ExportKind } from '@/backup/formats';
import { exportOpml } from '@/feed/opml';
import { exportToFolder, importDatabase } from '@/ui/backupActions';
import { importOpmlFile, importOpmlFromClipboard } from '@/ui/opmlImport';
import { SettingsNote, SettingsScreen } from '@/ui/settings/SettingsScreen';
import { SettingsAction, SettingsSection } from '@/ui/SettingsRow';
import { showToast } from '@/ui/UndoToast';

type Busy = ExportKind | 'clipboard' | 'restore' | null;

/** AntennaPod's Settings › Import/Export: OPML, HTML and favourites exports, and database backup and restore. */
export default function ImportExportSettings() {
  const router = useRouter();
  const [busy, setBusy] = useState<Busy>(null);

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
