const STORAGE_KEY = 'campOps:manageDateFilter';

/**
 * Persist Manage Camps date filter across edit/new navigation.
 * Cleared only when the user clears dates (or Clear all).
 */
export function readStoredManageDateFilter() {
  if (typeof window === 'undefined') return { dateFrom: '', dateTo: '' };
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { dateFrom: '', dateTo: '' };
    const parsed = JSON.parse(raw);
    return {
      dateFrom: String(parsed?.dateFrom || '').trim(),
      dateTo: String(parsed?.dateTo || '').trim(),
    };
  } catch {
    return { dateFrom: '', dateTo: '' };
  }
}

export function writeStoredManageDateFilter({ dateFrom = '', dateTo = '' } = {}) {
  if (typeof window === 'undefined') return;
  const from = String(dateFrom || '').trim();
  const to = String(dateTo || '').trim();
  if (!from && !to) {
    window.sessionStorage.removeItem(STORAGE_KEY);
    return;
  }
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ dateFrom: from, dateTo: to }));
}

export function clearStoredManageDateFilter() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(STORAGE_KEY);
}
