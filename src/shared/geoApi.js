import { api } from './api.js';
import { cachedGet } from './apiCache.js';

export function fetchGeoStates() {
  return cachedGet('geo:states', () => api('/geo/states').then((r) => r.data || []));
}

export function fetchGeoDistricts(stateId) {
  const id = String(stateId || '').trim();
  if (!id) return Promise.resolve([]);
  return cachedGet(`geo:districts:${id}`, () =>
    api(`/geo/districts?stateId=${encodeURIComponent(id)}`).then((r) => r.data || []));
}

export function fetchGeoCities(stateId) {
  const id = String(stateId || '').trim();
  if (!id) return Promise.resolve([]);
  return cachedGet(`geo:cities:${id}`, () =>
    api(`/geo/cities?stateId=${encodeURIComponent(id)}`).then((r) => r.data || []));
}

export function fetchPicklist(picklistKey) {
  const key = String(picklistKey || '').trim();
  if (!key) return Promise.resolve({ options: [], otherLabel: 'Other' });
  return cachedGet(`picklist:${key}`, () =>
    api(`/picklists/${encodeURIComponent(key)}`).then((r) => ({
      options: r.data?.options || [],
      otherLabel: r.data?.otherLabel || 'Other',
    })));
}
