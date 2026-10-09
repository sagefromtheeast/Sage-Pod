/**
 * Password-protected feeds (AntennaPod's "Authentication"): the username and
 * password live in the system keychain, never in the feed URL in the
 * database, and are sent only to the feed's own host. Pure, so it is tested.
 */
export type FeedCredentials = { username: string; password: string };

/** Credentials as stored: with the host they were given for. */
export type StoredCredentials = FeedCredentials & { host: string };

/** A URL's embedded "user:pass@", taken out of it. */
export function splitCredentials(url: string): { url: string; credentials: FeedCredentials | null } {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { url, credentials: null };
  }
  if (!parsed.username && !parsed.password) return { url, credentials: null };
  const credentials = {
    username: safeDecode(parsed.username),
    password: safeDecode(parsed.password),
  };
  parsed.username = '';
  parsed.password = '';
  return { url: parsed.toString(), credentials };
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase() || null;
  } catch {
    return null;
  }
}

/**
 * The credentials to send to `url`: only to the host they were saved for, so
 * a feed whose episodes live on a CDN never hands the CDN its password, and a
 * restored database whose ids now name other podcasts can't either.
 */
export function credentialsFor(url: string, stored: StoredCredentials | null): FeedCredentials | null {
  if (!stored || (!stored.username && !stored.password)) return null;
  return hostOf(url) === stored.host ? { username: stored.username, password: stored.password } : null;
}

/** HTTP Basic, with UTF-8 names and passwords (`btoa` alone takes Latin-1 only). */
export function basicAuthHeader({ username, password }: FeedCredentials): string {
  const bytes = new TextEncoder().encode(`${username}:${password}`);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `Basic ${btoa(binary)}`;
}
