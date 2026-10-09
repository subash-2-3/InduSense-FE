import { TestBed } from '@angular/core/testing';
import { Router, provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { routes } from './app.routes';
import { DASHBOARD_DATA_SOURCE } from './features/dashboard/data/dashboard-data-source';
import { ControlledDataSource } from './features/dashboard/data/testing';
import { fakeUser, provideFakeAuth } from './core/auth/testing';
import { serverRoutes } from './app.routes.server';
import { RenderMode } from '@angular/ssr';

describe('app routes', () => {
  // The dashboard chunk includes ECharts; its first import is slow in jsdom under a parallel run.
  // Load it once up front so each test measures routing only.
  beforeAll(async () => {
    await import('./features/dashboard/device-summary-page/device-summary-page.component');
  }, 60_000);

  beforeEach(() => sessionStorage.clear());

  async function navigate(url: string, signedIn = true) {
    TestBed.configureTestingModule({
      providers: [
        provideFakeAuth(signedIn ? fakeUser() : null),
        provideRouter(routes, withComponentInputBinding()),
        // Routing only: dashboard data never arrives, so widgets stay in their loading state.
        { provide: DASHBOARD_DATA_SOURCE, useValue: new ControlledDataSource() },
      ],
    });
    const harness = await RouterTestingHarness.create(url);
    await harness.fixture.whenStable();
    return {
      url: TestBed.inject(Router).url,
      el: harness.fixture.nativeElement as HTMLElement,
    };
  }

  it('redirects the root to the dashboard inside the layout', async () => {
    const { url, el } = await navigate('/');
    expect(url).toBe('/dashboard');
    expect(el.querySelector('app-main-layout app-device-summary-page')).not.toBeNull();
    expect(document.title).toBe('Dashboard · InduSense');
  });

  it('redirects unknown paths to the dashboard', async () => {
    const { url } = await navigate('/does-not-exist');
    expect(url).toBe('/dashboard');
  });

  it('renders the coming-soon page with the section from route data', async () => {
    const { el } = await navigate('/more');
    expect(el.querySelector('app-coming-soon-page h1')?.textContent).toBe('More');
    expect(document.title).toBe('More · InduSense');
  });

  it('sends signed-out visitors to login and keeps them out of the app', async () => {
    const { url, el } = await navigate('/devices', false);
    expect(url).toBe('/login');
    expect(el.querySelector('app-main-layout')).toBeNull();
  });

  it('renders login outside the layout', async () => {
    const { el } = await navigate('/login', false);
    expect(el.querySelector('app-login-page')).not.toBeNull();
    expect(el.querySelector('app-main-layout')).toBeNull();
  });

  it('every sidebar path resolves to a page', async () => {
    for (const path of [
      '/devices',
      '/assets',
      '/locations',
      '/maps',
      '/reports',
      '/more',
      '/quick-start',
      '/settings',
      '/help',
    ]) {
      TestBed.resetTestingModule();
      const { url } = await navigate(path);
      expect(url).toBe(path);
    }
  });
});

describe('server routes', () => {
  it('prerenders login and renders everything else on the client', () => {
    expect(serverRoutes).toEqual([
      { path: 'login', renderMode: RenderMode.Prerender },
      { path: '**', renderMode: RenderMode.Client },
    ]);
  });
});
