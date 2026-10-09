import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { credentialsFor, hostOf, type FeedCredentials, type StoredCredentials } from './auth';

/** The keychain (iOS) or Keystore-encrypted storage (Android), one entry per podcast. */
const supported = Platform.OS === 'android' || Platform.OS === 'ios';
const keyFor = (feedId: number) => `feed-auth-${feedId}`;

export async function getStoredCredentials(feedId: number): Promise<StoredCredentials | null> {
  if (!supported) return null;
  try {
    const raw = await SecureStore.getItemAsync(keyFor(feedId));
    return raw ? (JSON.parse(raw) as StoredCredentials) : null;
  } catch {
    return null;
  }
}

/** The podcast's credentials, if `url` is on the host they were saved for. */
export async function feedCredentialsFor(feedId: number, url: string): Promise<FeedCredentials | null> {
  return credentialsFor(url, await getStoredCredentials(feedId));
}

/** Saves (or, with null or two empty fields, forgets) a podcast's credentials for its feed's host. */
export async function setFeedCredentials(
  feedId: number,
  feedUrl: string,
  credentials: FeedCredentials | null
): Promise<void> {
  if (!supported) return;
  const host = hostOf(feedUrl);
  if (!credentials || (!credentials.username && !credentials.password) || !host) {
    await SecureStore.deleteItemAsync(keyFor(feedId));
    return;
  }
  const stored: StoredCredentials = { ...credentials, host };
  await SecureStore.setItemAsync(keyFor(feedId), JSON.stringify(stored));
}

export async function forgetFeedCredentials(feedId: number): Promise<void> {
  if (!supported) return;
  await SecureStore.deleteItemAsync(keyFor(feedId)).catch(() => undefined);
}
