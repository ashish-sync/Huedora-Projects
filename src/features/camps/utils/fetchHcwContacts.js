import { api } from '../../../shared/api.js';
import { cachedGet, clearApiCache } from '../../../shared/apiCache.js';

/**
 * Load Healthcare Worker contacts for Camp One Assignment.
 * Prefer state + profession filters so large cohorts (e.g. West Bengal Dieticians)
 * are returned from the server instead of a mixed first page.
 */
export async function fetchHealthcareWorkerContactsPage({
  pageSize = 100,
  maxPages = 1,
  q = '',
  resourceType = '',
  state = '',
  city = '',
  profession = '',
  professions = [],
  hasServiceProvider = false,
  fullDirectory = false,
  useCache = true,
} = {}) {
  const qTrim = String(q || '').trim();
  const rt = String(resourceType || '').trim();
  const st = String(state || '').trim();
  const ct = String(city || '').trim();
  const roleList = [
    ...String(profession || '').split(','),
    ...(Array.isArray(professions) ? professions : [professions]),
  ]
    .map((s) => String(s || '').trim())
    .filter(Boolean);
  const roleKey = [...new Set(roleList)].sort().join(',');
  const linked = hasServiceProvider ? '1' : '0';
  const filtered = Boolean(qTrim || st || ct || roleKey);
  // State+profession (or any geo/role filter): allow up to 2000 matching rows.
  const hardCap = fullDirectory || filtered ? 2000 : 100;
  const capped = Math.min(Math.max(1, pageSize || (filtered ? 500 : 100)), hardCap);
  const pageBudget = fullDirectory || filtered
    ? Math.max(1, maxPages || Math.ceil(hardCap / capped))
    : Math.max(1, maxPages || 1);
  const cacheKey = `hcw-contacts:v2:ps=${capped}:mp=${pageBudget}:q=${qTrim}:rt=${rt}:st=${st}:ct=${ct}:pr=${roleKey}:sp=${linked}:fd=${fullDirectory ? 1 : 0}:assign=1`;

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
    if (roleKey) params.set('profession', roleKey);
    if (hasServiceProvider) params.set('hasServiceProvider', '1');

    do {
      params.set('page', String(page));
      const res = await api(`/contacts?${params}`);
      const batch = Array.isArray(res?.data) ? res.data : [];
      all.push(...batch);
      pages = Math.max(1, Number(res?.meta?.pages) || 1);
      if (!batch.length) break;
      page += 1;
    } while (page <= pages && page <= pageBudget && all.length < hardCap);

    return all;
  };

  if (!useCache) return loader();
  return cachedGet(cacheKey, loader, { ttlMs: 60 * 1000 });
}

/**
 * Contacts needed for one Assignment resource-type choice.
 * Full-Time / Individual → that type only.
 * Service Provider → agencies (+ embedded employees) and linked staff.
 */
export async function fetchAssignableContactsForResourceType(resourceType, opts = {}) {
  const rt = String(resourceType || '').trim();
  if (!rt) return [];

  const filtered = Boolean(
    String(opts.state || '').trim()
    || String(opts.city || '').trim()
    || String(opts.profession || '').trim()
    || (Array.isArray(opts.professions) && opts.professions.length)
    || String(opts.q || '').trim(),
  );
  const pageSize = opts.pageSize || (filtered ? 500 : 100);
  const maxPages = opts.maxPages || (filtered ? 4 : 1);

  if (rt === 'Service Provider') {
    const [providers, linkedStaff] = await Promise.all([
      fetchHealthcareWorkerContactsPage({
        ...opts,
        resourceType: 'Service Provider',
        pageSize,
        maxPages,
      }),
      fetchHealthcareWorkerContactsPage({
        ...opts,
        hasServiceProvider: true,
        // Linked staff professions are on the staff contact — keep role filter.
        pageSize,
        maxPages,
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
    pageSize,
    maxPages,
  });
}

/** Drop cached HCW assign pages (call after filter semantics change). */
export function clearHcwAssignContactCache() {
  clearApiCache('hcw-contacts:');
}

/** @deprecated Prefer filtered fetchHealthcareWorkerContactsPage. */
export async function fetchAllHealthcareWorkerContacts(opts = {}) {
  return fetchHealthcareWorkerContactsPage({
    pageSize: opts.pageSize || 100,
    maxPages: opts.maxPages || 1,
    q: opts.q || '',
    useCache: opts.useCache !== false,
  });
}
