import { TestBed } from '@angular/core/testing';

import { ApiError } from '../../../core/api/api-error';
import { ToastService, errorMessage } from './toast.service';

describe('errorMessage', () => {
  it("uses the backend's message", () => {
    const error = new ApiError(409, 'PLANT_CODE_TAKEN', 'A plant with this code already exists');
    expect(errorMessage(error, 'Failed')).toBe('A plant with this code already exists');
  });

  it('names the first rejected field of a validation error', () => {
    const error = new ApiError(422, 'VALIDATION_ERROR', 'Request validation failed', [
      { field: 'body.code', message: 'String should have at most 50 characters' },
    ]);
    expect(errorMessage(error, 'Failed')).toBe('code: String should have at most 50 characters');
  });

  it('adds the request id to unexpected server errors', () => {
    const error = new ApiError(
      500,
      'INTERNAL_ERROR',
      'An unexpected error occurred',
      [],
      null,
      'abc123',
    );
    expect(errorMessage(error, 'Failed')).toBe('An unexpected error occurred (ref. abc123)');
  });

  it('accepts a plain message and falls back for unknown errors', () => {
    expect(errorMessage('Session ended', 'Failed')).toBe('Session ended');
    expect(errorMessage({}, 'Failed')).toBe('Failed');
  });
});

describe('ToastService', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('queues toasts, dismisses them and expires them', () => {
    const service = TestBed.inject(ToastService);
    service.success('Saved');
    service.error(new ApiError(403, 'PERMISSION_DENIED', 'Not allowed'));
    expect(service.toasts().map((t) => [t.type, t.message])).toEqual([
      ['success', 'Saved'],
      ['error', 'Not allowed'],
    ]);

    service.dismiss(service.toasts()[1].id);
    expect(service.toasts().length).toBe(1);

    vi.advanceTimersByTime(4000);
    expect(service.toasts()).toEqual([]);
  });

  it('keeps at most four toasts', () => {
    const service = TestBed.inject(ToastService);
    for (let i = 1; i <= 6; i++) {
      service.success(`Toast ${i}`);
    }
    expect(service.toasts().map((t) => t.message)).toEqual([
      'Toast 3',
      'Toast 4',
      'Toast 5',
      'Toast 6',
    ]);
  });
});
