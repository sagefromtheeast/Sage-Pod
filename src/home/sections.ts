/**
 * Home's sections and their saved order (AntennaPod's "Configure home
 * screen"), pure so they can be tested.
 */

export type HomeSectionId =
  | 'queue'
  | 'new'
  | 'surprise'
  | 'classics'
  | 'downloads'
  | 'inProgress'
  | 'subscriptions';

export type HomeSection = { id: HomeSectionId; visible: boolean };

/**
 * AntennaPod's default order (queue, new, surprise, classics, downloads),
 * then Sage Pod's own two: episodes in progress outside the queue (D-003.6)
 * and the subscriptions strip.
 */
export const DEFAULT_HOME_SECTIONS: readonly HomeSectionId[] = [
  'queue',
  'new',
  'surprise',
  'classics',
  'downloads',
  'inProgress',
  'subscriptions',
];

export const HOME_SECTION_TITLES: Record<HomeSectionId, string> = {
  queue: 'Continue listening',
  new: "See what's new",
  surprise: 'Surprise me',
  classics: 'Check your classics',
  downloads: 'Manage downloads',
  inProgress: 'In progress',
  subscriptions: 'Subscriptions',
};

/**
 * The `homeSections` setting: ids in order, hidden ones prefixed with '-'
 * (e.g. 'queue,new,-classics'). Unknown and repeated ids are dropped, and
 * sections the string doesn't mention (added in a later version) are appended,
 * visible, so they don't silently stay hidden.
 */
export function parseHomeSections(raw: string): HomeSection[] {
  const seen = new Set<HomeSectionId>();
  const sections: HomeSection[] = [];
  for (const part of raw.split(',')) {
    const token = part.trim();
    const visible = !token.startsWith('-');
    const id = (visible ? token : token.slice(1)) as HomeSectionId;
    if (!DEFAULT_HOME_SECTIONS.includes(id) || seen.has(id)) continue;
    seen.add(id);
    sections.push({ id, visible });
  }
  for (const id of DEFAULT_HOME_SECTIONS) if (!seen.has(id)) sections.push({ id, visible: true });
  return sections;
}

export function serializeHomeSections(sections: readonly HomeSection[]): string {
  return sections.map((section) => (section.visible ? section.id : `-${section.id}`)).join(',');
}

/** Moves a section one place up (-1) or down (+1); out-of-range moves change nothing. */
export function moveSection(sections: readonly HomeSection[], index: number, direction: -1 | 1): HomeSection[] {
  const to = index + direction;
  if (index < 0 || index >= sections.length || to < 0 || to >= sections.length) return [...sections];
  const next = [...sections];
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}

export function setSectionVisible(
  sections: readonly HomeSection[],
  id: HomeSectionId,
  visible: boolean
): HomeSection[] {
  return sections.map((section) => (section.id === id ? { ...section, visible } : section));
}

/**
 * "Continue listening" is the queue with started episodes first (AntennaPod
 * puts paused items first), otherwise in queue order.
 */
export function continueListening<T extends { position: number }>(queue: readonly T[], limit: number): T[] {
  const started = queue.filter((episode) => episode.position > 0);
  const rest = queue.filter((episode) => episode.position <= 0);
  return [...started, ...rest].slice(0, limit);
}

/** The classics window: three years back from `now`, as a playback_history date ('YYYY-MM-DD'). */
export function classicsSince(now: number): string {
  const date = new Date(now);
  date.setUTCFullYear(date.getUTCFullYear() - 3);
  return date.toISOString().slice(0, 10);
}
