/**
 * Which played downloads may be deleted automatically, as in AntennaPod's
 * Settings › Downloads › Episode cleanup (`EpisodeCleanupAlgorithmFactory`):
 *
 * - 'queue': played, not a favourite, not in the queue — deleted only when the
 *   storage limit needs room (APQueueCleanupAlgorithm, Sage Pod's old rule).
 * - a number of hours: the same episodes, once played that long ago — deleted
 *   whether or not room is needed (APCleanupAlgorithm).
 * - 'never': nothing is deleted to make room; a full limit stops auto-downloads.
 *
 * "Delete when finished" is a separate switch, as in Sage Pod before.
 */

export type CleanupRule = { kind: 'queue' } | { kind: 'never' } | { kind: 'after'; hours: number };

export const CLEANUP_OPTIONS = ['queue', '12', '24', '72', '168', 'never'] as const;

export function parseCleanup(raw: string | null | undefined): CleanupRule {
  if (raw === 'never') return { kind: 'never' };
  const hours = Number(raw);
  if (raw && Number.isFinite(hours) && hours > 0) return { kind: 'after', hours };
  return { kind: 'queue' };
}

export function formatCleanup(raw: string): string {
  const rule = parseCleanup(raw);
  if (rule.kind === 'queue') return 'When not in queue';
  if (rule.kind === 'never') return 'Never';
  if (rule.hours < 24) return `${rule.hours} h after played`;
  const days = rule.hours / 24;
  return `${days} day${days === 1 ? '' : 's'} after played`;
}

type Downloaded = { id: number; is_played: number; is_favorite: number; played_at: number | null };

/**
 * Deletable downloads under the rule, oldest played first (an unknown play
 * time sorts first). `now` and `played_at` are epoch ms.
 */
export function cleanupCandidates<T extends Downloaded>(
  rule: CleanupRule,
  downloaded: readonly T[],
  queuedIds: ReadonlySet<number>,
  now: number
): T[] {
  if (rule.kind === 'never') return [];
  const cutoff = rule.kind === 'after' ? now - rule.hours * 3_600_000 : Infinity;
  return downloaded
    .filter(
      (episode) =>
        episode.is_played === 1 &&
        episode.is_favorite === 0 &&
        !queuedIds.has(episode.id) &&
        // Under a time rule, an unknown play time never counts as long ago.
        (rule.kind === 'after' ? episode.played_at !== null && episode.played_at <= cutoff : true)
    )
    .sort((a, b) => (a.played_at ?? 0) - (b.played_at ?? 0));
}
