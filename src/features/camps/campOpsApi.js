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
    let message = `Download failed (${res.status}). Please try again.`;
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
  requestInformation: (id, payload = {}) => post(`${BASE}/camps/${id}/request-information`, payload),
  cancel: (id, payload = {}) => post(`${BASE}/camps/${id}/cancel`, payload),
  close: (id, payload = {}) => post(`${BASE}/camps/${id}/close`, payload),
  execute: (id, payload = {}) => post(`${BASE}/camps/${id}/execute`, payload),
  confirmPayment: (id, payload = {}) => post(`${BASE}/camps/${id}/confirm-payment`, payload),
  holdPayment: (id, payload = {}) => post(`${BASE}/camps/${id}/hold`, payload),
  releaseHold: (id, payload = {}) => post(`${BASE}/camps/${id}/release-hold`, payload),
  delete: (id) => del(`${BASE}/camps/${id}`),
  bulkAction: (payload) => post(`${BASE}/camps/bulk-action`, payload),
  uploadExecutionDocuments: (id, files, docType, docNote = '') => {
    const formData = new FormData();
    for (const file of files) formData.append('documents', file);
    formData.append('docType', docType);
    if (docNote) formData.append('docNote', docNote);
    return postForm(`${BASE}/camps/${id}/execution-documents`, formData);
  },
  consumableOptions: () => get(`${BASE}/consumables/options`),
  consumablesForCamp: (clientId, params = {}) => get(`${BASE}/consumables/for-camp`, {
    ...(clientId ? { clientId } : {}),
    ...params,
  }),
  submitToFinance: (id, payload) => post(`${BASE}/camps/${id}/submit-to-finance`, payload),
  downloadFinanceExport: (id, campId = 'camp') => downloadExcel(
    `${BASE}/camps/${id}/finance-export`,
    `Camp_Finance_${String(campId).replace(/[^\w.-]+/g, '_')}.xlsx`,
  ),
  downloadExportSample: async () => ({ data: await getBlob(`${BASE}/camps/export/sample`) }),
};

export const exportApi = {
  fields: () => get(`${BASE}/camps/export/fields`),
  templates: () => get(`${BASE}/camps/export/templates`),
  saveTemplate: (payload) => post(`${BASE}/camps/export/templates`, payload),
  deleteTemplate: (id) => del(`${BASE}/camps/export/templates/${id}`),
  download: async (payload) => {
    const res = await apiFetch(`${BASE}/camps/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      let message = `Download failed (${res.status})`;
      try {
        const json = await res.json();
        if (json?.error?.message) message = json.error.message;
      } catch {
        /* ignore */
      }
      throw new Error(message);
    }
    const blob = await res.blob();
    const filename = payload?.format === 'csv' ? 'Camps_Export.csv' : 'Camps_Export.xlsx';
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  },
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
  listByClient: (clientId, params) => get(`${BASE}/client-masters/by-client/${clientId}`, params),
  listDivisionsByClient: (clientId, params) => get(
    `${BASE}/client-masters/by-client/${clientId}/divisions`,
    params,
  ),
  get: (id) => get(`${BASE}/client-masters/${id}`),
  create: (payload) => post(`${BASE}/client-masters`, payload),
  update: (id, payload) => put(`${BASE}/client-masters/${id}`, payload),
  remove: (id) => del(`${BASE}/client-masters/${id}`),
  uploadCampTermsFiles: (id, files) => {
    const formData = new FormData();
    (Array.isArray(files) ? files : [files]).filter(Boolean).forEach((file) => {
      formData.append('files', file);
    });
    return postForm(`${BASE}/client-masters/${id}/camp-terms-files`, formData);
  },
  downloadCampTermsFile: async (id, fileId) => ({
    data: await getBlob(
      `${BASE}/client-masters/${id}/camp-terms-files/${encodeURIComponent(fileId)}`
    ),
  }),
  deleteCampTermsFile: (id, fileId) =>
    del(`${BASE}/client-masters/${id}/camp-terms-files/${encodeURIComponent(fileId)}`),
  uploadPoFiles: (id, files, poId) => {
    const formData = new FormData();
    (Array.isArray(files) ? files : [files]).filter(Boolean).forEach((file) => {
      formData.append('files', file);
    });
    const suffix = poId ? `/po-file/${encodeURIComponent(poId)}` : '/po-file';
    return postForm(`${BASE}/client-masters/${id}${suffix}`, formData);
  },
  // Legacy PO file helpers (older records)
  uploadPoFile: (id, file, poId) => {
    const formData = new FormData();
    formData.append('poFile', file);
    const suffix = poId ? `/po-file/${encodeURIComponent(poId)}` : '/po-file';
    return postForm(`${BASE}/client-masters/${id}${suffix}`, formData);
  },
  downloadPoFile: async (id, poId) => ({
    data: await getBlob(
      `${BASE}/client-masters/${id}${poId ? `/po-file/${encodeURIComponent(poId)}` : '/po-file'}`
    ),
  }),
  downloadPoFileById: async (id, poId, fileId) => ({
    data: await getBlob(
      `${BASE}/client-masters/${id}/po-file/${encodeURIComponent(poId)}/${encodeURIComponent(fileId)}`
    ),
  }),
  deletePoFile: (id, poId) =>
    del(`${BASE}/client-masters/${id}${poId ? `/po-file/${encodeURIComponent(poId)}` : '/po-file'}`),
  deletePoFileById: (id, poId, fileId) =>
    del(
      `${BASE}/client-masters/${id}/po-file/${encodeURIComponent(poId)}/${encodeURIComponent(fileId)}`
    ),
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
  extractEvents: (payload) => post(`${BASE}/communications/event-extractor/extract`, payload),
  parsePasteFile: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return postForm(`${BASE}/communications/paste/parse-file`, formData);
  },
  extractPasteFile: (file, payload = {}) => {
    const formData = new FormData();
    formData.append('file', file);
    if (payload.clientName) formData.append('clientName', payload.clientName);
    if (payload.campaignType) formData.append('campaignType', payload.campaignType);
    if (payload.campaignName) formData.append('campaignName', payload.campaignName);
    if (payload.mapping) formData.append('mapping', JSON.stringify(payload.mapping));
    return postForm(`${BASE}/communications/paste/extract-file`, formData);
  },
  extractPasteRows: (payload) => post(`${BASE}/communications/paste/extract-rows`, payload),
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
