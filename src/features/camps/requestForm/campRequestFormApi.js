import { apiUrl } from '../../../shared/api.js';

async function parseJson(res) {
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json?.error?.message || json?.message || 'Request failed');
    err.status = res.status;
    err.code = json?.error?.code;
    throw err;
  }
  return json;
}

function tokenPath(token, suffix = '') {
  return apiUrl(`/camp-request/${encodeURIComponent(token)}${suffix}`);
}

export const campRequestFormApi = {
  load(token) {
    return fetch(tokenPath(token), {
      credentials: 'omit',
      cache: 'no-store',
    }).then(parseJson).then((json) => json.data);
  },

  submit(token, body) {
    return fetch(tokenPath(token), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'omit',
      body: JSON.stringify(body || {}),
    }).then(parseJson).then((json) => json.data);
  },

  lookupPin(token, pin) {
    return fetch(tokenPath(token, `/geo/pin/${encodeURIComponent(pin)}`), {
      credentials: 'omit',
      cache: 'no-store',
    }).then(parseJson);
  },

  fetchStates(token) {
    return fetch(tokenPath(token, '/geo/states'), {
      credentials: 'omit',
      cache: 'no-store',
    }).then(parseJson).then((json) => json.data || []);
  },

  fetchDistricts(token, stateId) {
    const id = String(stateId || '').trim();
    if (!id) return Promise.resolve([]);
    return fetch(tokenPath(token, `/geo/districts?stateId=${encodeURIComponent(id)}`), {
      credentials: 'omit',
      cache: 'no-store',
    }).then(parseJson).then((json) => json.data || []);
  },

  fetchCities(token, stateId) {
    const id = String(stateId || '').trim();
    if (!id) return Promise.resolve([]);
    return fetch(tokenPath(token, `/geo/cities?stateId=${encodeURIComponent(id)}`), {
      credentials: 'omit',
      cache: 'no-store',
    }).then(parseJson).then((json) => json.data || []);
  },
};
