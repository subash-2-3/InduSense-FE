import { HttpErrorResponse } from '@angular/common/http';
import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { ApiError } from '../api/api-error';
import { AppFailurePanelComponent } from './app-failure-panel.component';
import { AppFailureService, GlobalErrorHandler } from './global-error-handler';

describe('GlobalErrorHandler', () => {
  let handler: ErrorHandler;
  let failures: AppFailureService;

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    TestBed.configureTestingModule({
      providers: [{ provide: ErrorHandler, useClass: GlobalErrorHandler }],
    });
    handler = TestBed.inject(ErrorHandler);
    failures = TestBed.inject(AppFailureService);
  });

  afterEach(() => vi.restoreAllMocks());

  it('reports unexpected errors and counts repeats', () => {
    handler.handleError(new TypeError("Cannot read properties of undefined (reading 'value')"));
    expect(failures.failure()).toEqual({
      kind: 'runtime',
      message: 'Something went wrong on this page.',
      count: 1,
    });
    handler.handleError(new Error('again'));
    expect(failures.failure()?.count).toBe(2);
    expect(console.error).toHaveBeenCalledTimes(2);
  });

  it('turns a failed lazy chunk into an update notice, also inside a promise rejection', () => {
    handler.handleError({
      rejection: new TypeError('Failed to fetch dynamically imported module: /chunk-ABC.js'),
    });
    expect(failures.failure()?.kind).toBe('update');
    handler.handleError(new Error('later runtime error'));
    expect(failures.failure()).toMatchObject({ kind: 'update', count: 2 });
  });

  it('leaves failed HTTP calls to the pages and interceptors', () => {
    handler.handleError(new HttpErrorResponse({ status: 500 }));
    handler.handleError(new ApiError(503, 'SERVICE_UNAVAILABLE', 'down'));
    handler.handleError({ rejection: new HttpErrorResponse({ status: 0 }) });
    expect(failures.failure()).toBeNull();
  });

  it('the panel offers reload and dismiss', async () => {
    const fixture = TestBed.createComponent(AppFailurePanelComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[role="alertdialog"]')).toBeNull();

    handler.handleError(new Error('boom'));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(el.textContent).toContain('Something went wrong on this page.');
    const buttons = Array.from(el.querySelectorAll('button'));
    expect(buttons.map((b) => b.textContent?.trim())).toEqual(['Reload page', 'Dismiss']);

    buttons[1].click();
    fixture.detectChanges();
    expect(el.querySelector('[role="alertdialog"]')).toBeNull();
  });
});
