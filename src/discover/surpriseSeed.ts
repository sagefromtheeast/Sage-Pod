/**
 * The seed behind the home screen's "Surprise Me" shelf.
 *
 * The shelf re-queries whenever the episodes table changes — and the player
 * writes to it every few seconds while playing. Ordering by RANDOM() made the
 * shelf reshuffle on every one of those writes. Instead the query derives a
 * stable order from this seed, so re-runs return the same episodes until the
 * listener asks for a new set.
 *
 * Module state, not React state: the pick survives leaving and returning to
 * the Home tab, and resets with the app process.
 */

/**
 * SQLite has no seeded RANDOM(), so the query ranks rows by
 * `(id * seed) % SURPRISE_MODULUS`. A prime modulus keeps that spread out.
 */
export const SURPRISE_MODULUS = 46471;

/**
 * A seed in [1, SURPRISE_MODULUS - 1]. Zero would rank every row equally, and
 * a multiple of the modulus would do the same.
 */
export function nextSeed(previous: number | null = null, random: () => number = Math.random): number {
  const range = SURPRISE_MODULUS - 1;
  let seed = 1 + Math.floor(random() * range);
  // A shuffle that lands on the same seed would look like a broken button.
  if (seed === previous) seed = (seed % range) + 1;
  return seed;
}

let seed = nextSeed();
const listeners = new Set<() => void>();

export function getSurpriseSeed(): number {
  return seed;
}

export function shuffleSurprise(): void {
  seed = nextSeed(seed);
  for (const listener of listeners) listener();
}

/** Shaped for `useSyncExternalStore`. */
export function subscribeSurpriseSeed(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
