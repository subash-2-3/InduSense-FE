import { DOCUMENT } from '@angular/common';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { APP_CONFIG } from '../config/app-config';
import { CSRF_HEADER, csrfInterceptor, readCookie } from './csrf.interceptor';

describe('csrfInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  let cookie: string;

  beforeEach(() => {
    cookie = 'theme=dark; indusense_csrf=abc%3D123; other=1';
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([csrfInterceptor])),
        provideHttpClientTesting(),
        { provide: APP_CONFIG, useValue: { ...environment, apiBaseUrl: '/api/v1' } },
        {
          provide: DOCUMENT,
          useFactory: () => {
            const doc = document.implementation.createHTMLDocument('t');
            Object.defineProperty(doc, 'cookie', { get: () => cookie });
            return doc;
          },
        },
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('copies the CSRF cookie into the header of unsafe API requests', () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      http.request(method, '/api/v1/tags/1', { body: {} }).subscribe();
      expect(controller.expectOne({ method }).request.headers.get(CSRF_HEADER)).toBe('abc=123');
    }
  });

  it('reads the current cookie on every request (rotated after a refresh)', () => {
    http.post('/api/v1/tags', {}).subscribe();
    controller.expectOne('/api/v1/tags').flush({});
    cookie = 'indusense_csrf=rotated';
    http.post('/api/v1/tags', {}).subscribe();
    expect(controller.expectOne('/api/v1/tags').request.headers.get(CSRF_HEADER)).toBe('rotated');
  });

  it('leaves safe requests, other URLs and cookie-less sessions alone', () => {
    http.get('/api/v1/devices').subscribe();
    expect(controller.expectOne('/api/v1/devices').request.headers.has(CSRF_HEADER)).toBe(false);

    http.post('https://analytics.example/collect', {}).subscribe();
    expect(
      controller.expectOne('https://analytics.example/collect').request.headers.has(CSRF_HEADER),
    ).toBe(false);

    cookie = '';
    http.post('/api/v1/auth/session', {}).subscribe();
    expect(controller.expectOne('/api/v1/auth/session').request.headers.has(CSRF_HEADER)).toBe(false);
  });
});

describe('readCookie', () => {
  it('finds a cookie by exact name', () => {
    expect(readCookie('a=1; indusense_csrf=x=y; b=2', 'indusense_csrf')).toBe('x=y');
    expect(readCookie('xindusense_csrf=no', 'indusense_csrf')).toBeNull();
    expect(readCookie('', 'indusense_csrf')).toBeNull();
  });
});
