import { Ionicons } from '@expo/vector-icons';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
  type Ref,
  type RefObject,
} from 'react';
import {
  Animated,
  Platform,
  StyleSheet,
  View,
  type FlatList as RNFlatList,
  type FlatListProps,
  type HostInstance,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { FlatList, GestureDetector, usePanGesture } from 'react-native-gesture-handler';

import { dropIndex, moveItem } from '@/player/queueSorting';
import { triggerHaptic } from '@/ui/haptics';
import { useTheme } from '@/ui/useTheme';

/** Rows nobody has measured yet (off screen) count as this tall. */
const DEFAULT_ROW_HEIGHT = 84;
/** Dragging within this distance of the list's top or bottom edge scrolls it. */
const EDGE = 72;
const MAX_SCROLL_STEP = 14;
const NATIVE_DRIVER = Platform.OS !== 'web';

type Props<T> = Omit<FlatListProps<T>, 'data' | 'renderItem' | 'keyExtractor' | 'scrollEnabled'> & {
  data: readonly T[];
  keyOf: (item: T) => number;
  /** `handle` is the drag handle to place in the row, or null when dragging is off. */
  renderItem: (item: T, index: number, handle: ReactElement | null) => ReactElement;
  /** The new order, by key, after a drop or an accessibility move. */
  onReorder: (keys: number[]) => void;
  dragEnabled: boolean;
  listRef?: Ref<RNFlatList<T>>;
};

type Drag = {
  key: number;
  from: number;
  to: number;
  heights: number[];
  translation: number;
  scrollAtStart: number;
  /** Finger position within the list, for edge scrolling. */
  fingerY: number;
};

/**
 * A FlatList whose rows can be dragged by a handle to reorder them, built on
 * gesture-handler and Animated so it needs no extra native module. The
 * dragged row follows the finger; the rows it passes slide out of its way;
 * near the top or bottom edge the list scrolls. Each handle also offers
 * Move up / down / to top / to bottom to screen readers.
 */
export function DraggableList<T>({
  data,
  keyOf,
  renderItem,
  onReorder,
  dragEnabled,
  listRef,
  onScroll,
  ...listProps
}: Props<T>) {
  const theme = useTheme();
  // Shown order: follows `data`, except that a drop applies at once instead of
  // waiting for the database round trip.
  const [items, setItems] = useState<readonly T[]>(data);
  const [activeKey, setActiveKey] = useState<number | null>(null);

  const heights = useRef(new Map<number, number>());
  const shifts = useRef(new Map<number, Animated.Value>());
  const dragY = useRef(new Animated.Value(0)).current;
  const drag = useRef<Drag | null>(null);
  const scrollY = useRef(0);
  /** The list's height and its top edge on screen, for edge scrolling. */
  const viewport = useRef({ height: 0, top: 0 });
  const container = useRef<HostInstance>(null);
  const innerRef = useRef<RNFlatList<T> | null>(null);
  const edgeTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!drag.current) setItems(data);
  }, [data]);

  const shiftFor = (key: number) => {
    let value = shifts.current.get(key);
    if (!value) {
      value = new Animated.Value(0);
      shifts.current.set(key, value);
    }
    return value;
  };

  const keys = useMemo(() => items.map(keyOf), [items, keyOf]);
  const latest = useRef({ items, onReorder });
  latest.current = { items, onReorder };
  const keysRef = useRef(keys);
  keysRef.current = keys;

  const measuredHeights = () => {
    const known = [...heights.current.values()];
    const fallback = known.length ? known.reduce((a, b) => a + b, 0) / known.length : DEFAULT_ROW_HEIGHT;
    return keysRef.current.map((key) => heights.current.get(key) ?? fallback);
  };

  /** Slides the rows between the dragged row's origin and its target out of the way. */
  const layoutShifts = (state: Drag) => {
    const size = state.heights[state.from];
    keysRef.current.forEach((key, index) => {
      if (key === state.key) return;
      const target =
        index > state.from && index <= state.to ? -size : index < state.from && index >= state.to ? size : 0;
      Animated.timing(shiftFor(key), {
        toValue: target,
        duration: 150,
        useNativeDriver: NATIVE_DRIVER,
      }).start();
    });
  };

  const track = () => {
    const state = drag.current;
    if (!state) return;
    const dy = state.translation + (scrollY.current - state.scrollAtStart);
    dragY.setValue(dy);
    const to = dropIndex(state.heights, state.from, dy);
    if (to !== state.to) {
      state.to = to;
      triggerHaptic('selection');
      layoutShifts(state);
    }
  };

  const stopEdgeScroll = () => {
    if (edgeTimer.current) clearInterval(edgeTimer.current);
    edgeTimer.current = null;
  };

  const edgeScroll = () => {
    const state = drag.current;
    if (!state) return;
    const { height } = viewport.current;
    const up = state.fingerY < EDGE;
    const down = state.fingerY > height - EDGE;
    if (!up && !down) return stopEdgeScroll();
    if (edgeTimer.current) return;
    edgeTimer.current = setInterval(() => {
      const current = drag.current;
      if (!current) return stopEdgeScroll();
      const depth =
        current.fingerY < EDGE ? EDGE - current.fingerY : current.fingerY - (viewport.current.height - EDGE);
      const step = Math.min(MAX_SCROLL_STEP, Math.max(2, depth / 4)) * (current.fingerY < EDGE ? -1 : 1);
      const offset = Math.max(0, scrollY.current + step);
      if (offset === scrollY.current) return;
      scrollY.current = offset;
      innerRef.current?.scrollToOffset({ offset, animated: false });
      track();
    }, 16);
  };

  const finish = (commit: boolean) => {
    stopEdgeScroll();
    const state = drag.current;
    drag.current = null;
    setActiveKey(null);
    dragY.setValue(0);
    for (const value of shifts.current.values()) value.setValue(0);
    if (!state || !commit || state.to === state.from) return;
    const next = moveItem(latest.current.items, state.from, state.to);
    setItems(next);
    latest.current.onReorder(next.map(keyOf));
  };

  const begin = (key: number) => {
    const from = keysRef.current.indexOf(key);
    if (from < 0) return;
    drag.current = {
      key,
      from,
      to: from,
      heights: measuredHeights(),
      translation: 0,
      scrollAtStart: scrollY.current,
      fingerY: 0,
    };
    container.current?.measureInWindow((_x, y) => {
      viewport.current.top = y;
    });
    triggerHaptic('medium');
    setActiveKey(key);
  };

  const moveBy = useCallback(
    (key: number, to: number) => {
      const from = keys.indexOf(key);
      if (from < 0 || to === from) return;
      const next = moveItem(items, from, to);
      setItems(next);
      onReorder(next.map(keyOf));
    },
    [items, keys, keyOf, onReorder],
  );

  // The screen re-renders often (twice a second while audio plays). Each
  // handle keeps one gesture (the hook keeps it across renders) that calls
  // through this ref to the latest handlers, so a re-render never cancels a
  // drag in progress.
  const dragApi = useRef<DragApi>(null as unknown as DragApi);
  dragApi.current = {
    begin,
    move: (translationY, absoluteY) => {
      const state = drag.current;
      if (!state) return;
      state.translation = translationY;
      state.fingerY = absoluteY - viewport.current.top;
      track();
      edgeScroll();
    },
    finish,
    finalize: () => {
      if (drag.current) finish(false);
    },
  };

  const handleFor = (key: number, index: number) => {
    if (!dragEnabled) return null;
    return (
      <DragHandle
        itemKey={key}
        api={dragApi}
        index={index}
        count={keys.length}
        onMove={(to) => moveBy(key, to)}
      />
    );
  };

  const extraData = useMemo(
    () => [listProps.extraData, activeKey, dragEnabled],
    [listProps.extraData, activeKey, dragEnabled],
  );

  return (
    <ActiveIndex.Provider value={activeKey === null ? -1 : keys.indexOf(activeKey)}>
      <View
        ref={container}
        style={styles.flex}
        onLayout={(event: LayoutChangeEvent) => {
          viewport.current.height = event.nativeEvent.layout.height;
        }}
      >
        <FlatList
          {...listProps}
          ref={(instance: RNFlatList<T> | null) => {
            innerRef.current = instance;
            if (typeof listRef === 'function') listRef(instance);
            else if (listRef) (listRef as { current: RNFlatList<T> | null }).current = instance;
          }}
          data={items}
          extraData={extraData}
          keyExtractor={(item: T) => String(keyOf(item))}
          scrollEnabled={activeKey === null}
          // Lift the dragged row's cell above its neighbours (zIndex only
          // orders siblings, and rows are each wrapped in a cell).
          CellRendererComponent={Cell}
          scrollEventThrottle={16}
          onScroll={(event: NativeSyntheticEvent<NativeScrollEvent>) => {
            scrollY.current = event.nativeEvent.contentOffset.y;
            onScroll?.(event);
          }}
          renderItem={({ item, index }) => {
            const key = keyOf(item);
            const active = key === activeKey;
            return (
              <Animated.View
                onLayout={(event: LayoutChangeEvent) =>
                  heights.current.set(key, event.nativeEvent.layout.height)
                }
                style={[
                  active ? [styles.active, { backgroundColor: theme.surface }] : null,
                  { transform: [{ translateY: active ? dragY : shiftFor(key) }] },
                ]}
              >
                {renderItem(item, index, handleFor(key, index))}
              </Animated.View>
            );
          }}
        />
      </View>
    </ActiveIndex.Provider>
  );
}

