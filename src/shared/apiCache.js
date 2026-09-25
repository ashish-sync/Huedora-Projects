/**
 * Shared in-flight + resolved promise cache for geo / picklist GETs.
 * Avoids refetch storms when Camp One remounts stage panels.
 * Bounded LRU so district/city key explosion cannot grow memory without limit.
 */
const store = new Map();
const DEFAULT_MAX_ENTRIES = 200;

function touch(key, entry) {
  store.delete(key);
  store.set(key, entry);
}

function evictIfNeeded(maxEntries) {
  const limit = Math.max(1, Number(maxEntries) || DEFAULT_MAX_ENTRIES);
  while (store.size > limit) {
    const oldest = store.keys().next().value;
    if (oldest == null) break;
    store.delete(oldest);
  }
}

export function cachedGet(key, loader, { ttlMs = 5 * 60 * 1000, maxEntries = DEFAULT_MAX_ENTRIES } = {}) {
  const k = String(key || '');
  if (!k) return loader();
  const hit = store.get(k);
  const now = Date.now();
  if (hit?.promise && (hit.expiresAt == null || hit.expiresAt > now)) {
    touch(k, hit);
    return hit.promise;
  }
  const promise = Promise.resolve()
    .then(loader)
    .then((value) => {
      const entry = {
        promise: Promise.resolve(value),
        expiresAt: ttlMs > 0 ? Date.now() + ttlMs : null,
      };
      touch(k, entry);
      evictIfNeeded(maxEntries);
      return value;
    })
    .catch((err) => {
      store.delete(k);
      throw err;
    });
  touch(k, { promise, expiresAt: ttlMs > 0 ? now + ttlMs : null });
  evictIfNeeded(maxEntries);
  return promise;
}

export function clearApiCache(prefix = '') {
  if (!prefix) {
    store.clear();
    return;
  }
  for (const key of [...store.keys()]) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

/** Test/diagnostics helper. */
export function apiCacheStats() {
  return { size: store.size, maxEntries: DEFAULT_MAX_ENTRIES };
}
