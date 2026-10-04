import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearLocalAuthSession,
  loadStoredToken,
  refreshAccessToken,
  setAccessToken,
} from './api.js';

describe('auth session clear on logout', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    setAccessToken(null);
    sessionStorage.removeItem('tylo_one_logged_out');
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('clearLocalAuthSession removes access token and blocks loadStoredToken', () => {
    setAccessToken('access-before-logout');
    expect(loadStoredToken()).toBe('access-before-logout');

    clearLocalAuthSession();

    expect(localStorage.getItem('tylo_one_access')).toBeNull();
    expect(sessionStorage.getItem('tylo_one_logged_out')).toBe('1');
    expect(loadStoredToken()).toBeNull();
  });

  it('login setAccessToken clears the logout latch', () => {
    clearLocalAuthSession();
    expect(loadStoredToken()).toBeNull();

    setAccessToken('access-after-login');

    expect(sessionStorage.getItem('tylo_one_logged_out')).toBeNull();
    expect(loadStoredToken()).toBe('access-after-login');
  });

  it('discards in-flight refresh after logout', async () => {
    let resolveFetch;
    const fetchPromise = new Promise((resolve) => {
      resolveFetch = resolve;
    });
    vi.stubGlobal('fetch', vi.fn(() => fetchPromise));

    const pending = refreshAccessToken();
    clearLocalAuthSession();

    resolveFetch({
      ok: true,
      json: async () => ({ data: { accessToken: 'should-not-stick' } }),
    });

    await expect(pending).rejects.toMatchObject({ code: 'LOGGED_OUT' });
    expect(loadStoredToken()).toBeNull();
    expect(localStorage.getItem('tylo_one_access')).toBeNull();
  });
});
