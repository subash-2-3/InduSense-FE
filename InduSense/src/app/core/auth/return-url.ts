/**
 * Where to send a user after they sign in. The intended page is kept in `sessionStorage` rather
 * than in the `/login?returnUrl=…` query string, so the destination never shows up in the URL.
 */

/** sessionStorage key holding the path the user was headed to before being sent to login. */
export const RETURN_URL_STORAGE_KEY = 'induSense.returnUrl';

const DEFAULT_REDIRECT = '/dashboard';

/** Only same-app paths are followed after sign-in (no protocol-relative or external URLs). */
export function safeReturnUrl(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return DEFAULT_REDIRECT;
  }
  return value.startsWith('/login') ? DEFAULT_REDIRECT : value;
}

/** sessionStorage, or null when it is unavailable (server render, private mode, blocked). */
function sessionStore(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * Remember where the user was headed so the login page can send them back afterwards, without
 * putting the path in the URL. A no-op on the server and when storage is unavailable; a `/login`
 * target is treated as "nowhere" and clears any stale value.
 */
export function rememberReturnUrl(url: string | null): void {
  const store = sessionStore();
  if (!store) return;
  try {
    if (url && !url.startsWith('/login')) {
      store.setItem(RETURN_URL_STORAGE_KEY, url);
    } else {
      store.removeItem(RETURN_URL_STORAGE_KEY);
    }
  } catch {
    // Ignore storage write failures (quota, private mode).
  }
}

/** Read and clear the remembered path, validated down to a safe same-app route. */
export function takeReturnUrl(): string {
  const store = sessionStore();
  let stored: string | null = null;
  if (store) {
    try {
      stored = store.getItem(RETURN_URL_STORAGE_KEY);
      store.removeItem(RETURN_URL_STORAGE_KEY);
    } catch {
      stored = null;
    }
  }
  return safeReturnUrl(stored);
}
