import { apiUrl } from '../../../shared/api.js';

async function parseJson(res) {
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json?.error?.message || json?.message || 'Request failed');
    err.status = res.status;
    err.code = json?.error?.code;
    err.blockers = json?.error?.details?.blockers || json?.error?.blockers;
    throw err;
  }
  return json.data;
}

export const campExecuteApi = {
  load(token) {
    return fetch(apiUrl(`/camp-execute/${encodeURIComponent(token)}`), {
      credentials: 'omit',
      cache: 'no-store',
    }).then(parseJson);
  },

  saveDraft(token, body) {
    return fetch(apiUrl(`/camp-execute/${encodeURIComponent(token)}/draft`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'omit',
      body: JSON.stringify(body || {}),
    }).then(parseJson);
  },

  async uploadDocument(token, { file, docType, latitude, longitude, accuracy }) {
    const form = new FormData();
    form.append('documents', file);
    form.append('docType', docType);
    if (latitude != null) form.append('latitude', String(latitude));
    if (longitude != null) form.append('longitude', String(longitude));
    if (accuracy != null) form.append('accuracy', String(accuracy));
    return fetch(apiUrl(`/camp-execute/${encodeURIComponent(token)}/documents`), {
      method: 'POST',
      credentials: 'omit',
      body: form,
    }).then(parseJson);
  },

  deleteDocument(token, fileId) {
    return fetch(
      apiUrl(`/camp-execute/${encodeURIComponent(token)}/documents/${encodeURIComponent(fileId)}`),
      { method: 'DELETE', credentials: 'omit' },
    ).then(parseJson);
  },

  submit(token, body) {
    return fetch(apiUrl(`/camp-execute/${encodeURIComponent(token)}/submit`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'omit',
      body: JSON.stringify(body || {}),
    }).then(parseJson);
  },
};
