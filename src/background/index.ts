import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { runAutoBackupIfDue } from '@/backup/files';
import { backgroundIntervalMinutes } from '@/backup/schedule';
import { initDb } from '@/db';
import { getMeta, loadSettings, setMeta, settingsLoaded, useSetting } from '@/db/settings';
import { refreshAllFeeds } from '@/feed/sync';

/**
 * AntennaPod's periodic update: the system wakes Sage Pod now and then to
 * check for new episodes (which notifies and auto-downloads as a refresh in
 * the app does) and to write the automatic backup when one is due.
 */
const TASK = 'sagepod-refresh';
const INTERVAL_KEY = 'backgroundInterval';
const supported = Platform.OS === 'android' || Platform.OS === 'ios';

// Defined when the bundle loads, before any screen: a background wake runs
// the bundle without showing the app.
if (supported) {
  TaskManager.defineTask(TASK, async () => {
    try {
      await initDb();
      if (!settingsLoaded()) await loadSettings();
      // Each step on its own: a failed refresh shouldn't skip the backup.
      await refreshAllFeeds().catch(() => undefined);
      await runAutoBackupIfDue().catch(() => false);
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch {
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
}

async function schedule(minutes: number): Promise<void> {
  if ((await BackgroundTask.getStatusAsync()) !== BackgroundTask.BackgroundTaskStatus.Available) return;
  const registered = await TaskManager.isTaskRegisteredAsync(TASK);
  // Registering again resets the system's schedule, so only when it changed.
  if (registered && (await getMeta(INTERVAL_KEY)) === String(minutes)) return;
  if (registered) await BackgroundTask.unregisterTaskAsync(TASK);
  await BackgroundTask.registerTaskAsync(TASK, { minimumInterval: minutes });
  await setMeta(INTERVAL_KEY, String(minutes));
}

/** Keeps the background refresh registered at the listener's refresh interval. */
export function useBackgroundRefresh(): void {
  const interval = useSetting('refreshIntervalMinutes');
  useEffect(() => {
    if (!supported) return;
    void schedule(backgroundIntervalMinutes(interval)).catch(() => {
      // The system may refuse (Background App Refresh off); the app still
      // refreshes when it opens.
    });
  }, [interval]);
}
