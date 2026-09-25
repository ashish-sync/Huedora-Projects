import { api } from '../../../shared/api.js';
import { cachedGet } from '../../../shared/apiCache.js';

/**
 * Load Healthcare Worker contacts for Camp One Assignment.
 * Default page is 100 with server-side filters (q, resourceType, state, city).
 * Pass fullDirectory: true only for explicit admin/export-style dumps (max 2000).
 */
export async function fetchHealthcareWorkerContactsPage({
  pageSize = 100,
  maxPages = 1,
  q = '',
  resourceType = '',
  state = '',
  city = '',
  hasServiceProvider = false,
  fullDirectory = false,
  useCache = true,
} = {}) {
  const qTrim = String(q || '').trim();
  const rt = String(resourceType || '').trim();
  const st = String(state || '').trim();
  const ct = String(city || '').trim();
  const linked = hasServiceProvider ? '1' : '0';
  const capped = fullDirectory ? Math.min(pageSize || 2000, 2000) : Math.min(pageSize || 100, 100);
  const cacheKey = `hcw-contacts:ps=${capped}:mp=${maxPages}:q=${qTrim}:rt=${rt}:st=${st}:ct=${ct}:sp=${linked}:fd=${fullDirectory ? 1 : 0}:assign=1`;

  const loader = async () => {
    const all = [];
    let page = 1;
    let pages = 1;
    const params = new URLSearchParams({
      contactCategory: 'Healthcare Worker',
      limit: String(capped),
      assign: '1',
    });
    if (fullDirectory) params.set('fullDirectory', '1');
    if (qTrim) params.set('q', qTrim);
    if (rt) params.set('resourceType', rt);
    if (st) params.set('state', st);
    if (ct) params.set('city', ct);
    if (hasServiceProvider) params.set('hasServiceProvider', '1');

    do {
      params.set('page', String(page));
      const res = await api(`/contacts?${params}`);
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

/**
 * Contacts needed for one Assignment resource-type choice.
 * Full-Time / Individual → that type only.
 * Service Provider → agencies (+ embedded employees) and linked staff.
 */
export async function fetchAssignableContactsForResourceType(resourceType, opts = {}) {
  const rt = String(resourceType || '').trim();
  if (!rt) return [];

  if (rt === 'Service Provider') {
    const [providers, linkedStaff] = await Promise.all([
      fetchHealthcareWorkerContactsPage({
        ...opts,
        resourceType: 'Service Provider',
        pageSize: opts.pageSize || 100,
        maxPages: opts.maxPages || 1,
      }),
      fetchHealthcareWorkerContactsPage({
        ...opts,
        hasServiceProvider: true,
        pageSize: opts.pageSize || 100,
        maxPages: opts.maxPages || 1,
      }),
    ]);
    const byId = new Map();
    for (const row of [...providers, ...linkedStaff]) {
      if (row?._id) byId.set(String(row._id), row);
    }
    return [...byId.values()];
  }

  return fetchHealthcareWorkerContactsPage({
    ...opts,
    resourceType: rt,
    pageSize: opts.pageSize || 100,
    maxPages: opts.maxPages || 1,
  });
}

/** @deprecated Prefer filtered fetchHealthcareWorkerContactsPage (limit 100). */
export async function fetchAllHealthcareWorkerContacts(opts = {}) {
  return fetchHealthcareWorkerContactsPage({
    pageSize: opts.pageSize || 100,
    maxPages: opts.maxPages || 1,
    q: opts.q || '',
    useCache: opts.useCache !== false,
  });
}
