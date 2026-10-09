import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, Platform } from 'react-native';

import { useSetting } from '@/db/settings';
import { askForNotifications, notificationPermission, type NotificationPermission } from '@/notify';
import { SettingsNote, SettingsScreen } from '@/ui/settings/SettingsScreen';
import { useUpdateSetting } from '@/ui/settings/useUpdateSetting';
import { SettingsAction, SettingsSection, SettingsSwitch } from '@/ui/SettingsRow';

/**
 * AntennaPod's Settings › Notifications: which errors notify. New-episode
 * notifications are per podcast (Podcast settings › Episode notifications).
 */
export default function NotificationSettings() {
  const update = useUpdateSetting();
  const refreshErrors = useSetting('notifyRefreshErrors');
  const downloadErrors = useSetting('notifyDownloadErrors');
  const [permission, setPermission] = useState<NotificationPermission | null>(null);

  // Read again on return from the system settings, where it may have changed.
  useFocusEffect(
    useCallback(() => {
      void notificationPermission().then(setPermission);
    }, [])
  );

  const allow = async () => {
    if (permission === 'denied') {
      await Linking.openSettings();
      return;
    }
    await askForNotifications();
    setPermission(await notificationPermission());
  };

  return (
    <SettingsScreen>
      {permission && permission !== 'granted' ? (
        <>
          <SettingsSection title="Permission" />
          <SettingsAction
            label="Allow notifications"
            description={
              permission === 'denied'
                ? 'Notifications are off for Sage Pod. Turn them on in the system settings.'
                : 'Sage Pod asks once; nothing is shown until you allow it.'
            }
            onPress={() => void allow()}
          />
        </>
      ) : null}

      <SettingsSection title="Errors" />
      <SettingsSwitch
        label="Refresh errors"
        description="When an automatic refresh can't reach a podcast."
        value={refreshErrors}
        onValueChange={(value) => void update('notifyRefreshErrors', value)}
      />
      <SettingsSwitch
        label="Download errors"
        description="When an episode fails to download."
        value={downloadErrors}
        onValueChange={(value) => void update('notifyDownloadErrors', value)}
      />

      {Platform.OS === 'android' ? (
        <SettingsAction
          label="System notification settings"
          description="Sound, vibration and importance for each kind of notification."
          onPress={() => void Linking.openSettings()}
        />
      ) : null}
      <SettingsNote>To hear about new episodes, turn on Episode notifications in a podcast’s settings.</SettingsNote>
    </SettingsScreen>
  );
}
