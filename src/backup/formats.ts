/**
 * Backup and export, AntennaPod's Settings › Import/Export: file names, the
 * HTML exports and the check a database backup must pass before it replaces
 * the app's data. Pure, so it is tested without a phone.
 */
import { localDay } from '../stats/aggregate';

export type ExportKind = 'opml' | 'html' | 'favourites' | 'database';

const NAMES: Record<ExportKind, { stem: string; extension: string; mimeType: string }> = {
  opml: { stem: 'sagepod-feeds', extension: 'opml', mimeType: 'text/x-opml' },
  html: { stem: 'sagepod-feeds', extension: 'html', mimeType: 'text/html' },
  favourites: { stem: 'sagepod-favourites', extension: 'html', mimeType: 'text/html' },
  database: { stem: 'sagepod-backup', extension: 'db', mimeType: 'application/x-sqlite3' },
};

/** "sagepod-feeds-2026-10-09.opml": AntennaPod's names, dated by the local day. */
export function exportFileName(kind: ExportKind, now: number): string {
  const { stem, extension } = NAMES[kind];
  return `${stem}-${localDay(now)}.${extension}`;
}

export function exportMimeType(kind: ExportKind): string {
  return NAMES[kind].mimeType;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Only web links become links; anything else (javascript:, file:) stays text. */
function safeUrl(url: string | null | undefined): string | null {
  return url && /^https?:\/\//i.test(url.trim()) ? url.trim() : null;
}

function page(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
body { font-family: system-ui, sans-serif; max-width: 720px; margin: 0 auto; padding: 16px; line-height: 1.4; }
li { margin: 12px 0; list-style: none; display: flex; gap: 12px; align-items: flex-start; }
ul { padding: 0; }
img { width: 56px; height: 56px; border-radius: 8px; object-fit: cover; flex: none; }
small { color: #666; }
h2 { margin-top: 32px; }
</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
${body}
</body>
</html>
`;
}

export type HtmlFeed = {
  title: string;
  author: string | null;
  feedUrl: string;
  link: string | null;
  imageUrl: string | null;
};

/** AntennaPod's HTML export: a page listing every subscription with its links. */
export function subscriptionsHtml(feeds: readonly HtmlFeed[]): string {
  const items = feeds.map((feed) => {
    const image = safeUrl(feed.imageUrl);
    const website = safeUrl(feed.link);
    const links = [
      website ? `<a href="${escapeHtml(website)}">Website</a>` : null,
      `<a href="${escapeHtml(feed.feedUrl)}">Feed</a>`,
    ].filter(Boolean);
    return [
      '<li>',
      image ? `<img src="${escapeHtml(image)}" alt="">` : '',
      '<div>',
      `<strong>${escapeHtml(feed.title)}</strong>`,
      feed.author ? `<br><small>${escapeHtml(feed.author)}</small>` : '',
      `<br>${links.join(' · ')}`,
      '</div>',
      '</li>',
    ].join('');
  });
  const body =
    feeds.length === 0
      ? '<p>No subscriptions.</p>'
      : `<p>${feeds.length} podcasts</p>\n<ul>\n${items.join('\n')}\n</ul>`;
  return page('Sage Pod subscriptions', body);
}

export type HtmlFavourite = {
  feedId: number;
  feedTitle: string;
  feedLink: string | null;
  title: string;
  link: string | null;
  mediaUrl: string | null;
  publishedAt: number | null;
};

/**
 * AntennaPod's favourites export: favourite episodes grouped by podcast, each
 * linking to its web page (or its audio when there is none).
 */
export function favouritesHtml(episodes: readonly HtmlFavourite[]): string {
  // By podcast, not by title: two podcasts can share a name.
  const groups = new Map<number, HtmlFavourite[]>();
  for (const episode of episodes) {
    const group = groups.get(episode.feedId);
    if (group) group.push(episode);
    else groups.set(episode.feedId, [episode]);
  }
  const sections = [...groups.values()].map((items) => {
    const { feedTitle } = items[0];
    const feedLink = safeUrl(items[0].feedLink);
    const heading = feedLink ? `<a href="${escapeHtml(feedLink)}">${escapeHtml(feedTitle)}</a>` : escapeHtml(feedTitle);
    const rows = items.map((item) => {
      const href = safeUrl(item.link) ?? safeUrl(item.mediaUrl);
      const title = href ? `<a href="${escapeHtml(href)}">${escapeHtml(item.title)}</a>` : escapeHtml(item.title);
      const date = item.publishedAt ? `<br><small>${localDay(item.publishedAt)}</small>` : '';
      return `<li><div>${title}${date}</div></li>`;
    });
    return `<h2>${heading}</h2>\n<ul>\n${rows.join('\n')}\n</ul>`;
  });
  return page('Sage Pod favourites', episodes.length === 0 ? '<p>No favourites.</p>' : sections.join('\n'));
}

/** What a picked database file holds, read before anything is replaced. */
export type BackupInfo = {
  userVersion: number;
  tables: readonly string[];
  integrity: string;
  feeds: number;
  episodes: number;
};

/** The tables every Sage Pod database has had since its first version. */
export const REQUIRED_TABLES = ['feeds', 'episodes', 'queue', 'settings'] as const;

export type BackupCheck = { ok: true } | { ok: false; reason: string };

/**
 * Whether a database file can replace the app's: a Sage Pod database, intact,
 * and not from a newer version of the app (whose tables this one can't read).
 */
export const NOT_SAGE_POD =
  "That file isn't a Sage Pod backup. To move from another podcast app, export its subscriptions as OPML and import that instead.";

export function checkBackup(info: BackupInfo, latestVersion: number): BackupCheck {
  const missing = REQUIRED_TABLES.filter((table) => !info.tables.includes(table));
  if (missing.length > 0 || info.userVersion < 1) {
    return { ok: false, reason: NOT_SAGE_POD };
  }
  if (info.userVersion > latestVersion) {
    return {
      ok: false,
      reason: 'That backup was made by a newer version of Sage Pod. Update the app, then try again.',
    };
  }
  if (info.integrity !== 'ok') {
    return { ok: false, reason: 'That backup is damaged, so nothing was changed.' };
  }
  return { ok: true };
}

/** Each table's column names. */
export type TableColumns = Record<string, readonly string[]>;

/**
 * The second check, on the backup once it has been brought up to this
 * version: every table and column the app's own database has must be there,
 * so a file that merely borrows the table names can't replace real data.
 */
export function checkColumns(expected: TableColumns, actual: TableColumns): BackupCheck {
  for (const [table, columns] of Object.entries(expected)) {
    const present = actual[table] ?? [];
    if (columns.some((column) => !present.includes(column))) return { ok: false, reason: NOT_SAGE_POD };
  }
  return { ok: true };
}
