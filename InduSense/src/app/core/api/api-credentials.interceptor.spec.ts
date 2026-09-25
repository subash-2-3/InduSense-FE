import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { APP_CONFIG } from '../config/app-config';
import { environment } from '../../../environments/environment';
import { apiCredentialsInterceptor } from './api-credentials.interceptor';

describe('apiCredentialsInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiCredentialsInterceptor])),
        provideHttpClientTesting(),
        { provide: APP_CONFIG, useValue: { ...environment, apiBaseUrl: '/api/v1' } },
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('sends cookies with API requests', () => {
    http.get('/api/v1/devices').subscribe();
    http.get('/api/v1').subscribe();
    expect(controller.expectOne('/api/v1/devices').request.withCredentials).toBe(true);
    expect(controller.expectOne('/api/v1').request.withCredentials).toBe(true);
  });

  it('leaves other requests alone', () => {
    http.get('/assets/config.json').subscribe();
    http.get('/api/v10/other').subscribe();
    http.get('https://fonts.googleapis.com/css2').subscribe();
    expect(controller.expectOne('/assets/config.json').request.withCredentials).toBe(false);
    expect(controller.expectOne('/api/v10/other').request.withCredentials).toBe(false);
    expect(controller.expectOne('https://fonts.googleapis.com/css2').request.withCredentials).toBe(
      false,
    );
  });
});
