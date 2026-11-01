import { api } from '../../../shared/api.js';

function toQuery(params = {}) {
  const cleaned = Object.fromEntries(
    Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => [k, typeof v === 'string' ? v.trim() : String(v)]),
  );
  const qs = new URLSearchParams(cleaned).toString();
  return qs ? `?${qs}` : '';
}

export const vendorMasterApi = {
  list: (params) => api(`/logistics/vendors${toQuery(params)}`),
  get: (id) => api(`/logistics/vendors/${encodeURIComponent(id)}`),
  uploadPdf: (id, file) => {
    if (!id) throw new Error('Save the vendor first, then upload a PDF');
    if (!file) throw new Error('Select a PDF to upload');
    const fd = new FormData();
    fd.append('file', file);
    return api(`/logistics/vendors/${encodeURIComponent(id)}/document`, { method: 'POST', body: fd });
  },
};
