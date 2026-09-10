import { describe, expect, it, vi, beforeEach } from 'vitest';
import { cachedGet, clearApiCache } from './apiCache.js';

describe('apiCache', () => {
  beforeEach(() => {
    clearApiCache();
  });

  it('reuses in-flight and resolved promises for the same key', async () => {
    const loader = vi.fn(async () => ({ ok: true }));
    const a = cachedGet('k1', loader);
    const b = cachedGet('k1', loader);
    const [ra, rb] = await Promise.all([a, b]);
    expect(ra).toEqual({ ok: true });
    expect(rb).toEqual({ ok: true });
    expect(loader).toHaveBeenCalledTimes(1);

    const c = await cachedGet('k1', loader);
    expect(c).toEqual({ ok: true });
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('does not share different keys', async () => {
    const loaderA = vi.fn(async () => 'a');
    const loaderB = vi.fn(async () => 'b');
    expect(await cachedGet('a', loaderA)).toBe('a');
    expect(await cachedGet('b', loaderB)).toBe('b');
    expect(loaderA).toHaveBeenCalledTimes(1);
    expect(loaderB).toHaveBeenCalledTimes(1);
  });
});
