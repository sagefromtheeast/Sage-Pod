import { useEffect, useRef, useState } from 'react';

import type { EpisodeWithFeed } from '@/db/types';
import { loadEmbeddedChapters } from '@/player/embeddedChapters';

import { parseChapters, type Chapter } from './chapters';

export type { Chapter };

/**
 * Chapters already loaded this session, by chapters URL or, for chapters in
 * the audio itself, by episode. Reopening the player (or the mini player
 * re-rendering it) shouldn't fetch them again.
 */
const cache = new Map<string, Chapter[]>();

async function fetchChapters(url: string): Promise<Chapter[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parseChapters(await res.json());
}

/** Podlove Simple Chapters stored from the feed, as `Chapter`s. */
function storedChapters(json: string): Chapter[] {
  try {
    return parseChapters({ chapters: JSON.parse(json) });
  } catch {
    return [];
  }
}

/**
 * The episode's chapters: the feed's chapters file when it names one, as
 * AntennaPod prefers it, then chapters written into the feed (Podlove Simple
 * Chapters), otherwise any chapters stored in the audio (D-027).
 */
export function useChapters(episode: EpisodeWithFeed | null | undefined) {
  const chaptersUrl = episode?.chapters_url ?? null;
  const chaptersJson = episode?.chapters_json ?? null;
  const key = episode
    ? (chaptersUrl ?? (chaptersJson ? `feed:${episode.id}:${chaptersJson}` : `embedded:${episode.id}`))
    : null;
  const latest = useRef(episode);
  latest.current = episode;

  const [chapters, setChapters] = useState<Chapter[]>(() => (key ? (cache.get(key) ?? []) : []));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);

    const current = latest.current;
    if (!key || !current) {
      setChapters([]);
      return;
    }

    const cached = cache.get(key);
    if (cached) {
      setChapters(cached);
      return;
    }

    if (!chaptersUrl && chaptersJson) {
      const parsed = storedChapters(chaptersJson);
      cache.set(key, parsed);
      setChapters(parsed);
      return;
    }

    setChapters([]);
    setLoading(true);
    (chaptersUrl ? fetchChapters(chaptersUrl) : loadEmbeddedChapters(current))
      .then((parsed) => {
        cache.set(key, parsed);
        if (!cancelled) setChapters(parsed);
      })
      .catch((err) => {
        if (!cancelled) setError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [key, chaptersUrl, chaptersJson]);

  return { chapters, loading, error };
}
