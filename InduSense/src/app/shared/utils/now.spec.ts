import { Injector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { injectNow } from './now';

describe('injectNow', () => {
  afterEach(() => vi.useRealTimers());

  it('ticks on the interval and stops when its injector is destroyed', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-25T12:00:00Z'));
    const injector = Injector.create({ providers: [], parent: TestBed.inject(Injector) });
    const now = runInInjectionContext(injector, () => injectNow(1000));

    const start = now();
    vi.advanceTimersByTime(3000);
    expect(now() - start).toBe(3000);

    injector.destroy();
    vi.advanceTimersByTime(5000);
    expect(now() - start).toBe(3000);
  });
});
