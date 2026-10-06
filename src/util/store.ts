import { useSyncExternalStore } from 'react';

/**
 * A tiny external store for app-wide state that lives outside React (the
 * long-press menu request, the undo toast, queue membership, settings).
 * Read it with `useStore(store, selector)`; only components whose selected
 * value changes re-render.
 */
export type Store<T> = {
  get: () => T;
  set: (next: T) => void;
  subscribe: (listener: () => void) => () => void;
};

export function createStore<T>(initial: T): Store<T> {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set: (next) => {
      if (Object.is(next, value)) return;
      value = next;
      // Copy first: a listener may unsubscribe (or subscribe) while we notify.
      for (const listener of [...listeners]) listener();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export function useStore<T, S = T>(store: Store<T>, select: (value: T) => S = (value) => value as unknown as S): S {
  return useSyncExternalStore(store.subscribe, () => select(store.get()));
}
