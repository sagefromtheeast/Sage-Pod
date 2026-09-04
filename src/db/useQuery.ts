import { useCallback, useEffect, useRef, useState } from 'react';

import { subscribeToTables } from './index';

export type QueryState<T> = {
  data: T | undefined;
  error: Error | null;
  loading: boolean;
  /** Re-runs the query immediately; useful for pull-to-refresh. */
  refresh: () => void;
};

/**
 * Runs an async database query and re-runs it whenever the given tables change.
 *
 * `deps` should list every value the query closes over, the same way
 * `useEffect` deps work — the query re-runs when they change.
 */
export function useQuery<T>(
  query: () => Promise<T>,
  tables: readonly string[],
  deps: readonly unknown[] = []
): QueryState<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);

  // Keep the latest query in a ref so the effect below depends only on `deps`,
  // not on the caller remembering to memoise their arrow function.
  const queryRef = useRef(query);
  queryRef.current = query;

  const runIdRef = useRef(0);
  const mountedRef = useRef(true);

  const run = useCallback(() => {
    const runId = ++runIdRef.current;
    queryRef
      .current()
      .then((result) => {
        // Ignore results from a superseded run, so a slow early query can't
        // overwrite a fast later one.
        if (!mountedRef.current || runId !== runIdRef.current) return;
        setData(result);
        setError(null);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!mountedRef.current || runId !== runIdRef.current) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, ...deps]);

  const tableKey = tables.join(',');
  useEffect(() => {
    return subscribeToTables(tableKey.split(','), run);
  }, [tableKey, run]);

  return { data, error, loading, refresh: run };
}
