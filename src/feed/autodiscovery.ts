/**
 * Feed autodiscovery: a pasted website address usually points at an HTML page
 * whose `<link rel="alternate" type="application/rss+xml">` names the feed.
 * Pure string work (no DOM in React Native).
 */

export type FeedLink = { url: string; title: string | null };

const FEED_TYPES = ['application/rss+xml', 'application/atom+xml', 'application/xml', 'text/xml'];

/** True when a response is a web page rather than a feed. */
export function looksLikeHtml(body: string, contentType: string | null): boolean {
  if (contentType && /text\/html|application\/xhtml/i.test(contentType)) {
    // Some servers label feeds as HTML; trust the body when it says RSS/Atom.
    return !/<(?:rss|feed|rdf:RDF)[\s>]/i.test(body.slice(0, 2000));
  }
  const head = body.slice(0, 1000).trimStart().toLowerCase();
  return head.startsWith('<!doctype html') || head.startsWith('<html');
}

function attribute(tag: string, name: string): string | null {
  const match = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag);
  if (!match) return null;
  return decodeEntities(match[1] ?? match[2] ?? match[3] ?? '');
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

/** The feeds an HTML page advertises, resolved against the page's address, in page order. */
export function findFeedLinks(html: string, pageUrl: string): FeedLink[] {
  const links: FeedLink[] = [];
  const seen = new Set<string>();
  for (const [tag] of html.matchAll(/<link\b[^>]*>/gi)) {
    const rel = (attribute(tag, 'rel') ?? '').toLowerCase().split(/\s+/);
    const type = (attribute(tag, 'type') ?? '').toLowerCase();
    const href = attribute(tag, 'href');
    if (!rel.includes('alternate') || !FEED_TYPES.includes(type) || !href) continue;
    let url: string;
    try {
      url = new URL(href, pageUrl).toString();
    } catch {
      continue;
    }
    if (seen.has(url)) continue;
    seen.add(url);
    links.push({ url, title: attribute(tag, 'title')?.trim() || null });
  }
  return links;
}
