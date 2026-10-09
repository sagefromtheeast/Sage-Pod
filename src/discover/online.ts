import { DiscoveryError, getJson, searchPodcasts, type PodcastResult } from './itunes';
import { fyydSearchUrl, mergeResults, parseFyydResults } from './providers';

/** fyyd's podcast search (D-007's second keyless provider). */
export async function searchFyyd(term: string, count = 30): Promise<PodcastResult[]> {
  if (!term.trim()) return [];
  return parseFyydResults(await getJson<unknown>(fyydSearchUrl(term, count)));
}

/**
 * Searches Apple and fyyd together: Apple's results first (better metadata),
 * then fyyd's extra finds. One provider failing still shows the other's
 * results; only both failing is an error.
 */
export async function searchOnline(term: string, country: string): Promise<PodcastResult[]> {
  const [apple, fyyd] = await Promise.allSettled([searchPodcasts(term, { country }), searchFyyd(term)]);
  if (apple.status === 'rejected' && fyyd.status === 'rejected') {
    throw apple.reason instanceof DiscoveryError ? apple.reason : new DiscoveryError('Search failed.');
  }
  return mergeResults(
    apple.status === 'fulfilled' ? apple.value : [],
    fyyd.status === 'fulfilled' ? fyyd.value : []
  );
}
