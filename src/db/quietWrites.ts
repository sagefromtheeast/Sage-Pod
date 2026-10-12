/**
 * Writes that should not repaint the screens subscribed to their table.
 *
 * The player saves the position every few seconds while playing. Each save is
 * a row change on `episodes`, and every mounted episode list re-ran its query
 * for it. AntennaPod's periodic save posts no event at all: its lists follow
 * the playing row from the player, as `EpisodeRow` does here. A quiet write
 * registers the rows it is about to change, and the change listener drops
 * exactly one event per registered row.
 */

/** How long an unclaimed registration lives, in case its event never comes. */
export const QUIET_WRITE_TTL_MS = 2_000;

/** Position past which an episode counts as started (Continue Listening). */
export const STARTED_SECONDS = 30;

type Key = string;

const keyOf = (table: string, rowId: number): Key => `${table}:${rowId}`;

export class QuietRows {
  private pending = new Map<Key, number[]>();

  /** Expects one change event for `rowId` in `table` that nobody needs to hear about. */
  expect(table: string, rowId: number, now: number): void {
    const key = keyOf(table, rowId);
    const expiries = this.pending.get(key) ?? [];
    expiries.push(now + QUIET_WRITE_TTL_MS);
    this.pending.set(key, expiries);
  }

  /** Withdraws one expectation, for a write that turned out to change nothing. */
  cancel(table: string, rowId: number): void {
    const key = keyOf(table, rowId);
    const expiries = this.pending.get(key);
    if (!expiries) return;
    expiries.shift();
    if (expiries.length === 0) this.pending.delete(key);
  }

  /** True when this event was expected, and so should be dropped. Claims the expectation. */
  claim(table: string, rowId: number, now: number): boolean {
    const key = keyOf(table, rowId);
    const expiries = this.pending.get(key);
    if (!expiries) return false;
    while (expiries.length > 0 && expiries[0] < now) expiries.shift();
    const claimed = expiries.shift() !== undefined;
    if (expiries.length === 0) this.pending.delete(key);
    return claimed;
  }
}

export type StoredProgress = { is_new: number; position: number; duration: number | null };

/**
 * Whether a periodic position save can skip repainting the lists: only when
 * the episode is in the same lists before and after. Its first save takes it
 * out of the Inbox, crossing `STARTED_SECONDS` puts it in Continue Listening,
 * and the first known duration changes its row.
 */
export function positionSaveIsQuiet(stored: StoredProgress | null, position: number, duration: number | null): boolean {
  if (!stored || stored.is_new) return false;
  if (stored.position > 0 !== position > 0) return false;
  if (stored.position > STARTED_SECONDS !== position > STARTED_SECONDS) return false;
  if (stored.duration == null && duration != null) return false;
  return true;
}
