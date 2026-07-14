import { apiUrl } from './config.js';

export { BACKEND_URL, API_BASE, apiUrl } from './config.js';

let accessToken = null;

export function setAccessToken(token) {
  accessToken = token;
  if (token) sessionStorage.setItem('dhub_access', token);
  else sessionStorage.removeItem('dhub_access');
}

export function loadStoredToken() {
  accessToken = sessionStorage.getItem('dhub_access');
  return accessToken;
}

export async function api(path, options = {}) {
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

  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { error: { message: text || 'Invalid response' } };
  }

  if (!res.ok) {
    const err = new Error(json?.error?.message || `Request failed (${res.status})`);
    err.status = res.status;
    err.code = json?.error?.code;
    err.details = json?.error?.details;
    throw err;
  }

  return json;
}

/** Download an authenticated Excel (or other blob) export from the API. */
export async function downloadExcel(path, filename) {
  if (accessToken == null) loadStoredToken();
  const headers = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const res = await fetch(apiUrl(path), {
    headers,
    credentials: 'include',
  });

  if (!res.ok) {
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
export async function apiFetch(path, options = {}) {
  if (accessToken == null) loadStoredToken();
  const headers = { ...(options.headers || {}) };
  if (accessToken && !headers.Authorization) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  return fetch(apiUrl(path), {
    credentials: 'include',
    ...options,
    headers,
  });
}
