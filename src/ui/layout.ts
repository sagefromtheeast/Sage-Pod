import {
  breakpoints,
  MAX_CONTENT_WIDTH,
  MIN_GRID_TILE,
  space,
  windowSizes,
  type WindowClass,
  type WindowSizes,
} from './theme';

/**
 * Pure layout maths, kept free of React Native so it can be unit tested.
 * Screens read it through `useLayout()`.
 */

export const MIN_GRID_COLUMNS = 3;
export const MAX_GRID_COLUMNS = 8;

/** Gap between tiles in a podcast grid. */
export const GRID_GAP = space.md;

export function windowClass(width: number): WindowClass {
  if (width >= breakpoints.expanded) return 'expanded';
  if (width >= breakpoints.medium) return 'medium';
  return 'compact';
}

/** How many podcast tiles fit across `usableWidth` without dropping below the minimum tile size. */
export function gridColumns(usableWidth: number, minTile: number = MIN_GRID_TILE): number {
  const fit = Math.floor((usableWidth + GRID_GAP) / (minTile + GRID_GAP));
  return Math.max(MIN_GRID_COLUMNS, Math.min(MAX_GRID_COLUMNS, fit));
}

/** Edge length of each tile when `columns` tiles share `usableWidth`. */
export function gridTileSize(usableWidth: number, columns: number, gap: number = GRID_GAP): number {
  return Math.floor((usableWidth - gap * (columns - 1)) / columns);
}

export type Layout = WindowSizes & {
  windowClass: WindowClass;
  /** Width of the centred content column, capped at MAX_CONTENT_WIDTH. */
  contentWidth: number;
  /** contentWidth minus the gutters — what grids and card rows can use. */
  usableWidth: number;
  /** Podcast grid columns for this window. */
  columns: number;
  /** Podcast grid tile size for this window. */
  tileSize: number;
};

export function layoutFor(windowWidth: number): Layout {
  const cls = windowClass(windowWidth);
  const sizes = windowSizes[cls];
  const contentWidth = Math.min(windowWidth, MAX_CONTENT_WIDTH);
  const usableWidth = Math.max(0, contentWidth - sizes.gutter * 2);
  const columns = gridColumns(usableWidth);
  return {
    ...sizes,
    windowClass: cls,
    contentWidth,
    usableWidth,
    columns,
    tileSize: gridTileSize(usableWidth, columns),
  };
}
