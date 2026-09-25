import { api } from '../../../shared/api.js';
import { cachedGet, clearApiCache } from '../../../shared/apiCache.js';

/** First page for state + profession (fast Assignment open). */
export const ASSIGN_HCW_INITIAL_LIMIT = 75;
/** Typeahead page size — merge results into the picker as the user types. */
export const ASSIGN_HCW_SEARCH_LIMIT = 75;

/**
 * Load Healthcare Worker contacts for Camp One Assignment.
 * Initial: first 75 matching state + profession.
 * Typeahead: pass q to pull the next matching page and merge.
 */
export async function fetchHealthcareWorkerContactsPage({
  pageSize = ASSIGN_HCW_INITIAL_LIMIT,
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
  signal = null,
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
  const hardCap = fullDirectory ? 2000 : Math.min(200, Number(pageSize) || ASSIGN_HCW_INITIAL_LIMIT);
  const capped = Math.min(Math.max(1, Number(pageSize) || ASSIGN_HCW_INITIAL_LIMIT), hardCap);
  const pageBudget = fullDirectory ? Math.max(1, maxPages || 1) : 1;
  const cacheKey = `hcw-contacts:v3:ps=${capped}:mp=${pageBudget}:q=${qTrim}:rt=${rt}:st=${st}:ct=${ct}:pr=${roleKey}:sp=${linked}:fd=${fullDirectory ? 1 : 0}:assign=1`;

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
      const res = await api(`/contacts?${params}`, signal ? { signal } : {});
      const batch = Array.isArray(res?.data) ? res.data : [];
      all.push(...batch);
      pages = Math.max(1, Number(res?.meta?.pages) || 1);
      if (!batch.length) break;
      page += 1;
    } while (page <= pages && page <= pageBudget && all.length < hardCap);

    return all;
  };

  if (!useCache) return loader();
  // Don't cache abortable in-flight requests with a signal — caller owns lifecycle.
  if (signal) return loader();
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

  const isSearch = Boolean(String(opts.q || '').trim());
  const pageSize = opts.pageSize
    || (isSearch ? ASSIGN_HCW_SEARCH_LIMIT : ASSIGN_HCW_INITIAL_LIMIT);
  const maxPages = opts.maxPages || 1;

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
    pageSize: opts.pageSize || ASSIGN_HCW_INITIAL_LIMIT,
    maxPages: opts.maxPages || 1,
    q: opts.q || '',
    useCache: opts.useCache !== false,
  });
}
