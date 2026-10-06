/**
 * Chapter navigation rules, pure so they can be tested. Mirrors AntennaPod's
 * CoverFragment (prev / next chapter buttons) and ChapterSeekBar.
 */

export type ChapterMark = { startTime: number };

export type Chapter = {
  startTime: number;
  title: string;
  img?: string;
  url?: string;
};

/** Podcasting 2.0 JSON chapters, sorted, dropping entries without a usable start time or marked `toc: false`. */
export function parseChapters(data: unknown): Chapter[] {
  const raw = (data as { chapters?: unknown } | null)?.chapters;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (entry): entry is Chapter & { toc?: boolean } =>
        !!entry &&
        typeof entry.startTime === 'number' &&
        Number.isFinite(entry.startTime) &&
        entry.toc !== false
    )
    .map(({ startTime, title, img, url }) => ({
      startTime: Math.max(0, startTime),
      title: typeof title === 'string' ? title : '',
      img: typeof img === 'string' ? img : undefined,
      url: typeof url === 'string' ? url : undefined,
    }))
    .sort((a, b) => a.startTime - b.startTime);
}

/** Index of the chapter playing at `position`, or -1 if none (no chapters, or before the first). */
export function currentChapterIndex(chapters: readonly ChapterMark[], position: number): number {
  let index = -1;
  for (let i = 0; i < chapters.length; i++) {
    if (chapters[i].startTime <= position) index = i;
    else break;
  }
  return index;
}

/**
 * Where "previous chapter" seeks. Within the first 10 s of a chapter (scaled
 * by playback speed, so it's ~10 s of listening) it goes to the previous
 * chapter; later it restarts the current one. Before chapter 2 it goes to 0.
 */
export function prevChapterTarget(
  chapters: readonly ChapterMark[],
  position: number,
  rate: number
): number {
  const index = currentChapterIndex(chapters, position);
  if (index < 1) return 0;
  return position - 10 * rate < chapters[index].startTime
    ? chapters[index - 1].startTime
    : chapters[index].startTime;
}

/** Where "next chapter" seeks, or null on the last chapter. */
export function nextChapterTarget(chapters: readonly ChapterMark[], position: number): number | null {
  const next = chapters[currentChapterIndex(chapters, position) + 1];
  return next ? next.startTime : null;
}

/** Chapter boundaries as fractions of the episode, for ticks on the seek bar. */
export function chapterTicks(chapters: readonly ChapterMark[], duration: number): number[] {
  if (duration <= 0) return [];
  return chapters
    .map((chapter) => chapter.startTime / duration)
    .filter((fraction) => fraction > 0 && fraction < 1);
}
