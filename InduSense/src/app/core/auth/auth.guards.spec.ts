import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { authGuard, guestGuard } from './auth.guards';
import { RETURN_URL_STORAGE_KEY } from './return-url';
import { fakeUser, provideFakeAuth } from './testing';

@Component({ template: 'page' })
class PageComponent {}

describe('auth guards', () => {
  beforeEach(() => sessionStorage.clear());

  async function navigate(url: string, signedIn: boolean) {
    TestBed.configureTestingModule({
      providers: [
        provideFakeAuth(signedIn ? fakeUser() : null),
        provideRouter([
          { path: 'login', component: PageComponent, canActivate: [guestGuard] },
          {
            path: '',
            canActivate: [authGuard],
            canActivateChild: [authGuard],
            children: [
              { path: 'dashboard', component: PageComponent },
              { path: 'devices', component: PageComponent },
            ],
          },
        ]),
      ],
    });
    await RouterTestingHarness.create(url);
    return TestBed.inject(Router).url;
  }

  it('lets signed-in users in', async () => {
    expect(await navigate('/devices', true)).toBe('/devices');
  });

  it('sends signed-out users to a clean login URL and remembers where they were', async () => {
    expect(await navigate('/devices?page=2', false)).toBe('/login');
    expect(sessionStorage.getItem(RETURN_URL_STORAGE_KEY)).toBe('/devices?page=2');
  });

  it('keeps signed-in users away from the login page', async () => {
    expect(await navigate('/login', true)).toBe('/dashboard');
  });

  it('shows the login page to signed-out users', async () => {
    expect(await navigate('/login', false)).toBe('/login');
  });
});
