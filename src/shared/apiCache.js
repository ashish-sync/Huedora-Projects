/**
 * Shared in-flight + resolved promise cache for geo / picklist GETs.
 * Avoids refetch storms when Camp One remounts stage panels.
 */
const store = new Map();

export function cachedGet(key, loader, { ttlMs = 5 * 60 * 1000 } = {}) {
  const k = String(key || '');
  if (!k) return loader();
  const hit = store.get(k);
  const now = Date.now();
  if (hit?.promise && (hit.expiresAt == null || hit.expiresAt > now)) {
    return hit.promise;
  }
  const promise = Promise.resolve()
    .then(loader)
    .then((value) => {
      store.set(k, {
        promise: Promise.resolve(value),
        expiresAt: ttlMs > 0 ? Date.now() + ttlMs : null,
      });
      return value;
    })
    .catch((err) => {
      store.delete(k);
      throw err;
    });
  store.set(k, { promise, expiresAt: ttlMs > 0 ? now + ttlMs : null });
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
