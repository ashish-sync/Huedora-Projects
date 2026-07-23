/**
 * Backend base URL (no trailing slash).
 * Set via VITE_BACKEND_URL, e.g. http://localhost:5000 or https://api.example.com.
 * Local Vite uses its `/api` proxy. The Render fallback keeps the public frontend
 * connected if its build-time environment variable is accidentally omitted.
 */
function resolveRenderBackendFallback() {
  if (typeof window === 'undefined') return '';
  const host = String(window.location.hostname || '').toLowerCase();
  if (host === 'huedora-projects.onrender.com' || host.endsWith('.onrender.com')) {
    return 'https://huedora-projects-server.onrender.com';
  }
  return '';
}

function resolveBackendUrl() {
  const fromEnv = String(import.meta.env.VITE_BACKEND_URL || '').trim().replace(/\/$/, '');
  const fallback = resolveRenderBackendFallback();

  if (typeof window !== 'undefined' && fromEnv) {
    try {
      const pageHost = window.location.hostname.toLowerCase();
      const envHost = new URL(fromEnv).hostname.toLowerCase();
      // Render sometimes sets VITE_BACKEND_URL to the static site URL — ignore that.
      if (envHost === pageHost) return fallback || fromEnv;
    } catch {
      /* ignore malformed env URL */
    }
  }

  return fromEnv || fallback;
}

export const BACKEND_URL = resolveBackendUrl();

/** API root including /api/v1 */
export const API_BASE = BACKEND_URL ? `${BACKEND_URL}/api/v1` : '/api/v1';

/**
 * Build a full URL for an API path.
 * Accepts `/devices`, `devices`, `/api/v1/devices`, or a full http(s) URL.
 */
export function apiUrl(path = '') {
  const raw = String(path || '');
  if (/^https?:\/\//i.test(raw)) return raw;

  let p = raw.startsWith('/') ? raw : `/${raw}`;
  if (p.startsWith('/api/v1')) {
    return BACKEND_URL ? `${BACKEND_URL}${p}` : p;
  }
  if (p.startsWith('/api/') || p === '/api') {
    return BACKEND_URL ? `${BACKEND_URL}${p}` : p;
  }
  if (p.startsWith('/uploads')) {
    return BACKEND_URL ? `${BACKEND_URL}${p}` : p;
  }
  return `${API_BASE}${p}`;
}
