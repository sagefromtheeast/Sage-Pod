/**
 * Multi-select state transitions, as pure functions over episode ids.
 * Lists are ordered as displayed; "above"/"below" are relative to that order
 * (AntennaPod's "Select all above / below").
 */

export function toggleSelected(selected: ReadonlySet<number>, id: number): Set<number> {
  const next = new Set(selected);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

/** Adds every row above (or below) `anchorId`, including the anchor itself. */
export function selectRange(
  orderedIds: readonly number[],
  selected: ReadonlySet<number>,
  anchorId: number,
  direction: 'above' | 'below'
): Set<number> {
  const index = orderedIds.indexOf(anchorId);
  if (index < 0) return new Set(selected);
  const range = direction === 'above' ? orderedIds.slice(0, index + 1) : orderedIds.slice(index);
  return new Set([...selected, ...range]);
}

/**
 * Drops ids that are no longer in the list (e.g. removed by the last action).
 * Returns the same set when nothing was dropped, so a caller storing it in
 * React state doesn't re-render (and loop) on every new list array.
 */
export function pruneSelection(
  orderedIds: readonly number[],
  selected: ReadonlySet<number>
): ReadonlySet<number> {
  const present = new Set(orderedIds);
  const kept = [...selected].filter((id) => present.has(id));
  return kept.length === selected.size ? selected : new Set(kept);
}
