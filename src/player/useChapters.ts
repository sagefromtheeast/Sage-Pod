import { useState, useEffect } from 'react';

export type Chapter = {
  startTime: number;
  title: string;
  img?: string;
  url?: string;
};

export function useChapters(chaptersUrl: string | null | undefined) {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    
    if (!chaptersUrl) {
      setChapters([]);
      return;
    }

    setLoading(true);
    setError(null);

    fetch(chaptersUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!cancelled && data && Array.isArray(data.chapters)) {
          setChapters(data.chapters);
        }
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
