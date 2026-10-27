import { apiUrl } from './config.js';
import { LEGACY_ACCESS_STORAGE_KEY } from './legacyMigration.js';

export { BACKEND_URL, API_BASE, apiUrl } from './config.js';

let accessToken = null;
/** In-flight refresh so concurrent 401s share one cookie refresh. */
let refreshPromise = null;
/** Bumped on logout so late refresh responses cannot restore a cleared session. */
let authGeneration = 0;
/** Timer that refreshes the access JWT before it expires. */
let accessRefreshTimer = null;

const ACCESS_KEY = 'tylo_one_access';
const LEGACY_ACCESS_KEY = LEGACY_ACCESS_STORAGE_KEY;
/** Tab-scoped latch: after logout, block cookie refresh until the next login. */
const LOGOUT_LATCH_KEY = 'tylo_one_logged_out';
/** Fired when cookie refresh fails so AuthProvider can send the user to login. */
export const SESSION_EXPIRED_EVENT = 'tylo:session-expired';
/** Refresh this many ms before the access JWT `exp`. */
const ACCESS_REFRESH_LEAD_MS = 2 * 60 * 1000;

export function readAccessTokenExpiryMs(token) {
  if (!token || typeof token !== 'string') return 0;
  const parts = token.split('.');
  if (parts.length < 2) return 0;
  try {
    const padded = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(padded);
    const payload = JSON.parse(json);
    const exp = Number(payload?.exp);
    return Number.isFinite(exp) ? exp * 1000 : 0;
  } catch {
    return 0;
  }
}

function emitSessionExpired() {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
  } catch {
    /* ignore */
  }
}

function clearAccessRefreshTimer() {
  if (accessRefreshTimer) {
    clearTimeout(accessRefreshTimer);
    accessRefreshTimer = null;
  }
}

function scheduleAccessRefresh(token) {
  clearAccessRefreshTimer();
  const expMs = readAccessTokenExpiryMs(token);
  if (!expMs) return;
  const remaining = expMs - Date.now();
  if (remaining <= 0) return;
  const delay = remaining <= ACCESS_REFRESH_LEAD_MS
    ? 1000
    : remaining - ACCESS_REFRESH_LEAD_MS;
  accessRefreshTimer = setTimeout(() => {
    accessRefreshTimer = null;
    refreshAccessToken().catch(() => {
      /* refreshAccessToken emits session-expired on failure */
    });
  }, delay);
  accessRefreshTimer?.unref?.();
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== ACCESS_KEY) return;
    if (event.newValue) {
      accessToken = event.newValue;
      scheduleAccessRefresh(event.newValue);
      return;
    }
    accessToken = null;
    clearAccessRefreshTimer();
    emitSessionExpired();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    const token = accessToken || readAccessStorage();
    const expMs = readAccessTokenExpiryMs(token);
    if (!expMs) return;
    if (expMs - Date.now() <= ACCESS_REFRESH_LEAD_MS) {
      refreshAccessToken().catch(() => {});
    }
  });
}

function writeAccessStorage(token) {
  try {
    if (token) {
      // localStorage survives tab/browser close so one login lasts the JWT lifetime (24h).
      localStorage.setItem(ACCESS_KEY, token);
      sessionStorage.removeItem(ACCESS_KEY);
      sessionStorage.removeItem(LEGACY_ACCESS_KEY);
      localStorage.removeItem(LEGACY_ACCESS_KEY);
    } else {
      localStorage.removeItem(ACCESS_KEY);
      sessionStorage.removeItem(ACCESS_KEY);
      localStorage.removeItem(LEGACY_ACCESS_KEY);
      sessionStorage.removeItem(LEGACY_ACCESS_KEY);
    }
  } catch {
    /* private mode / quota — keep in-memory token only */
  }
}

function readAccessStorage() {
  try {
    let token = localStorage.getItem(ACCESS_KEY);
    if (!token) {
      token = sessionStorage.getItem(ACCESS_KEY)
        || sessionStorage.getItem(LEGACY_ACCESS_KEY)
        || localStorage.getItem(LEGACY_ACCESS_KEY);
      if (token) {
        localStorage.setItem(ACCESS_KEY, token);
        sessionStorage.removeItem(ACCESS_KEY);
        sessionStorage.removeItem(LEGACY_ACCESS_KEY);
        localStorage.removeItem(LEGACY_ACCESS_KEY);
      }
    }
    return token;
  } catch {
    return null;
  }
}

