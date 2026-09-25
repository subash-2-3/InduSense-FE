import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of, throwError } from 'rxjs';

import { ApiError } from '../../../core/api/api-error';
import { AuthService } from '../../../core/auth/auth.service';
import { fakeUser } from '../../../core/auth/testing';
import { LoginPageComponent, loginErrorMessage, safeReturnUrl } from './login-page.component';

describe('safeReturnUrl', () => {
  it('keeps same-app paths', () => {
    expect(safeReturnUrl('/devices')).toBe('/devices');
    expect(safeReturnUrl('/reports?range=7d')).toBe('/reports?range=7d');
  });

  it('rejects external, protocol-relative and login targets', () => {
    expect(safeReturnUrl(null)).toBe('/dashboard');
    expect(safeReturnUrl('https://evil.example')).toBe('/dashboard');
    expect(safeReturnUrl('//evil.example')).toBe('/dashboard');
    expect(safeReturnUrl('/\\evil.example')).toBe('/dashboard');
    expect(safeReturnUrl('/login')).toBe('/dashboard');
  });
});

describe('LoginPageComponent', () => {
  const login = vi.fn();

  beforeEach(() => login.mockReset());

  async function setup(url = '/login') {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'login', component: LoginPageComponent },
          { path: '**', children: [] },
        ]),
        { provide: AuthService, useValue: { login } },
      ],
    });
    const harness = await RouterTestingHarness.create(url);
    await harness.fixture.whenStable();
    const el = harness.routeNativeElement!;
    const type = (id: string, value: string) => {
      const input = el.querySelector<HTMLInputElement>(`#${id}`)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    };
    const submit = async () => {
      el.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
      await harness.fixture.whenStable();
    };
    return { harness, el, type, submit };
  }

  it('enables the submit button once rendered in the browser', async () => {
    const { el } = await setup();
    expect(el.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(false);
  });

  it('shows field errors and does not sign in when the form is empty', async () => {
    const { el, submit } = await setup();
    await submit();
    const errors = Array.from(el.querySelectorAll('.field__error')).map((e) =>
      e.textContent?.trim(),
    );
    expect(errors).toEqual(['Enter your email address.', 'Enter your password.']);
    expect(el.querySelector('#login-email')!.getAttribute('aria-invalid')).toBe('true');
    expect(login).not.toHaveBeenCalled();
  });

  it('rejects a malformed email', async () => {
    const { el, type, submit } = await setup();
    type('login-email', 'not-an-email');
    type('login-password', 'x');
    await submit();
    expect(el.querySelector('#login-email-error')?.textContent?.trim()).toBe(
      'Enter a valid email address.',
    );
  });

  it('signs in and follows a safe returnUrl', async () => {
    login.mockReturnValue(of(fakeUser()));
    const { type, submit } = await setup('/login?returnUrl=%2Fdevices');
    type('login-email', ' admin@indusense.com ');
    type('login-password', 'pw');
    await submit();
    expect(login).toHaveBeenCalledWith({ email: 'admin@indusense.com', password: 'pw' });
    expect(TestBed.inject(Router).url).toBe('/devices');
  });

  it('shows the credentials error and clears the password', async () => {
    login.mockReturnValue(
      throwError(() => new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password')),
    );
    const { el, type, submit } = await setup();
    type('login-email', 'admin@indusense.com');
    type('login-password', 'wrong-password');
    await submit();
    expect(el.querySelector('[role="alert"]')?.textContent?.trim()).toBe(
      'Invalid email or password.',
    );
    expect(el.querySelector<HTMLInputElement>('#login-password')!.value).toBe('');
    expect(el.querySelector('#login-password-error')).toBeNull();
    expect(TestBed.inject(Router).url).toBe('/login');
  });

  it('shows the rate-limit error with the retry delay', async () => {
    login.mockReturnValue(
      throwError(() => new ApiError(429, 'TOO_MANY_REQUESTS', 'Too many attempts', [], 30)),
    );
    const { el, type, submit } = await setup();
    type('login-email', 'locked@indusense.com');
    type('login-password', 'pw');
    await submit();
    expect(el.querySelector('[role="alert"]')?.textContent?.trim()).toBe(
      'Too many attempts. Try again in 30s.',
    );
  });

  it('toggles password visibility', async () => {
    const { el, harness } = await setup();
    const input = el.querySelector<HTMLInputElement>('#login-password')!;
    const toggle = el.querySelector<HTMLButtonElement>('.field__toggle')!;
    expect(input.type).toBe('password');
    toggle.click();
    await harness.fixture.whenStable();
    expect(input.type).toBe('text');
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
  });
});

describe('loginErrorMessage', () => {
  it('maps API errors to messages for the sign-in form', () => {
    expect(loginErrorMessage(new ApiError(401, 'INVALID_CREDENTIALS', 'x'))).toBe(
      'Invalid email or password.',
    );
    expect(loginErrorMessage(new ApiError(429, 'TOO_MANY_REQUESTS', 'x', [], 12))).toBe(
      'Too many attempts. Try again in 12s.',
    );
    expect(loginErrorMessage(new ApiError(429, 'TOO_MANY_REQUESTS', 'x'))).toBe(
      'Too many attempts. Try again later.',
    );
    expect(loginErrorMessage(new ApiError(0, 'NETWORK_ERROR', 'x'))).toBe(
      "Can't reach the server. Check your connection and try again.",
    );
    expect(loginErrorMessage(new ApiError(503, 'SERVICE_UNAVAILABLE', 'x'))).toBe(
      'The service is unavailable right now. Please try again shortly.',
    );
    expect(loginErrorMessage(new Error('?'))).toBe('Sign-in failed. Please try again.');
  });
});
