import { api } from './api.js';
import { cachedGet, clearApiCache } from './apiCache.js';

/**
 * Cached Contact Directory list fetches for picker pages.
 * Avoids refetch storms when Logistics / Movements / Finance remount.
 */
export function fetchContactsList({
  limit = 200,
  contactCategory = '',
  resourceType = '',
  ttlMs = 2 * 60 * 1000,
  useCache = true,
  signal = null,
} = {}) {
  const lim = Math.max(1, Math.min(500, Number(limit) || 200));
  const cat = String(contactCategory || '').trim();
  const rt = String(resourceType || '').trim();
  const params = new URLSearchParams({ limit: String(lim) });
  if (cat) params.set('contactCategory', cat);
  if (rt) params.set('resourceType', rt);
  const cacheKey = `contacts:list:v1:${params.toString()}`;

  const loader = async () => {
    const res = await api(`/contacts?${params}`, signal ? { signal } : {});
    return Array.isArray(res?.data) ? res.data : [];
  };

  if (!useCache || signal) return loader();
  return cachedGet(cacheKey, loader, { ttlMs });
}

export function clearContactsListCache() {
  clearApiCache('contacts:list:');
}

/** Call after Contact Directory create/update/import so pickers see fresh rows. */
export function invalidateContactsCaches() {
  clearContactsListCache();
  clearApiCache('hcw-contacts:');
  clearApiCache('hcw-assign-facets:');
}
