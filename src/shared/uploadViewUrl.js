import { api } from './api.js';
import { apiUrl } from './config.js';

/** True when the URL would hit the blocked static /uploads tree. */
export function isDirectUploadPath(url = '') {
  const raw = String(url || '').trim();
  if (!raw) return false;
  if (raw.includes('/files/signed')) return false;
  return /\/uploads\//i.test(raw) || raw.startsWith('uploads/');
}

/**
 * Turn a stored `/uploads/...` or signed file path into a browser-openable URL.
 * Always re-signs upload paths (including expired signed tokens) via the API so
 * Master One View never opens a stale JWT.
 */
export async function resolveUploadViewUrl(url = '') {
  const raw = String(url || '').trim();
  if (!raw) return '';
  if (isDirectUploadPath(raw) || raw.includes('/files/signed')) {
    const { data } = await api('/files/sign', { method: 'POST', body: { path: raw } });
    return apiUrl(data?.url || '');
  }
  return apiUrl(raw);
}

/** Open an upload in a new tab, signing first when needed. */
export async function openUploadView(url = '') {
  const href = await resolveUploadViewUrl(url);
  if (!href) throw new Error('File link is missing');
  window.open(href, '_blank', 'noopener,noreferrer');
}
