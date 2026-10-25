import { Observable, OperatorFunction, catchError, concat, map, of } from 'rxjs';

import { ApiError } from '../../core/api/api-error';

/**
 * One value that loads asynchronously, with everything a view needs to render it. Replaces separate
 * `loading` / `error` / `data` flags, which drift apart.
 *
 * - First load: `loading` with no `data` (show a skeleton).
 * - Refresh: `loading` with the previous `data` (keep showing it).
 * - Failed refresh: the previous `data` stays, `stale` is set and `error` says why.
 * - Failed first load: `error` with no `data` (show the error state).
 */
export interface AsyncState<T> {
  readonly data: T | null;
  readonly loading: boolean;
  readonly error: ApiError | null;
  /** The data shown is older than the last attempt: that attempt failed. */
  readonly stale: boolean;
  /** When `data` was last loaded successfully. */
  readonly lastUpdated: Date | null;
}

/** Nothing loaded yet and nothing in flight. */
export function idleState<T>(): AsyncState<T> {
  return { data: null, loading: false, error: null, stale: false, lastUpdated: null };
}

/** A load started; previous data (if any) stays visible. */
export function loadingState<T>(previous: AsyncState<T> = idleState<T>()): AsyncState<T> {
  return { ...previous, loading: true };
}

/** A load succeeded. */
export function successState<T>(data: T, at: Date = new Date()): AsyncState<T> {
  return { data, loading: false, error: null, stale: false, lastUpdated: at };
}

/** A load failed: keeps previous data (now stale) so a refresh failure does not blank the view. */
export function errorState<T>(
  error: unknown,
  previous: AsyncState<T> = idleState<T>(),
): AsyncState<T> {
  return {
    ...previous,
    loading: false,
    error: ApiError.from(error),
    stale: previous.data !== null,
  };
}

/** What a view should render. `empty` is decided by the caller's own notion of "no data". */
export type AsyncView = 'loading' | 'error' | 'empty' | 'ready';

export function viewOf<T>(
  state: AsyncState<T>,
  isEmpty: (data: T) => boolean = () => false,
): AsyncView {
  if (state.data !== null) {
    return isEmpty(state.data) ? 'empty' : 'ready';
  }
  if (state.error) return 'error';
  return state.loading ? 'loading' : 'empty';
}

/**
 * Turns one request into the states it goes through: loading (from `previous`), then success or
 * error. Errors become a state, never an error notification, so the stream completes cleanly and one
 * failing widget cannot break its subscribers.
 *
 *     this.api.meter(id).pipe(toAsyncState(this.state())).subscribe((s) => this.state.set(s));
 */
export function toAsyncState<T>(
  previous: AsyncState<T> = idleState<T>(),
): OperatorFunction<T, AsyncState<T>> {
  return (source: Observable<T>) =>
    concat(
      of(loadingState(previous)),
      source.pipe(
        map((data) => successState(data)),
        catchError((error: unknown) => of(errorState<T>(error, previous))),
      ),
    );
}
