import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ToastService } from '../../shared/ui/toast/toast.service';
import { errorToastInterceptor } from './error-toast.interceptor';

describe('errorToastInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let toast: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorToastInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    toast = vi.spyOn(TestBed.inject(ToastService), 'error');
  });

  afterEach(() => backend.verify());

  function fail(
    method: string,
    url: string,
    status: number,
    body: object | string | null = null,
  ): void {
    http.request(method, url, { body: {} }).subscribe({ error: () => undefined });
    backend.expectOne(url).flush(body, { status, statusText: 'Error' });
  }

  it('toasts the backend message of a failed change', () => {
    fail('POST', '/api/v1/plants', 409, {
      success: false,
      code: 'RESOURCE_LIMIT_REACHED',
      message: 'This company has reached its maximum plant limit (5).',
    });
    expect(toast).toHaveBeenCalledTimes(1);
    const error = toast.mock.calls[0][0] as { code: string; message: string };
    expect(error.code).toBe('RESOURCE_LIMIT_REACHED');
    expect(error.message).toBe('This company has reached its maximum plant limit (5).');
  });

  it('toasts PUT, PATCH and DELETE failures too, including a generic server error', () => {
    fail('PUT', '/api/v1/machines/1/tag-mappings', 422, {
      success: false,
      code: 'X',
      message: 'x',
    });
    fail('PATCH', '/api/v1/plants/1', 403, {
      success: false,
      code: 'PERMISSION_DENIED',
      message: 'No',
    });
    fail('DELETE', '/api/v1/plants/1', 500, '<html>proxy error</html>');
    expect(toast).toHaveBeenCalledTimes(3);
  });

  it('leaves loads, sign-in, expired sessions and other hosts to their own handling', () => {
    fail('GET', '/api/v1/plants', 500);
    fail('POST', '/api/v1/auth/session', 401, {
      success: false,
      code: 'INVALID_CREDENTIALS',
      message: 'x',
    });
    fail('POST', '/api/v1/plants', 401, { success: false, code: 'TOKEN_EXPIRED', message: 'x' });
    fail('POST', 'https://example.com/elsewhere', 500);
    expect(toast).not.toHaveBeenCalled();
  });
});
