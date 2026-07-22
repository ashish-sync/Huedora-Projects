import { apiUrl } from './config.js';

export { BACKEND_URL, API_BASE, apiUrl } from './config.js';

let accessToken = null;
/** In-flight refresh so concurrent 401s share one cookie refresh. */
let refreshPromise = null;

const ACCESS_KEY = 'tylo_one_access';
const LEGACY_ACCESS_KEY = 'dhub_access';

export function setAccessToken(token) {
  accessToken = token;
  if (token) {
    sessionStorage.setItem(ACCESS_KEY, token);
    sessionStorage.removeItem(LEGACY_ACCESS_KEY);
  } else {
    sessionStorage.removeItem(ACCESS_KEY);
    sessionStorage.removeItem(LEGACY_ACCESS_KEY);
  }
}

export function loadStoredToken() {
  accessToken = sessionStorage.getItem(ACCESS_KEY);
  if (!accessToken) {
    const legacy = sessionStorage.getItem(LEGACY_ACCESS_KEY);
    if (legacy) {
      sessionStorage.setItem(ACCESS_KEY, legacy);
      sessionStorage.removeItem(LEGACY_ACCESS_KEY);
      accessToken = legacy;
    }
  }
  return accessToken;
}

function isAuthRefreshExempt(path) {
  const p = String(path || '');
  return (
    p.includes('/auth/login')
    || p.includes('/auth/refresh')
    || p.includes('/auth/reset-password')
  );
}

/**
 * Exchange httpOnly refresh cookie for a new access token.
 * Safe to call concurrently — only one network refresh runs at a time.
 */
export async function refreshAccessToken() {
  if (!refreshPromise) {
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
      if (!res.ok) {
        setAccessToken(null);
        const err = new Error(json?.error?.message || 'Session expired');
        err.status = res.status;
        err.code = json?.error?.code;
        throw err;
      }
      const next = json?.data?.accessToken;
      if (!next) {
        setAccessToken(null);
        throw new Error('Session expired');
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

function toApiError(json, status) {
  const err = new Error(json?.error?.message || `Request failed (${status})`);
  err.status = status;
  err.code = json?.error?.code;
  err.details = json?.error?.details;
  return err;
}

export async function api(path, options = {}, retried = false) {
  if (accessToken == null) loadStoredToken();

  const headers = { ...(options.headers || {}) };
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const res = await fetch(apiUrl(path), {
    ...options,
    headers,
    credentials: 'include',
    body:
      options.body && !(options.body instanceof FormData) && typeof options.body === 'object'
        ? JSON.stringify(options.body)
        : options.body,
  });

  const json = await parseJsonSafe(res);

  if (!res.ok) {
    if (res.status === 401 && !retried && !isAuthRefreshExempt(path)) {
      try {
        await refreshAccessToken();
        return api(path, options, true);
      } catch {
        /* fall through with original 401 */
      }
    }
    throw toApiError(json, res.status);
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
    let message = `Download failed (${res.status})`;
    try {
      const json = await res.json();
      if (json?.error?.message) message = json.error.message;
    } catch {
      /* ignore */
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
      credentials: 'include',
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
