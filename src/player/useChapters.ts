import { useEffect, useState } from 'react';

import { parseChapters, type Chapter } from './chapters';

export type { Chapter };

/**
 * Chapters already fetched this session, by URL. Reopening the player (or the
 * mini player re-rendering it) shouldn't refetch a file that never changes.
 */
const cache = new Map<string, Chapter[]>();

export function useChapters(chaptersUrl: string | null | undefined) {
  const [chapters, setChapters] = useState<Chapter[]>(() =>
    chaptersUrl ? (cache.get(chaptersUrl) ?? []) : []
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);

    if (!chaptersUrl) {
      setChapters([]);
      return;
    }

    const cached = cache.get(chaptersUrl);
    if (cached) {
      setChapters(cached);
      return;
    }

    setChapters([]);
    setLoading(true);
    fetch(chaptersUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        const parsed = parseChapters(data);
        cache.set(chaptersUrl, parsed);
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
  }, [chaptersUrl]);

  return { chapters, loading, error };
}