function setLogoutLatch(active) {
  try {
    if (active) sessionStorage.setItem(LOGOUT_LATCH_KEY, '1');
    else sessionStorage.removeItem(LOGOUT_LATCH_KEY);
  } catch {
    /* ignore */
  }
}

function hasLogoutLatch() {
  try {
    return sessionStorage.getItem(LOGOUT_LATCH_KEY) === '1';
  } catch {
    return false;
  }
}

export function setAccessToken(token) {
  if (token) {
    setLogoutLatch(false);
    accessToken = token;
    writeAccessStorage(token);
    scheduleAccessRefresh(token);
    return;
  }
  accessToken = null;
  writeAccessStorage(null);
  clearAccessRefreshTimer();
}

/**
 * Clear local auth and invalidate in-flight cookie refresh so a late /auth/refresh
 * response cannot rewrite localStorage after logout.
 */
export function clearLocalAuthSession() {
  authGeneration += 1;
  setLogoutLatch(true);
  accessToken = null;
  writeAccessStorage(null);
  refreshPromise = null;
  clearAccessRefreshTimer();
  return authGeneration;
}

export function loadStoredToken() {
  if (hasLogoutLatch()) {
    accessToken = null;
    writeAccessStorage(null);
    return null;
  }
  accessToken = readAccessStorage();
  return accessToken;
}

function isAuthRefreshExempt(path) {
  const p = String(path || '');
  return (
    p.includes('/auth/login')
    || p.includes('/auth/logout')
    || p.includes('/auth/refresh')
    || p.includes('/auth/reset-password')
  );
}

/**
 * Exchange httpOnly refresh cookie for a new access token.
 * Safe to call concurrently — only one network refresh runs at a time.
 * Discarded if logout cleared the session while the request was in flight.
 */
