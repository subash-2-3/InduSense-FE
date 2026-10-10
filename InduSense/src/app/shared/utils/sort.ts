/**
 * Sorting utilities for tables across InduSense.
 */

export type SortDirection = 'asc' | 'desc';

export interface SortState {
  key: string;
  dir: SortDirection;
}

export interface WritableSignalLike<T> {
  (): T;
  set(value: T): void;
}

/**
 * Toggles sort state for a given column key.
 * Can be called with raw state (currentKey, currentDir, newKey)
 * OR with WritableSignals (keySignal, dirSignal, newKey).
 */
export function toggleSort(
  currentKey: string | null,
  currentDir: SortDirection,
  newKey: string,
): SortState;
export function toggleSort<TKey extends string | null = string | null, TDir extends SortDirection = SortDirection>(
  keySignal: WritableSignalLike<TKey>,
  dirSignal: WritableSignalLike<TDir>,
  newKey: string,
): SortState;
export function toggleSort(
  keyOrSignal: string | null | WritableSignalLike<any>,
  dirOrSignal: SortDirection | WritableSignalLike<any>,
  newKey: string,
): SortState {
  if (typeof keyOrSignal === 'function' && keyOrSignal !== null && 'set' in keyOrSignal) {
    const curKey = (keyOrSignal as () => string | null)();
    const curDir = (dirOrSignal as () => SortDirection)();
    const next = toggleSort(curKey, curDir, newKey);
    (keyOrSignal as WritableSignalLike<any>).set(next.key);
    (dirOrSignal as WritableSignalLike<any>).set(next.dir);
    return next;
  }

  const currentKey = keyOrSignal as string | null;
  const currentDir = (dirOrSignal as SortDirection) || 'asc';

  if (currentKey === newKey) {
    return {
      key: newKey,
      dir: currentDir === 'asc' ? 'desc' : 'asc',
    };
  }
  return {
    key: newKey,
    dir: 'asc',
  };
}

/**
 * Sorts an array of items by property key (supports nested keys like 'user.name')
 * or a custom getter function.
 */
export function sortData<T>(
  items: readonly T[],
  keyOrGetter: string | ((item: T) => unknown) | null | undefined,
  dir: SortDirection = 'asc',
  customGetter?: (item: T, key: string) => unknown,
): T[] {
  if (!keyOrGetter || !items || items.length <= 1) {
    return [...(items || [])];
  }

  const multiplier = dir === 'asc' ? 1 : -1;

  return [...items].sort((a, b) => {
    let valA: unknown;
    let valB: unknown;

    if (typeof keyOrGetter === 'function') {
      valA = keyOrGetter(a);
      valB = keyOrGetter(b);
    } else {
      const extractVal = (item: T): unknown => {
        if (customGetter) {
          const res = customGetter(item, keyOrGetter);
          if (res !== undefined) {
            return res;
          }
        }
        return getNestedValue(item, keyOrGetter);
      };
      valA = extractVal(a);
      valB = extractVal(b);
    }

    if (valA === valB) return 0;
    if (valA === null || valA === undefined || valA === '') return 1;
    if (valB === null || valB === undefined || valB === '') return -1;

    if (typeof valA === 'number' && typeof valB === 'number') {
      return (valA - valB) * multiplier;
    }

    if (typeof valA === 'boolean' && typeof valB === 'boolean') {
      return (valA === valB ? 0 : valA ? -1 : 1) * multiplier;
    }

    // Try date parsing if looks like ISO string
    if (typeof valA === 'string' && typeof valB === 'string') {
      const isDate =
        /^\d{4}-\d{2}-\d{2}/.test(valA) && /^\d{4}-\d{2}-\d{2}/.test(valB);
      if (isDate) {
        const timeA = Date.parse(valA);
        const timeB = Date.parse(valB);
        if (!isNaN(timeA) && !isNaN(timeB)) {
          return (timeA - timeB) * multiplier;
        }
      }
      return (
        valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' }) *
        multiplier
      );
    }

    if (valA instanceof Date && valB instanceof Date) {
      return (valA.getTime() - valB.getTime()) * multiplier;
    }

    return (String(valA) < String(valB) ? -1 : 1) * multiplier;
  });
}

function getNestedValue(obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== 'object' || !path) return null;
  const parts = path.split('.');
  let curr: unknown = obj;
  for (const part of parts) {
    if (curr === null || curr === undefined || typeof curr !== 'object') {
      return null;
    }
    // Security: Guard against prototype pollution traversal
    if (part === '__proto__' || part === 'constructor' || part === 'prototype') {
      return null;
    }
    if (Object.prototype.hasOwnProperty.call(curr, part)) {
      curr = (curr as Record<string, unknown>)[part];
    } else {
      curr = (curr as Record<string, unknown>)[part];
    }
  }
  return curr;
}
