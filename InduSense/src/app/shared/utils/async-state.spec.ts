import { HttpErrorResponse } from '@angular/common/http';
import { Subject, of, throwError } from 'rxjs';

import {
  AsyncState,
  errorState,
  idleState,
  loadingState,
  successState,
  toAsyncState,
  viewOf,
} from './async-state';

describe('AsyncState', () => {
  const at = new Date('2026-10-25T10:00:00Z');

  it('keeps previous data while refreshing and marks it stale when the refresh fails', () => {
    const loaded = successState([1, 2], at);
    const refreshing = loadingState(loaded);
    expect(refreshing).toEqual({ ...loaded, loading: true });

    const failed = errorState(new HttpErrorResponse({ status: 503 }), refreshing);
    expect(failed.data).toEqual([1, 2]);
    expect(failed.stale).toBe(true);
    expect(failed.loading).toBe(false);
    expect(failed.lastUpdated).toBe(at);
    expect(failed.error?.status).toBe(503);
  });

  it('a failed first load is an error without stale data', () => {
    const failed = errorState(new HttpErrorResponse({ status: 0 }));
    expect(failed.data).toBeNull();
    expect(failed.stale).toBe(false);
    expect(failed.error?.isNetworkError).toBe(true);
  });

  it('success clears the error and the stale flag', () => {
    const failed: AsyncState<number> = { ...successState(1, at), stale: true };
    expect(successState(2, at)).toEqual({
      data: 2,
      loading: false,
      error: null,
      stale: false,
      lastUpdated: at,
    });
    expect(failed.stale).toBe(true);
  });

  it('picks the view to render', () => {
    const isEmpty = (rows: number[]) => rows.length === 0;
    expect(viewOf(loadingState<number[]>(), isEmpty)).toBe('loading');
    expect(viewOf(errorState<number[]>(new Error('x')), isEmpty)).toBe('error');
    expect(viewOf(successState<number[]>([]), isEmpty)).toBe('empty');
    expect(viewOf(successState([1]), isEmpty)).toBe('ready');
    // A failed refresh still renders the last data.
    expect(viewOf(errorState(new Error('x'), successState([1])), isEmpty)).toBe('ready');
    expect(viewOf(idleState<number[]>(), isEmpty)).toBe('empty');
  });

  it('turns a request into loading then success, and errors into a state', () => {
    const states: AsyncState<string>[] = [];
    of('ok')
      .pipe(toAsyncState<string>())
      .subscribe((s) => states.push(s));
    expect(states.map((s) => [s.loading, s.data])).toEqual([
      [true, null],
      [false, 'ok'],
    ]);

    const previous = successState('old', at);
    const failures: AsyncState<string>[] = [];
    let completed = false;
    throwError(() => new HttpErrorResponse({ status: 502 }))
      .pipe(toAsyncState(previous))
      .subscribe({ next: (s) => failures.push(s), complete: () => (completed = true) });
    expect(completed).toBe(true);
    expect(failures.at(-1)).toMatchObject({ data: 'old', stale: true, loading: false });
  });

  it('emits loading before the request answers', () => {
    const answer = new Subject<number>();
    const states: AsyncState<number>[] = [];
    answer.pipe(toAsyncState<number>()).subscribe((s) => states.push(s));
    expect(states).toEqual([loadingState()]);
    answer.next(5);
    expect(states.at(-1)?.data).toBe(5);
  });
});
