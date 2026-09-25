/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import { cachedGet, clearApiCache, apiCacheStats } from './apiCache.js';

describe('apiCache bounds', () => {
  it('evicts oldest entries when maxEntries exceeded', async () => {
    clearApiCache();
    for (let i = 0; i < 25; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await cachedGet(`k-${i}`, async () => i, { ttlMs: 60_000, maxEntries: 10 });
    }
    const stats = apiCacheStats();
    expect(stats.size).toBeLessThanOrEqual(10);
    clearApiCache();
  });

  it('reuses in-flight and resolved values within TTL', async () => {
    clearApiCache();
    let calls = 0;
    const loader = async () => {
      calls += 1;
      return 'ok';
    };
    const a = await cachedGet('same', loader, { ttlMs: 60_000 });
    const b = await cachedGet('same', loader, { ttlMs: 60_000 });
    expect(a).toBe('ok');
    expect(b).toBe('ok');
    expect(calls).toBe(1);
    clearApiCache();
  });
});
