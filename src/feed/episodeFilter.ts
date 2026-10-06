/**
 * The podcast page's episode filter (AntennaPod's FeedItemFilter): pairs of
 * opposite conditions, each off, "include" (must be) or "exclude" (must not
 * be), saved per podcast. Pure so the parsing and SQL can be tested.
 */

export type FilterFacet = 'played' | 'paused' | 'favorite' | 'downloaded' | 'queued';

/** true = only episodes that are this; false = only episodes that aren't. */
export type EpisodeFilter = Partial<Record<FilterFacet, boolean>>;

export const FILTER_FACETS: readonly { facet: FilterFacet; yes: string; no: string }[] = [
  { facet: 'played', yes: 'Played', no: 'Unplayed' },
  { facet: 'paused', yes: 'In progress', no: 'Not in progress' },
  { facet: 'favorite', yes: 'Favourite', no: 'Not favourite' },
  { facet: 'downloaded', yes: 'Downloaded', no: 'Not downloaded' },
  { facet: 'queued', yes: 'Queued', no: 'Not queued' },
];

const FACETS = FILTER_FACETS.map((entry) => entry.facet);

/** 'played,-downloaded' → { played: true, downloaded: false }. Unknown parts are ignored. */
export function parseEpisodeFilter(raw: string | null | undefined): EpisodeFilter {
  const filter: EpisodeFilter = {};
  for (const part of (raw ?? '').split(',')) {
    const token = part.trim();
    const include = !token.startsWith('-');
    const facet = (include ? token : token.slice(1)) as FilterFacet;
    if (FACETS.includes(facet)) filter[facet] = include;
  }
  return filter;
}

export function serializeEpisodeFilter(filter: EpisodeFilter): string {
  return FACETS.filter((facet) => filter[facet] !== undefined)
    .map((facet) => (filter[facet] ? facet : `-${facet}`))
    .join(',');
}

export function isFiltered(filter: EpisodeFilter): boolean {
  return FACETS.some((facet) => filter[facet] !== undefined);
}

/** Sets one side of a pair, or clears the pair when that side was already set. */
export function toggleFacet(filter: EpisodeFilter, facet: FilterFacet, include: boolean): EpisodeFilter {
  const next = { ...filter };
  if (next[facet] === include) delete next[facet];
  else next[facet] = include;
  return next;
}

const CONDITIONS: Record<FilterFacet, string> = {
  played: 'e.is_played = 1',
  paused: '(e.position > 0 AND e.is_played = 0)',
  favorite: 'e.is_favorite = 1',
  downloaded: "e.download_state = 'done'",
  queued: 'e.id IN (SELECT episode_id FROM queue)',
};

/** WHERE fragments (aliasing episodes as `e`) for the active conditions. */
export function filterClauses(filter: EpisodeFilter): string[] {
  return FACETS.filter((facet) => filter[facet] !== undefined).map((facet) =>
    filter[facet] ? CONDITIONS[facet] : `NOT ${CONDITIONS[facet]}`
  );
}

/** One line for the "Filtered" banner, e.g. "Unplayed · Not downloaded". */
export function describeFilter(filter: EpisodeFilter): string {
  return FILTER_FACETS.filter(({ facet }) => filter[facet] !== undefined)
    .map(({ facet, yes, no }) => (filter[facet] ? yes : no))
    .join(' · ');
}
