import { HttpErrorResponse } from '@angular/common/http';

import { ApiErrorDetail } from './api-envelope';

/** Codes the frontend assigns itself (the backend's own codes pass through unchanged). */
export const NETWORK_ERROR = 'NETWORK_ERROR';
export const UNEXPECTED_RESPONSE = 'UNEXPECTED_RESPONSE';

const CODE_BY_STATUS: Readonly<Record<number, string>> = {
  400: 'BAD_REQUEST',
  401: 'AUTHENTICATION_REQUIRED',
  403: 'PERMISSION_DENIED',
  404: 'NOT_FOUND',
  405: 'METHOD_NOT_ALLOWED',
  409: 'CONFLICT',
  413: 'REQUEST_TOO_LARGE',
  422: 'VALIDATION_ERROR',
  429: 'TOO_MANY_REQUESTS',
  500: 'INTERNAL_ERROR',
  502: 'BAD_GATEWAY',
  503: 'SERVICE_UNAVAILABLE',
  504: 'GATEWAY_TIMEOUT',
};

const MESSAGE_BY_STATUS: Readonly<Record<number, string>> = {
  0: "Can't reach the server. Check your connection and try again.",
  401: 'Your session has ended. Please sign in again.',
  403: "You don't have permission to do this.",
  404: 'Not found.',
  429: 'Too many attempts. Try again later.',
  502: 'The server is unavailable. Try again shortly.',
  503: 'The service is temporarily unavailable. Try again shortly.',
  504: 'The server took too long to respond. Try again.',
};

const GENERIC_MESSAGE = 'Something went wrong. Please try again.';

/**
 * One error type for every failed API call. `message` is safe to show to users: it is the
 * backend's own message, or a generic one for network, gateway and unexpected failures.
 */
export class ApiError extends Error {
  override readonly name = 'ApiError';

  constructor(
    /** HTTP status; 0 when the server could not be reached. */
    readonly status: number,
    /** Machine-readable code, e.g. `DEVICE_NOT_FOUND`, `VALIDATION_ERROR`, `NETWORK_ERROR`. */
    readonly code: string,
    message: string,
    readonly details: readonly ApiErrorDetail[] = [],
    /** From `Retry-After` (429). */
    readonly retryAfterSeconds: number | null = null,
    /** From `X-Request-ID`, for support and log correlation. */
    readonly requestId: string | null = null,
  ) {
    super(message);
  }

  get isNetworkError(): boolean {
    return this.status === 0;
  }

  /** Message for one input field (`body.email` or just `email`), if the server rejected it. */
  fieldMessage(field: string): string | null {
    const match = this.details.find(
      (d) => d.field === field || (d.field ?? '').split('.').pop() === field,
    );
    return match?.message ?? null;
  }

  static from(error: unknown): ApiError {
    if (error instanceof ApiError) {
      return error;
    }
    if (!(error instanceof HttpErrorResponse)) {
      return new ApiError(0, UNEXPECTED_RESPONSE, GENERIC_MESSAGE);
    }
    const status = error.status;
    const retryAfter = parseRetryAfter(error.headers?.get('Retry-After') ?? null);
    const requestId = error.headers?.get('X-Request-ID') ?? null;

    if (status === 0) {
      return new ApiError(0, NETWORK_ERROR, MESSAGE_BY_STATUS[0], [], null, requestId);
    }

    const body: unknown = error.error;
    const fallbackCode = CODE_BY_STATUS[status] ?? `HTTP_${status}`;
    const fallbackMessage = MESSAGE_BY_STATUS[status] ?? GENERIC_MESSAGE;

    if (isEnvelopeError(body)) {
      // 5xx messages are generic on the backend already; keep them as sent.
      return new ApiError(
        status,
        body.code,
        body.message || fallbackMessage,
        sanitiseDetails(body.details),
        retryAfter,
        requestId,
      );
    }

    // FastAPI's default shapes (e.g. from a proxy or middleware outside the app's handlers).
    if (isRecord(body) && 'detail' in body) {
      const detail = body['detail'];
      if (typeof detail === 'string') {
        return new ApiError(status, fallbackCode, detail, [], retryAfter, requestId);
      }
      if (Array.isArray(detail)) {
        return new ApiError(
          status,
          'VALIDATION_ERROR',
          'Request validation failed',
          detail.map(fastApiDetail),
          retryAfter,
          requestId,
        );
      }
    }

    return new ApiError(status, fallbackCode, fallbackMessage, [], retryAfter, requestId);
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isEnvelopeError(body: unknown): body is {
  code: string;
  message: string;
  details?: unknown;
} {
  return (
    isRecord(body) &&
    body['success'] === false &&
    typeof body['code'] === 'string' &&
    typeof body['message'] === 'string'
  );
}

function sanitiseDetails(details: unknown): ApiErrorDetail[] {
  if (!Array.isArray(details)) {
    return [];
  }
  return details.filter(isRecord).map((d) => ({
    ...(typeof d['field'] === 'string' ? { field: d['field'] } : {}),
    message: typeof d['message'] === 'string' ? d['message'] : 'Invalid value',
  }));
}

function fastApiDetail(item: unknown): ApiErrorDetail {
  if (!isRecord(item)) {
    return { message: 'Invalid value' };
  }
  const loc = Array.isArray(item['loc']) ? item['loc'].map(String).join('.') : undefined;
  const message = typeof item['msg'] === 'string' ? item['msg'] : 'Invalid value';
  return loc ? { field: loc, message } : { message };
}

/** `Retry-After` is either delta-seconds or an HTTP date. */
export function parseRetryAfter(value: string | null, now = Date.now()): number | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed);
  }
  const date = Date.parse(trimmed);
  return Number.isNaN(date) ? null : Math.max(0, Math.ceil((date - now) / 1000));
}
