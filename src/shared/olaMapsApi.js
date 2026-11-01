import { api } from './api.js';

export function autocompleteOlaMaps(input) {
  const q = String(input || '').trim();
  if (q.length < 3) return Promise.resolve([]);
  return api(`/geo/ola/autocomplete?input=${encodeURIComponent(q)}`).then((res) => res.data || []);
}

export function estimateOlaRoundTripKm({ pin, destLat, destLng, originLat, originLng } = {}) {
  const params = new URLSearchParams();
  if (pin) params.set('pin', pin);
  if (destLat !== undefined && destLat !== '') params.set('destLat', String(destLat));
  if (destLng !== undefined && destLng !== '') params.set('destLng', String(destLng));
  if (originLat !== undefined && originLat !== '') params.set('originLat', String(originLat));
  if (originLng !== undefined && originLng !== '') params.set('originLng', String(originLng));
  return api(`/geo/ola/travel-estimate?${params.toString()}`).then((res) => res.data || null);
}
