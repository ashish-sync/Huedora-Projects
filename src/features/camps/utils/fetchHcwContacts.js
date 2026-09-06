import { api } from '../../../shared/api.js';

/**
 * Load Healthcare Worker contacts with a hard page cap (no 20×500 crawl).
 * Prefer this over full-directory hydrate for assignment pickers.
 */
export async function fetchHealthcareWorkerContactsPage({
  pageSize = 100,
  maxPages = 3,
  q = '',
} = {}) {
  const all = [];
  let page = 1;
  let pages = 1;
  const qParam = String(q || '').trim()
    ? `&q=${encodeURIComponent(String(q).trim())}`
    : '';

  do {
    const res = await api(
      `/contacts?contactCategory=${encodeURIComponent('Healthcare Worker')}&limit=${pageSize}&page=${page}${qParam}`,
    );
    const batch = Array.isArray(res?.data) ? res.data : [];
    all.push(...batch);
    pages = Math.max(1, Number(res?.meta?.pages) || 1);
    if (!batch.length) break;
    page += 1;
  } while (page <= pages && page <= maxPages);

  return all;
}

/** @deprecated Use fetchHealthcareWorkerContactsPage — kept for older callers. */
export async function fetchAllHealthcareWorkerContacts(opts = {}) {
  return fetchHealthcareWorkerContactsPage({
    pageSize: opts.pageSize || 100,
    maxPages: opts.maxPages || 3,
  });
}
