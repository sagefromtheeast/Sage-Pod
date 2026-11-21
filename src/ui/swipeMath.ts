/**
 * The arithmetic behind a swipeable row, separate from the gesture so it can
 * be tested. Every function is a worklet: the gesture calls them on the UI
 * thread.
 */

/** How far the row must travel before letting go runs the action. */
export function commitDistance(rowWidth: number): number {
  'worklet';
  // A third of the row, but never a reach across a whole tablet.
  return Math.min(Math.max(rowWidth * 0.33, 72), 160);
}

/** A fast flick commits from half the distance. */
const FLICK_VELOCITY = 900;

/**
 * Where the row sits for a finger at `dx`. A side with no action barely moves
 * (a short rubber band says "nothing here"); a side with one follows the
 * finger, and past the commit point it slows a little, so the snap is felt.
 */
export function rowOffset(dx: number, canRight: boolean, canLeft: boolean, rowWidth: number): number {
  'worklet';
  const allowed = dx > 0 ? canRight : canLeft;
  if (!allowed) return Math.sign(dx) * Math.min(Math.abs(dx) * 0.15, 16);
  const limit = commitDistance(rowWidth);
  const travel = Math.abs(dx);
  const eased = travel <= limit ? travel : limit + (travel - limit) * 0.6;
  return Math.sign(dx) * Math.min(eased, rowWidth);
}

/** Which way a released swipe commits, or null to spring back. */
export function releaseDirection(
  offset: number,
  velocityX: number,
  canRight: boolean,
  canLeft: boolean,
  rowWidth: number
): 'right' | 'left' | null {
  'worklet';
  const limit = commitDistance(rowWidth);
  const flick = Math.abs(velocityX) > FLICK_VELOCITY && Math.sign(velocityX) === Math.sign(offset);
  const far = Math.abs(offset) >= limit || (flick && Math.abs(offset) >= limit / 2);
  if (!far) return null;
  if (offset > 0) return canRight ? 'right' : null;
  return canLeft ? 'left' : null;
}

/** 0 at rest, 1 at the commit point: drives the strip's colour and icon size. */
export function armProgress(offset: number, rowWidth: number): number {
  'worklet';
  return Math.min(Math.abs(offset) / commitDistance(rowWidth), 1);
}
