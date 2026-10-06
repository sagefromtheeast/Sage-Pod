import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';

import { layoutFor, type Layout } from './layout';

/** Window-size-aware layout values; recomputes on rotation and split-screen resizes. */
export function useLayout(): Layout {
  const { width } = useWindowDimensions();
  return useMemo(() => layoutFor(width), [width]);
}
