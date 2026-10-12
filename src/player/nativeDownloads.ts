import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

import type { DownloadWork } from './downloadWork';

/** What the worker needs to fetch one episode. */
export type NativeDownloadRequest = {
  episodeId: number;
  url: string;
  /** file:// URI of the finished file; the partial one sits next to it. */
  path: string;
  title: string;
  headers: Record<string, string>;
  /** A tap: starts now on any connection, ignoring Wi-Fi only and charging. */
  manual: boolean;
  unmeteredOnly: boolean;
  requiresCharging: boolean;
};

type EpisodeDownloadsModule = {
  enqueue(request: NativeDownloadRequest): Promise<void>;
  cancel(episodeId: number, path: string): Promise<void>;
  getAll(): Promise<DownloadWork[]>;
  clearFinished(): Promise<void>;
  addListener(event: 'onChange', listener: (event: { downloads: DownloadWork[] }) => void): { remove(): void };
};

/**
 * The local `modules/episode-downloads` module (D-029): WorkManager jobs that
 * keep downloading when Sage Pod is in the background or closed. Android
 * builds only; Expo Go, iOS and web get null and use the JavaScript path.
 */
export const nativeDownloads: EpisodeDownloadsModule | null =
  Platform.OS === 'android' ? requireOptionalNativeModule<EpisodeDownloadsModule>('EpisodeDownloads') : null;
