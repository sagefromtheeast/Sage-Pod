import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import {
  downloadFailedContent,
  newEpisodesContent,
  notificationUrl,
  refreshFailedContent,
  type NotificationContent,
} from './content';

/**
 * Local notifications (no push server): new episodes of podcasts that ask for
 * them, and refresh and download errors. Android groups them in channels the
 * listener can tune in the system settings, as AntennaPod's are.
 */
const supported = Platform.OS === 'android' || Platform.OS === 'ios';

const CHANNELS = {
  newEpisodes: { id: 'new-episodes', name: 'New episodes', importance: Notifications.AndroidImportance.DEFAULT },
  downloadErrors: {
    id: 'download-errors',
    name: 'Download errors',
    importance: Notifications.AndroidImportance.DEFAULT,
  },
  refreshErrors: { id: 'refresh-errors', name: 'Refresh errors', importance: Notifications.AndroidImportance.LOW },
} as const;

type Channel = keyof typeof CHANNELS;

let setup: Promise<void> | null = null;

function ensureSetup(): Promise<void> {
  setup ??= (async () => {
    // Shown while the app is open too: a refresh or download finishing in the
    // background reads the same either way. Quietly: these are not alarms.
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    if (Platform.OS === 'android') {
      for (const channel of Object.values(CHANNELS)) {
        await Notifications.setNotificationChannelAsync(channel.id, {
          name: channel.name,
          importance: channel.importance,
        });
      }
    }
  })();
  return setup;
}

export type NotificationPermission = 'granted' | 'denied' | 'undetermined';

export async function notificationPermission(): Promise<NotificationPermission> {
  if (!supported) return 'denied';
  const status = await Notifications.getPermissionsAsync();
  if (status.granted) return 'granted';
  return status.canAskAgain ? 'undetermined' : 'denied';
}

/**
 * Asks for permission, only ever from something the listener just turned on
 * (a podcast's notifications, or the Notifications settings page), never at
 * startup. Resolves to whether notifications can now be shown.
 */
export async function askForNotifications(): Promise<boolean> {
  if (!supported) return false;
  await ensureSetup();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

async function post(channel: Channel, content: NotificationContent, identifier?: string): Promise<void> {
  if (!supported) return;
  try {
    await ensureSetup();
    if (!(await Notifications.getPermissionsAsync()).granted) return;
    await Notifications.scheduleNotificationAsync({
      // The same identifier replaces the earlier notification rather than stacking.
      identifier,
      content: { title: content.title, body: content.body, data: { url: content.url } },
      trigger: Platform.OS === 'android' ? { channelId: CHANNELS[channel].id } : null,
    });
  } catch {
    // A notification that can't be shown is never worth failing the refresh
    // or download that wanted it.
  }
}

export function notifyNewEpisodes(feedId: number, feedTitle: string, titles: readonly string[]): Promise<void> {
  if (titles.length === 0) return Promise.resolve();
  return post('newEpisodes', newEpisodesContent(feedId, feedTitle, titles), `new-episodes-${feedId}`);
}

export function notifyDownloadFailed(episodeId: number, episodeTitle: string, reason: string): Promise<void> {
  return post('downloadErrors', downloadFailedContent(episodeTitle, reason), `download-${episodeId}`);
}

export function notifyRefreshFailed(failures: readonly { feedId: number; title: string }[]): Promise<void> {
  if (failures.length === 0) return Promise.resolve();
  return post('refreshErrors', refreshFailedContent(failures), 'refresh-errors');
}

/** Opens the screen a tapped notification points at, including the one that launched the app. */
export function useNotificationTaps(): void {
  const router = useRouter();
  const response = supported ? Notifications.useLastNotificationResponse() : null;
  useEffect(() => {
    if (!response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const url = notificationUrl(response.notification.request.content.data);
    if (!url) return;
    router.push(url as never);
    // Handled: a later re-render (or relaunch) mustn't open it again.
    void Notifications.clearLastNotificationResponseAsync();
  }, [response, router]);
}
