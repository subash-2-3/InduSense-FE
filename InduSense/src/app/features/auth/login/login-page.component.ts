import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  afterNextRender,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { ApiError } from '../../../core/api/api-error';
import { AuthService } from '../../../core/auth/auth.service';
import { takeReturnUrl } from '../../../core/auth/return-url';
import { ThemeService } from '../../../core/browser/theme.service';
import { ButtonComponent, IconComponent } from '../../../shared/ui';

/** Enterprise Industrial Sign-in screen. Prerendered on the server; the password is never stored. */
@Component({
  selector: 'app-login-page',
  imports: [ButtonComponent, IconComponent, ReactiveFormsModule, FormsModule],
  templateUrl: './login-page.component.html',
  styleUrl: './login-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPageComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly theme = inject(ThemeService);

  protected readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(255)]],
    password: ['', [Validators.required, Validators.maxLength(128)]],
  });

  protected readonly submitting = signal(false);
  protected readonly submitted = signal(false);
  protected readonly showPassword = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  /** False in the prerendered HTML until the app has bootstrapped in the browser. */
  protected readonly interactive = signal(false);

  // Forgot Password state
  protected readonly isForgotPassword = signal(false);
  protected readonly resetEmail = signal('');
  protected readonly resetSubmitting = signal(false);
  protected readonly resetSent = signal(false);

  constructor() {
    afterNextRender(() => {
      this.interactive.set(true);
    });
  }

  protected openForgotPassword(): void {
    this.isForgotPassword.set(true);
    this.resetSent.set(false);
    this.errorMessage.set(null);
    this.resetEmail.set(this.form.controls.email.value || '');
  }

  protected backToLogin(): void {
    this.isForgotPassword.set(false);
    this.resetSent.set(false);
    this.errorMessage.set(null);
  }

  protected submitReset(): void {
    const email = this.resetEmail().trim();
    if (!email) return;

    this.resetSubmitting.set(true);
    setTimeout(() => {
      this.resetSubmitting.set(false);
      this.resetSent.set(true);
    }, 600);
  }

  protected showError(control: 'email' | 'password'): boolean {
    const field = this.form.controls[control];
    return field.invalid && (field.touched || this.submitted());
  }

  protected submit(): void {
    this.submitted.set(true);
    this.errorMessage.set(null);
    if (!this.interactive() || this.submitting()) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { email, password } = this.form.getRawValue();
    this.submitting.set(true);
    this.form.disable();

    this.auth
      .login({ email: email.trim(), password })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          void this.router.navigateByUrl(takeReturnUrl());
        },
        error: (error: unknown) => {
          this.submitting.set(false);
          this.form.enable();
          this.form.controls.password.reset();
          this.submitted.set(false);
          this.errorMessage.set(loginErrorMessage(error));
        },
      });
  }
}

export function loginErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return 'Sign-in failed. Please try again.';
  }
  switch (error.code) {
    case 'INVALID_CREDENTIALS':
      return 'Invalid email or password.';
    case 'TOO_MANY_REQUESTS':
      return error.retryAfterSeconds
        ? `Too many attempts. Try again in ${error.retryAfterSeconds}s.`
        : 'Too many attempts. Try again later.';
    case 'NETWORK_ERROR':
      return "Can't reach the server. Check your connection and try again.";
    default:
      return error.status >= 500
        ? 'The service is unavailable right now. Please try again shortly.'
        : 'Sign-in failed. Please try again.';
  }
}
