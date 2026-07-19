import { api, apiFetch, downloadExcel } from '../../shared/api.js';

function toQuery(params = {}) {
  const cleaned = Object.fromEntries(
    Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => [k, typeof v === 'string' ? v.trim() : String(v)])
  );
  const qs = new URLSearchParams(cleaned).toString();
  return qs ? `?${qs}` : '';
}

/**
 * HueDora pages expect axios-style `{ data: body }`.
 * TYLO `api()` already returns the JSON body — wrap it back.
 * Also map TYLO `meta` pagination → HueDora `pagination`.
 */
function asAxios(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { data: body };
  }
  const next = { ...body };
  if (next.meta && !next.pagination) {
    next.pagination = {
      page: next.meta.page,
      limit: next.meta.limit,
      total: next.meta.total,
      pages: next.meta.pages,
      totalPages: next.meta.pages,
    };
  }
  return { data: next };
}

async function get(path, params) {
  return asAxios(await api(`${path}${toQuery(params)}`));
}

async function post(path, body) {
  return asAxios(await api(path, { method: 'POST', body: body ?? {} }));
}

async function put(path, body) {
  return asAxios(await api(path, { method: 'PUT', body: body ?? {} }));
}

async function del(path) {
  return asAxios(await api(path, { method: 'DELETE' }));
}

async function postForm(path, formData) {
  return asAxios(await api(path, { method: 'POST', body: formData }));
}

async function getBlob(path) {
  const res = await apiFetch(path);
  if (!res.ok) {
    let message = `Download failed (${res.status})`;
    try {
      const json = await res.json();
      if (json?.error?.message || json?.message) {
        message = json.error?.message || json.message;
      }
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return res.blob();
}

const BASE = '/camp-ops';

export const dashboardApi = {
  stats: (params) => get(`${BASE}/dashboard/stats`, params),
  clients: () => get(`${BASE}/dashboard/clients`),
};

export const campApi = {
  list: (params) => get(`${BASE}/camps`, params),
  get: (id) => get(`${BASE}/camps/${id}`),
  create: (payload) => post(`${BASE}/camps`, payload),
  update: (id, payload) => put(`${BASE}/camps/${id}`, payload),
  submitReview: (id, payload = {}) => post(`${BASE}/camps/${id}/submit-review`, payload),
  approve: (id, payload = {}) => post(`${BASE}/camps/${id}/approve`, payload),
  reject: (id, payload = {}) => post(`${BASE}/camps/${id}/reject`, payload),
  cancel: (id, payload = {}) => post(`${BASE}/camps/${id}/cancel`, payload),
  execute: (id, payload = {}) => post(`${BASE}/camps/${id}/execute`, payload),
  delete: (id) => del(`${BASE}/camps/${id}`),
  bulkAction: (payload) => post(`${BASE}/camps/bulk-action`, payload),
};

export const clientApi = {
  list: (params) => get(`${BASE}/clients`, params),
  get: (id) => get(`${BASE}/clients/${id}`),
  create: (payload) => post(`${BASE}/clients`, payload),
  update: (id, payload) => put(`${BASE}/clients/${id}`, payload),
  remove: (id) => del(`${BASE}/clients/${id}`),
};

export const clientMasterApi = {
  list: (params) => get(`${BASE}/client-masters`, params),
  listByClient: (clientId) => get(`${BASE}/client-masters/by-client/${clientId}`),
  listDivisionsByClient: (clientId) => get(`${BASE}/client-masters/by-client/${clientId}/divisions`),
  get: (id) => get(`${BASE}/client-masters/${id}`),
  create: (payload) => post(`${BASE}/client-masters`, payload),
  update: (id, payload) => put(`${BASE}/client-masters/${id}`, payload),
  remove: (id) => del(`${BASE}/client-masters/${id}`),
  downloadDocument: async (id) => ({ data: await getBlob(`${BASE}/client-masters/${id}/document`) }),
  uploadDocument: (id, file) => {
    const formData = new FormData();
    formData.append('document', file);
    return postForm(`${BASE}/client-masters/${id}/document`, formData);
  },
  deleteDocument: (id) => del(`${BASE}/client-masters/${id}/document`),
};

export const importApi = {
  fields: () => get(`${BASE}/import/fields`),
  downloadSample: async () => ({ data: await getBlob(`${BASE}/import/sample`) }),
  parse: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return postForm(`${BASE}/import/parse`, formData);
  },
  preview: (payload) => post(`${BASE}/import/preview`, payload),
  confirm: (payload) => post(`${BASE}/import/confirm`, payload),
  templates: () => get(`${BASE}/import/templates`),
  saveTemplate: (payload) => post(`${BASE}/import/templates`, payload),
  deleteTemplate: (id) => del(`${BASE}/import/templates/${id}`),
};

export const communicationsApi = {
  emailStatus: () => get(`${BASE}/communications/email/status`),
  getEmailConfig: () => get(`${BASE}/communications/email/config`),
  updateEmailConfig: (payload) => put(`${BASE}/communications/email/config`, payload),
  listEmailMessages: (params) => get(`${BASE}/communications/email/messages`, params),
  getEmailMessage: (id) => get(`${BASE}/communications/email/messages/${id}`),
  syncEmailMailbox: (payload) => post(`${BASE}/communications/email/sync`, payload || {}),
  extractEmailMessage: (id, payload) => post(`${BASE}/communications/email/messages/${id}/extract`, payload || {}),
  saveEmailPreview: (id, payload) => put(`${BASE}/communications/email/messages/${id}/preview`, payload),
  processEmailMessage: (id, payload) => post(`${BASE}/communications/email/messages/${id}/process`, payload || {}),
  archiveEmailMessage: (id) => post(`${BASE}/communications/email/messages/${id}/archive`),
  restoreEmailMessage: (id) => post(`${BASE}/communications/email/messages/${id}/restore`),
  extractManualPaste: (payload) => post(`${BASE}/communications/paste/extract`, payload),
  processManualPaste: (payload) => post(`${BASE}/communications/paste/process`, payload),
};

export const userApi = {
  list: (params) => get(`${BASE}/users`, params),
  get: (id) => get(`${BASE}/users/${id}`),
  create: (payload) => post(`${BASE}/users`, payload),
  update: (id, payload) => put(`${BASE}/users/${id}`, payload),
  approve: (id, payload = {}) => post(`${BASE}/users/${id}/approve`, payload),
  reject: (id) => post(`${BASE}/users/${id}/reject`),
  activate: (id) => post(`${BASE}/users/${id}/activate`),
  deactivate: (id) => post(`${BASE}/users/${id}/deactivate`),
  roles: () => get(`${BASE}/users/roles`),
};

export { downloadExcel };
