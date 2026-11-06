/**
 * Echo, the year in review (Phase 20, D-030): AntennaPod's seven story cards
 * about the listener's year, worked out from data Sage Pod already keeps.
 * Pure helpers; `src/db/echo.ts` gathers the inputs.
 */

/** Cards in the story: intro, hours, queue, listened after, hoarder, thanks, top 5. */
export const ECHO_CARDS = 7;
/** How long each card stays before moving on (AntennaPod: 10 s). */
export const ECHO_CARD_MS = 10_000;
/** Below this much listening in the year, Home doesn't offer Echo (AntennaPod: 10 h). */
export const ECHO_MIN_SECONDS = 10 * 3600;
/** Echo opens on this day of December (AntennaPod: the 10th). */
export const ECHO_FIRST_DAY = 10;
/** Podcasts on the final card. */
export const ECHO_TOP_COUNT = 5;

const DAY_MS = 24 * 3600 * 1000;

/** The year Echo is about, and whether Home offers it today (10–31 December). */
export function echoWindow(now: number): { year: number; open: boolean } {
  const date = new Date(now);
  return { year: date.getFullYear(), open: date.getMonth() === 11 && date.getDate() >= ECHO_FIRST_DAY };
}

/** Whether Home shows the Echo card. */
export function showEchoCard(now: number, listenedSeconds: number, hiddenYear: number | null): boolean {
  const { year, open } = echoWindow(now);
  return open && hiddenYear !== year && listenedSeconds >= ECHO_MIN_SECONDS;
}

export type QueueTone = 'clean' | 'many' | 'much';

/**
 * The queue card: how much a day it would take to finish the queue before
 * the new year. Up to 1.5 h a day is a clean start, up to 24 h is "quite a
 * bit to go", above that "Wait, what?" (AntennaPod's QueueScreen).
 */
export function queueOutlook(queueSeconds: number, now: number): { tone: QueueTone; perDaySeconds: number } {
  const today = new Date(now);
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const newYear = new Date(today.getFullYear() + 1, 0, 1).getTime();
  // Today counts, so 31 December leaves one day.
  const daysLeft = Math.max(1, Math.round((newYear - startOfToday) / DAY_MS));
  const perDaySeconds = Math.floor(queueSeconds / daysLeft);
  const hours = perDaySeconds / 3600;
  return { tone: hours < 1.5 ? 'clean' : hours <= 24 ? 'many' : 'much', perDaySeconds };
}

/**
 * The typical gap between release and completion. AntennaPod takes the
 * middle value of the sorted gaps (the upper one for an even count); null
 * when nothing qualifies.
 */
export function medianDelay(delaysMs: readonly number[]): number | null {
  const sorted = delaysMs.filter((d) => Number.isFinite(d) && d >= 0).sort((a, b) => a - b);
  return sorted.length === 0 ? null : sorted[Math.floor(sorted.length / 2)];
}

export type ListenerType = 'addict' | 'easygoing';

/** Within 2.5 days of release is a podcast addict (AntennaPod's TimeReleasePlayScreen). */
export function listenerType(delayMs: number): ListenerType {
  return delayMs <= 2.5 * DAY_MS ? 'addict' : 'easygoing';
}

export type HoarderKind = 'hoarder' | 'medium' | 'clean';

/**
 * How many of the podcasts that refresh automatically were played this
 * year: under 25 % is a hoarder, under 75 % "no hoarding here", else clean.
 */
export function hoarderVerdict(played: number, total: number): { kind: HoarderKind; percent: number } {
  const percent = total > 0 ? Math.floor((100 * played) / total) : 0;
  return { kind: percent < 25 ? 'hoarder' : percent < 75 ? 'medium' : 'clean', percent };
}

/** One of `items`, chosen by `seed` in [0, 1); undefined when empty. */
export function pickOne<T>(items: readonly T[], seed: number): T | undefined {
  if (items.length === 0) return undefined;
  return items[Math.min(items.length - 1, Math.floor(seed * items.length))];
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/**
 * The thanks card: the month of the first play when it was before this
 * year ("for sticking with us"), else null ("for joining us this year").
 */
export function firstPlayMonth(firstDay: string | null, year: number): string | null {
  if (!firstDay || firstDay >= `${year}-01-01`) return null;
  const month = MONTHS[Number(firstDay.slice(5, 7)) - 1];
  return month ? `${month} ${firstDay.slice(0, 4)}` : null;
}

/** "3 days", "5 hours 20 minutes", "45 minutes", like AntennaPod's long duration strings. */
export function formatSpan(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`;
  if (minutes >= 48 * 60) return plural(Math.round(minutes / (24 * 60)), 'day');
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? `${plural(hours, 'hour')} ${plural(rest, 'minute')}` : plural(hours, 'hour');
  }
  return plural(minutes, 'minute');
}

/** Whole hours, as the big number on the hours and queue cards. */
export function wholeHours(seconds: number): number {
  return Math.floor(seconds / 3600);
}

export type EchoFeed = { id: number; title: string; imageUrl: string | null; seconds: number };

/** Everything the seven cards show. */
export type EchoYear = {
  year: number;
  listenedSeconds: number;
  podcastsPlayed: number;
  queueSeconds: number;
  queueEpisodes: number;
  /** Median release-to-completion gap in ms, or null when nothing qualifies. */
  medianDelayMs: number | null;
  activeFeeds: number;
  playedActiveFeeds: number;
  /** Active podcasts not played this year that have new episodes this year. */
  unplayedActiveTitles: string[];
  /** 'YYYY-MM-DD' of the first ever play, or null. */
  firstDay: string | null;
  top: EchoFeed[];
};

/** The text shared from the final card. */
export function shareText(echo: EchoYear): string {
  const hours = wholeHours(echo.listenedSeconds);
  const podcasts = `${echo.podcastsPlayed} podcast${echo.podcastsPlayed === 1 ? '' : 's'}`;
  const lines = [`My year ${echo.year} in podcasts: ${hours} hour${hours === 1 ? '' : 's'} from ${podcasts}.`];
  if (echo.top.length > 0) {
    lines.push('', 'My favourites:', ...echo.top.map((feed, i) => `${i + 1}. ${feed.title}`));
  }
  lines.push('', '#SagePodEcho');
  return lines.join('\n');
}
