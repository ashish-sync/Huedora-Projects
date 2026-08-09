import { api } from '../../../shared/api.js';

/**
 * Load all Healthcare Worker contacts for assignment.
 * Pages through the contacts API so production directories larger than one page are not truncated.
 */
export async function fetchAllHealthcareWorkerContacts({
  pageSize = 500,
  maxPages = 20,
} = {}) {
  const all = [];
  let page = 1;
  let pages = 1;

  do {
    const res = await api(
      `/contacts?contactCategory=${encodeURIComponent('Healthcare Worker')}&limit=${pageSize}&page=${page}`
    );
    const batch = Array.isArray(res?.data) ? res.data : [];
    all.push(...batch);
    pages = Math.max(1, Number(res?.meta?.pages) || 1);
    if (!batch.length) break;
    page += 1;
  } while (page <= pages && page <= maxPages);

  return all;
}
