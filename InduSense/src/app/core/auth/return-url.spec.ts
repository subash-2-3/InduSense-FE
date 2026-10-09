import { RETURN_URL_STORAGE_KEY, rememberReturnUrl, safeReturnUrl, takeReturnUrl } from './return-url';

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

describe('rememberReturnUrl / takeReturnUrl', () => {
  beforeEach(() => sessionStorage.clear());

  it('round-trips a remembered path without putting it in the URL', () => {
    rememberReturnUrl('/devices?page=2');
    expect(sessionStorage.getItem(RETURN_URL_STORAGE_KEY)).toBe('/devices?page=2');
    expect(takeReturnUrl()).toBe('/devices?page=2');
  });

  it('clears the stored path once taken, then falls back to the dashboard', () => {
    rememberReturnUrl('/reports');
    takeReturnUrl();
    expect(sessionStorage.getItem(RETURN_URL_STORAGE_KEY)).toBeNull();
    expect(takeReturnUrl()).toBe('/dashboard');
  });

  it('does not remember a login target and clears any stale value', () => {
    sessionStorage.setItem(RETURN_URL_STORAGE_KEY, '/stale');
    rememberReturnUrl('/login');
    expect(sessionStorage.getItem(RETURN_URL_STORAGE_KEY)).toBeNull();
  });

  it('falls back to the dashboard for an unsafe stored value', () => {
    sessionStorage.setItem(RETURN_URL_STORAGE_KEY, '//evil.example');
    expect(takeReturnUrl()).toBe('/dashboard');
  });
});
