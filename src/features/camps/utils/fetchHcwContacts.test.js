/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../shared/api.js', () => ({
  api: vi.fn(),
}));

import { api } from '../../../shared/api.js';
import { clearApiCache } from '../../../shared/apiCache.js';
import { fetchHealthcareWorkerContactsPage } from './fetchHcwContacts.js';

describe('fetchHealthcareWorkerContactsPage', () => {
  beforeEach(() => {
    clearApiCache();
    api.mockReset();
  });

  it('honors maxPages so later-named HCWs are not stuck off page 1', async () => {
    api
      .mockResolvedValueOnce({
        data: [{ _id: 'a', name: 'Asha' }, { _id: 'b', name: 'Bina' }],
        meta: { pages: 2 },
      })
      .mockResolvedValueOnce({
        data: [{ _id: 'z', name: 'Zoya' }],
        meta: { pages: 2 },
      });

    const rows = await fetchHealthcareWorkerContactsPage({
      maxPages: 2,
      pageSize: 2,
      useCache: false,
      state: 'Maharashtra',
      professions: ['Nurse'],
    });

    expect(api).toHaveBeenCalledTimes(2);
    expect(rows.map((row) => row.name)).toEqual(['Asha', 'Bina', 'Zoya']);
    expect(String(api.mock.calls[0][1]?.cache || '')).toBe('no-store');
  });
});
