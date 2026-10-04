/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./api.js', () => ({
  api: vi.fn(async () => ({ data: [{ _id: 'c1', name: 'Ada' }] })),
}));

import { api } from './api.js';
import { clearApiCache } from './apiCache.js';
import {
  clearContactsListCache,
  fetchContactsList,
  invalidateContactsCaches,
} from './contactsApi.js';

describe('contactsApi cache', () => {
  beforeEach(() => {
    clearApiCache();
    clearContactsListCache();
    api.mockClear();
  });

  it('dedupes identical contact list fetches within TTL', async () => {
    const a = await fetchContactsList({ limit: 200 });
    const b = await fetchContactsList({ limit: 200 });
    expect(a).toEqual([{ _id: 'c1', name: 'Ada' }]);
    expect(b).toEqual(a);
    expect(api).toHaveBeenCalledTimes(1);
  });

  it('uses distinct cache keys for category filters', async () => {
    await fetchContactsList({ limit: 100, contactCategory: 'Vendor' });
    await fetchContactsList({ limit: 100 });
    expect(api).toHaveBeenCalledTimes(2);
  });

  it('refetches after invalidateContactsCaches (create/update/import path)', async () => {
    await fetchContactsList({ limit: 200 });
    invalidateContactsCaches();
    api.mockImplementationOnce(async () => ({ data: [{ _id: 'c2', name: 'Bea' }] }));
    const next = await fetchContactsList({ limit: 200 });
    expect(api).toHaveBeenCalledTimes(2);
    expect(next).toEqual([{ _id: 'c2', name: 'Bea' }]);
  });
});
