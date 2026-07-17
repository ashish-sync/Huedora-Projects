/**
 * Backend base URL (no trailing slash).
 * Set via VITE_BACKEND_URL — e.g. http://localhost:5000 or https://api.example.com.
 * Local Vite uses its `/api` proxy. The Render fallback keeps the public frontend
 * connected if its build-time environment variable is accidentally omitted.
 */
const RENDER_BACKEND_FALLBACK =
  typeof window !== 'undefined' && window.location.hostname === 'huedora-projects.onrender.com'
    ? 'https://huedora-projects-server.onrender.com'
    : '';

export const BACKEND_URL = String(
  import.meta.env.VITE_BACKEND_URL || RENDER_BACKEND_FALLBACK
)
  .trim()
  .replace(/\/$/, '');

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
