/**
 * What each notification says and where tapping it goes. Pure, so the wording
 * is tested without a phone; src/notify/index.ts posts them.
 */

export type NotificationContent = {
  title: string;
  body: string;
  /** The screen a tap opens (an expo-router path). */
  url: string;
};

/** "Ep 1, Ep 2 and 3 more": the first two titles, then a count. */
function listTitles(titles: readonly string[]): string {
  if (titles.length <= 2) return titles.join(' and ');
  return `${titles[0]}, ${titles[1]} and ${titles.length - 2} more`;
}

/** AntennaPod's per-podcast "Episode notifications": one per podcast and refresh. */
export function newEpisodesContent(feedId: number, feedTitle: string, titles: readonly string[]): NotificationContent {
  return {
    title: titles.length === 1 ? feedTitle : `${feedTitle}: ${titles.length} new episodes`,
    body: titles.length === 1 ? titles[0] : listTitles(titles),
    url: `/feed/${feedId}`,
  };
}

export function downloadFailedContent(episodeTitle: string, reason: string): NotificationContent {
  return { title: 'Download failed', body: `${episodeTitle}: ${reason}`, url: '/downloads' };
}

/** One notification for a whole automatic refresh, naming the podcasts it couldn't reach. */
export function refreshFailedContent(failures: readonly { feedId: number; title: string }[]): NotificationContent {
  const [first] = failures;
  if (failures.length === 1) {
    return { title: "Couldn't refresh a podcast", body: first.title, url: `/feed/${first.feedId}` };
  }
  return {
    title: `Couldn't refresh ${failures.length} podcasts`,
    body: listTitles(failures.map((failure) => failure.title)),
    url: '/library',
  };
}

/** A notification's tap target, only if it is one of the app's own paths. */
export function notificationUrl(data: unknown): string | null {
  const url = (data as { url?: unknown } | null | undefined)?.url;
  return typeof url === 'string' && url.startsWith('/') && !url.startsWith('//') ? url : null;
}