export async function refreshAccessToken() {
  if (hasLogoutLatch()) {
    accessToken = null;
    writeAccessStorage(null);
    const err = new Error('Session expired');
    err.status = 401;
    err.code = 'LOGGED_OUT';
    throw err;
  }

  if (!refreshPromise) {
    const generationAtStart = authGeneration;
    refreshPromise = (async () => {
      const res = await fetch(apiUrl('/auth/refresh'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: '{}',
        cache: 'no-store',
      });
      let json = null;
      try {
        json = await res.json();
      } catch {
        json = null;
      }

      if (generationAtStart !== authGeneration || hasLogoutLatch()) {
        accessToken = null;
        writeAccessStorage(null);
        const err = new Error('Session expired');
        err.status = 401;
        err.code = 'LOGGED_OUT';
        throw err;
      }

      if (!res.ok) {
        setAccessToken(null);
        emitSessionExpired();
        const err = new Error(json?.error?.message || 'Session expired');
        err.status = res.status;
        err.code = json?.error?.code;
        throw err;
      }
      const next = json?.data?.accessToken;
      if (!next) {
        setAccessToken(null);
        emitSessionExpired();
        throw new Error('Session expired');
      }

      if (generationAtStart !== authGeneration || hasLogoutLatch()) {
        accessToken = null;
        writeAccessStorage(null);
        const err = new Error('Session expired');
        err.status = 401;
        err.code = 'LOGGED_OUT';
        throw err;
      }

      setAccessToken(next);
      return json.data;
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function parseJsonSafe(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { error: { message: text || 'Invalid response' } };
  }
}

function toApiError(json, status, requestPath = '') {
  const serverMessage = json?.error?.message;
  const isImportPath = /\/import\b|\/imports\b|pin-codes\/import|excel/i.test(String(requestPath));
  let message = serverMessage;
  if (!message) {
    if (status === 413) {
      message = isImportPath
        ? 'This file is larger than 3 MB. Reduce the file (max 1,000 rows) and upload again.'
        : 'This file is too large for this upload. Choose a smaller file and try again.';
    } else if (status === 429) {
      message = isImportPath
        ? 'Too many imports were started in a short time. Wait a few minutes, then try again with a .csv or Excel file.'
        : 'Too many requests. Wait a few minutes and try again.';
    } else {
      message = `Request failed (${status})`;
    }
  }
  const err = new Error(message);
  err.status = status;
  err.code = json?.error?.code;
  err.details = json?.error?.details;
  return err;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientNetworkError(err) {
  const msg = String(err?.message || '');
  return /failed to fetch|networkerror|load failed|network request failed/i.test(msg);
}

function networkUnreachableError(cause) {
  const netErr = new Error(
    'Could not reach the server (connection lost or timed out). Try again in a moment.',
  );
  netErr.code = 'NETWORK_UPLOAD_FAILED';
  netErr.cause = cause;
  return netErr;
}

/**
 * Retry briefly on connection drops (Render free cold-start / brief blips).
 * Safe for GET; one retry for mutating methods when the request never got a response.
 */
function maxNetworkRetries(method = 'GET') {
  const m = String(method || 'GET').toUpperCase();
  return m === 'GET' || m === 'HEAD' ? 2 : 1;
}

export async function api(path, options = {}, retried = false, networkAttempt = 0) {
  if (accessToken == null) loadStoredToken();

  const headers = { ...(options.headers || {}) };
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }
  // Do not clobber an explicit Authorization (e.g. logout with a snapshot bearer
  // after local storage was already cleared).
  if (accessToken && !headers.Authorization) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const method = options.method || 'GET';
  let res;
  try {
    res = await fetch(apiUrl(path), {
      ...options,
      headers,
      credentials: 'include',
      body:
        options.body && !(options.body instanceof FormData) && typeof options.body === 'object'
          ? JSON.stringify(options.body)
          : options.body,
    });
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    if (isTransientNetworkError(err) && networkAttempt < maxNetworkRetries(method)) {
      await sleep(400 * (networkAttempt + 1));
      return api(path, options, retried, networkAttempt + 1);
    }
    if (isTransientNetworkError(err)) throw networkUnreachableError(err);
    throw err;
  }

  const json = await parseJsonSafe(res);

  if (!res.ok) {
    if (res.status === 401 && !retried && !isAuthRefreshExempt(path)) {
      try {
        await refreshAccessToken();
        return api(path, options, true, networkAttempt);
      } catch {
        /* fall through with original 401 */
      }
    }
    // Brief 503 / gateway blips on free tier — retry GET once more.
    if (
      (res.status === 502 || res.status === 503 || res.status === 504)
      && networkAttempt < maxNetworkRetries(method)
      && String(method).toUpperCase() === 'GET'
    ) {
      await sleep(500 * (networkAttempt + 1));
      return api(path, options, retried, networkAttempt + 1);
    }
    throw toApiError(json, res.status, path);
  }

  return json;
}

/** Download an authenticated Excel (or other blob) export from the API. */
export async function downloadExcel(path, filename, retried = false) {
  if (accessToken == null) loadStoredToken();
  const headers = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const res = await fetch(apiUrl(path), {
    headers,
    credentials: 'include',
  });

  if (!res.ok) {
    if (res.status === 401 && !retried) {
      try {
        await refreshAccessToken();
        return downloadExcel(path, filename, true);
      } catch {
        /* fall through */
      }
    }
    let message = `Download failed (${res.status}). Please try again.`;
    try {
      const json = await res.json();
      if (json?.error?.message) message = json.error.message;
    } catch {
      if (res.status === 413) {
        message = 'This file is too large. Choose a smaller file and try again.';
      } else if (res.status === 429) {
        message = 'Too many requests. Wait a few minutes and try again.';
      }
    }
    throw new Error(message);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'export.xlsx';
  a.click();
  URL.revokeObjectURL(url);
}

/** Authenticated blob/file fetch helper for PDF and template downloads. */
export async function apiFetch(path, options = {}, retried = false) {
  if (accessToken == null) loadStoredToken();
  const headers = { ...(options.headers || {}) };
  if (accessToken && !headers.Authorization) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  const res = await fetch(apiUrl(path), {
    credentials: 'include',
    ...options,
    headers,
  });

  if (res.status === 401 && !retried && !isAuthRefreshExempt(path)) {
    try {
      await refreshAccessToken();
      return apiFetch(path, options, true);
    } catch {
      /* return original 401 response */
    }
  }

  return res;
}

/**
 * Liveness check against GET /api/v1/live (falls back to /health).
 * Resolves when the API responds 200 with live/ok status.
 */
export async function checkServerLive({ signal } = {}) {
  const tryPath = async (path) => {
    const res = await fetch(apiUrl(path), {
      method: 'GET',
      credentials: 'omit',
      cache: 'no-store',
      signal,
    });
    if (!res.ok) {
      throw new Error(`Server returned ${res.status}`);
    }
    const json = await res.json().catch(() => ({}));
    const data = json?.data || json || {};
    if (data.live === false || (data.status && data.status !== 'ok')) {
      throw new Error('Server reported unhealthy');
    }
    return data;
  };

  try {
    return await tryPath('/live');
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    return tryPath('/health');
  }
}