/** Index of the row being dragged (-1 when none), for `Cell`. */
const ActiveIndex = createContext(-1);

/**
 * FlatList cell that lifts the dragged row above its neighbours: zIndex only
 * orders siblings, and each row sits in its own cell. Defined once, outside
 * the list, so cells aren't remounted on every render.
 */
function Cell({
  children,
  style,
  index,
  ...rest
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  index: number;
}) {
  const active = useContext(ActiveIndex) === index;
  return (
    <View {...rest} style={[style, active ? styles.activeCell : null]}>
      {children}
    </View>
  );
}

/** What a row's drag handle calls; the list refreshes it every render. */
type DragApi = {
  begin: (key: number) => void;
  move: (translationY: number, absoluteY: number) => void;
  finish: (success: boolean) => void;
  finalize: () => void;
};

function DragHandle({
  itemKey,
  api,
  index,
  count,
  onMove,
}: {
  itemKey: number;
  api: RefObject<DragApi>;
  index: number;
  count: number;
  onMove: (to: number) => void;
}) {
  const theme = useTheme();
  const gesture = usePanGesture({
    runOnJS: true,
    minDistance: 0,
    onActivate: () => api.current.begin(itemKey),
    onUpdate: (event) => api.current.move(event.translationY, event.absoluteY),
    onDeactivate: (event) => api.current.finish(!event.canceled),
    onFinalize: () => api.current.finalize(),
  });
  const actions = [
    index > 0 ? { name: 'moveUp', label: 'Move up' } : null,
    index < count - 1 ? { name: 'moveDown', label: 'Move down' } : null,
    index > 0 ? { name: 'moveToTop', label: 'Move to top' } : null,
    index < count - 1 ? { name: 'moveToBottom', label: 'Move to bottom' } : null,
  ].filter((action): action is { name: string; label: string } => action !== null);

  return (
    <GestureDetector gesture={gesture}>
      <View
        hitSlop={10}
        style={styles.handle}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={`Reorder, position ${index + 1} of ${count}`}
        accessibilityActions={actions}
        onAccessibilityAction={(event) => {
          const name = event.nativeEvent.actionName;
          onMove(
            name === 'moveUp'
              ? index - 1
              : name === 'moveDown'
                ? index + 1
                : name === 'moveToTop'
                  ? 0
                  : count - 1,
          );
        }}
      >
        <Ionicons name="reorder-three" size={24} color={theme.textFaint} />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  active: {
    elevation: 8,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  activeCell: {
    zIndex: 10,
    elevation: 10,
  },
  handle: {
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
});
