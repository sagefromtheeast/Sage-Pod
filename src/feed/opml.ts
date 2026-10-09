import { listFeedUrls } from '@/db/feeds';

import { subscribe } from './sync';

/**
 * OPML import/export.
 *
 * OPML is how listeners move a subscription list between podcast apps — it is
 * what AntennaPod, Overcast, Pocket Casts and the rest all export. Supporting
 * it means Sage Pod is never a one-way door.
 */

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Serialises every subscription as an OPML document. */
export async function exportOpml(): Promise<string> {
  const feeds = await listFeedUrls();
  const body = feeds
    .map((feed) => {
      const attrs = [
        'type="rss"',
        `text="${escapeXml(feed.title)}"`,
        `title="${escapeXml(feed.title)}"`,
        `xmlUrl="${escapeXml(feed.feed_url)}"`,
        feed.link ? `htmlUrl="${escapeXml(feed.link)}"` : null,
      ]
        .filter(Boolean)
        .join(' ');
      return `    <outline ${attrs}/>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>Sage Pod subscriptions</title>
    <dateCreated>${new Date().toUTCString()}</dateCreated>
  </head>
  <body>
${body}
  </body>
</opml>
`;
}

/** Pulls every `xmlUrl` out of an OPML document, including nested folders. */
export function parseOpml(xml: string): OpmlOutline[] {
  const outlines: OpmlOutline[] = [];
  const seen = new Set<string>();
  const pattern = /<outline\b[^>]*\bxmlUrl\s*=\s*["']([^"']+)["'][^>]*>/gi;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(xml)) !== null) {
    const feedUrl = match[1].replace(/&amp;/g, '&').trim();
    if (!feedUrl || seen.has(feedUrl)) continue;
    seen.add(feedUrl);

    const tag = match[0];
    const title =
      /\btitle\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1] ??
      /\btext\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1] ??
      feedUrl;

    outlines.push({ title: title.replace(/&amp;/g, '&'), feedUrl });
  }

  return outlines;
}

export type OpmlOutline = { title: string; feedUrl: string };

export type ImportResult = {
  imported: number;
  skipped: number;
  failures: { title: string; message: string }[];
};

/**
 * Subscribes to the chosen feeds of an OPML document.
 *
 * Feeds are imported one at a time on purpose: an import of a hundred
 * subscriptions each fetches a full feed body, and doing that in parallel is a
 * good way to get rate-limited by a host that serves several of them.
 */
export async function importFeeds(
  outlines: readonly OpmlOutline[],
  onProgress?: (done: number, total: number) => void
): Promise<ImportResult> {
  const result: ImportResult = { imported: 0, skipped: 0, failures: [] };

  for (let index = 0; index < outlines.length; index++) {
    const { title, feedUrl } = outlines[index];
    try {
      const { alreadySubscribed } = await subscribe(feedUrl);
      if (alreadySubscribed) result.skipped += 1;
      else result.imported += 1;
    } catch (error) {
      result.failures.push({
        title,
        message: error instanceof Error ? error.message : String(error),
      });
    }
    onProgress?.(index + 1, outlines.length);
  }

  return result;
}

/**
 * The OPML list waiting on the import checklist (`/opml-import`). Too big for
 * route params, so the picker or clipboard hands it over here.
 */
let draft: OpmlOutline[] = [];

export function setOpmlDraft(outlines: OpmlOutline[]): void {
  draft = outlines;
}

export function getOpmlDraft(): OpmlOutline[] {
  return draft;
}
