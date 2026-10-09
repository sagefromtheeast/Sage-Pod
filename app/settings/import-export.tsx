import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { exportOpml } from '@/feed/opml';
import { importOpmlFile, importOpmlFromClipboard } from '@/ui/opmlImport';
import { SettingsNote, SettingsScreen } from '@/ui/settings/SettingsScreen';
import { SettingsAction, SettingsSection } from '@/ui/SettingsRow';

/** AntennaPod's Settings › Import/Export. File export and database backup come in Phase 16. */
export default function ImportExportSettings() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const copyOpml = async () => {
    setBusy(true);
    try {
      await Clipboard.setStringAsync(await exportOpml());
      Alert.alert(
        'Subscriptions copied',
        'Your OPML subscription list is on the clipboard — paste it into a file or another podcast app.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsScreen>
      <SettingsSection title="Export" />
      <SettingsAction
        label="Export subscriptions (OPML)"
        description="Copy your subscription list to the clipboard."
        onPress={() => void copyOpml()}
        busy={busy}
      />

      <SettingsSection title="Import" />
      <SettingsAction
        label="Import OPML file"
        description="Pick a subscription list exported from another podcast app."
        onPress={() => void importOpmlFile(router)}
      />
      <SettingsAction
        label="Import OPML from clipboard"
        description="For a subscription list you've copied as text."
        onPress={() => void importOpmlFromClipboard(router)}
      />
      <SettingsNote>OPML carries your podcasts, not listening progress or downloads.</SettingsNote>
    </SettingsScreen>
  );
}
