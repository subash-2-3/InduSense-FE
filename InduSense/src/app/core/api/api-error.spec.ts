import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';

import { ApiError, NETWORK_ERROR, UNEXPECTED_RESPONSE, parseRetryAfter } from './api-error';

/** Bodies captured from InduSense-BE (2026-09-25) with curl. */
const BACKEND = {
  unauthenticated: {
    success: false,
    code: 'AUTHENTICATION_REQUIRED',
    message: 'Not authenticated',
  },
  validation: {
    success: false,
    code: 'VALIDATION_ERROR',
    message: 'Request validation failed',
    details: [
      { field: 'body.email', message: 'String should have at least 1 character' },
      { field: 'body.password', message: 'Field required' },
    ],
  },
  routeNotFound: { success: false, code: 'NOT_FOUND', message: 'Not Found' },
  invalidCredentials: {
    success: false,
    code: 'INVALID_CREDENTIALS',
    message: 'Invalid email or password',
  },
};

function httpError(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new HttpErrorResponse({
    status,
    error: body,
    headers: new HttpHeaders(headers),
    url: '/api/v1/devices',
  });
}

describe('ApiError.from', () => {
  it('keeps the backend code and message from the error envelope', () => {
    const error = ApiError.from(
      httpError(401, BACKEND.unauthenticated, { 'X-Request-ID': 'e74ee663' }),
    );
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toBeInstanceOf(Error);
    expect(error.status).toBe(401);
    expect(error.code).toBe('AUTHENTICATION_REQUIRED');
    expect(error.message).toBe('Not authenticated');
    expect(error.requestId).toBe('e74ee663');
    expect(error.isNetworkError).toBe(false);
  });

  it('keeps validation details and finds messages per field', () => {
    const error = ApiError.from(httpError(422, BACKEND.validation));
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.details).toEqual(BACKEND.validation.details);
    expect(error.fieldMessage('email')).toBe('String should have at least 1 character');
    expect(error.fieldMessage('body.password')).toBe('Field required');
    expect(error.fieldMessage('name')).toBeNull();
  });

  it('keeps specific codes such as INVALID_CREDENTIALS and NOT_FOUND', () => {
    expect(ApiError.from(httpError(401, BACKEND.invalidCredentials)).code).toBe(
      'INVALID_CREDENTIALS',
    );
    expect(ApiError.from(httpError(404, BACKEND.routeNotFound)).code).toBe('NOT_FOUND');
  });

  it('reads Retry-After on rate limiting', () => {
    const error = ApiError.from(
      httpError(
        429,
        {
          success: false,
          code: 'TOO_MANY_REQUESTS',
          message: 'Too many attempts. Try again later',
        },
        { 'Retry-After': '30' },
      ),
    );
    expect(error.code).toBe('TOO_MANY_REQUESTS');
    expect(error.retryAfterSeconds).toBe(30);
  });

  it('reports an unreachable server as a network error', () => {
    const error = ApiError.from(httpError(0, new ProgressEvent('error')));
    expect(error.code).toBe(NETWORK_ERROR);
    expect(error.isNetworkError).toBe(true);
    expect(error.message).toBe("Can't reach the server. Check your connection and try again.");
  });

  it("understands FastAPI's default error shapes", () => {
    const plain = ApiError.from(httpError(404, { detail: 'Not Found' }));
    expect([plain.code, plain.message]).toEqual(['NOT_FOUND', 'Not Found']);

    const validation = ApiError.from(
      httpError(422, { detail: [{ loc: ['query', 'page_size'], msg: 'too large', type: 'x' }] }),
    );
    expect(validation.code).toBe('VALIDATION_ERROR');
    expect(validation.details).toEqual([{ field: 'query.page_size', message: 'too large' }]);
  });

  it('falls back to a status-based code and a safe message for other bodies', () => {
    const gateway = ApiError.from(httpError(502, '<html>Bad gateway</html>'));
    expect(gateway.code).toBe('BAD_GATEWAY');
    expect(gateway.message).toBe('The server is unavailable. Try again shortly.');
    expect(gateway.message).not.toContain('<html>');

    const teapot = ApiError.from(httpError(418, null));
    expect(teapot.code).toBe('HTTP_418');
    expect(teapot.message).toBe('Something went wrong. Please try again.');
  });

  it('ignores malformed details', () => {
    const error = ApiError.from(
      httpError(400, { success: false, code: 'BAD_REQUEST', message: 'Bad', details: 'oops' }),
    );
    expect(error.details).toEqual([]);
  });

  it('passes ApiErrors through and wraps anything else', () => {
    const original = new ApiError(404, 'DEVICE_NOT_FOUND', 'Device not found');
    expect(ApiError.from(original)).toBe(original);
    expect(ApiError.from(new TypeError('boom')).code).toBe(UNEXPECTED_RESPONSE);
  });
});

describe('parseRetryAfter', () => {
  it('parses seconds and HTTP dates', () => {
    const now = Date.parse('2026-09-25T12:00:00Z');
    expect(parseRetryAfter('120', now)).toBe(120);
    expect(parseRetryAfter('Fri, 25 Sep 2026 12:01:30 GMT', now)).toBe(90);
    expect(parseRetryAfter('Fri, 25 Sep 2026 11:00:00 GMT', now)).toBe(0);
    expect(parseRetryAfter(null)).toBeNull();
    expect(parseRetryAfter('soon')).toBeNull();
  });
});
