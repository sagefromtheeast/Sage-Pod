/** Widget sizes in dp, as the launcher reports them. Pure, so it can be tested. */

/** Below this width the skip buttons give way to the title. */
export const COMPACT_WIDTH = 250;
/** From this height, with room for four buttons, the buttons get their own row (AntennaPod 3.13). */
export const TALL_HEIGHT = 120;

/** Whether the tall layout fits: its button row needs the height and four buttons' width. */
export function isTall(width: number, height: number): boolean {
  return height >= TALL_HEIGHT && width >= COMPACT_WIDTH;
}
