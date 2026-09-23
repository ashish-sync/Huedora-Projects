import { api } from '../../../shared/api.js';
import { cachedGet } from '../../../shared/apiCache.js';

/**
 * Load Healthcare Worker contacts for Camp One Assignment.
 * Default window matches the BE HCW maxLimit (2000) so the picker sees the
 * full Contact Directory; pass `q` for server-side search when typing.
 * Results are cached briefly so opening Assignment does not wait on a cold refetch.
 */
export async function fetchHealthcareWorkerContactsPage({
  pageSize = 2000,
  maxPages = 1,
  q = '',
  useCache = true,
} = {}) {
  const qTrim = String(q || '').trim();
  const cacheKey = `hcw-contacts:ps=${pageSize}:mp=${maxPages}:q=${qTrim}:assign=1`;

  const loader = async () => {
    const all = [];
    let page = 1;
    let pages = 1;
    const qParam = qTrim ? `&q=${encodeURIComponent(qTrim)}` : '';

    do {
      const res = await api(
        `/contacts?contactCategory=${encodeURIComponent('Healthcare Worker')}&limit=${pageSize}&page=${page}&assign=1${qParam}`,
      );
      const batch = Array.isArray(res?.data) ? res.data : [];
      all.push(...batch);
      pages = Math.max(1, Number(res?.meta?.pages) || 1);
      if (!batch.length) break;
      page += 1;
    } while (page <= pages && page <= maxPages);

    return all;
  };

  if (!useCache) return loader();
  return cachedGet(cacheKey, loader, { ttlMs: 2 * 60 * 1000 });
}

/** @deprecated Use fetchHealthcareWorkerContactsPage — kept for older callers. */
export async function fetchAllHealthcareWorkerContacts(opts = {}) {
  return fetchHealthcareWorkerContactsPage({
    pageSize: opts.pageSize || 2000,
    maxPages: opts.maxPages || 1,
    q: opts.q || '',
    useCache: opts.useCache !== false,
  });
}
