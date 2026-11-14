import { apiUrl } from '../../shared/api.js';
import {
  clearClientOneSession,
  getClientOneToken,
  setClientOneSession,
} from './clientOneSession.js';

let activeMode = 'external';

export function setClientOneApiMode(mode = 'external') {
  activeMode = mode === 'preview' ? 'preview' : 'external';
}

export function getClientOneApiMode() {
  return activeMode;
}

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

async function authedFetch(path, options = {}) {
  const token = getClientOneToken(activeMode);
  if (!token) {
    const err = new Error('Sign in required');
    err.status = 401;
    err.code = 'UNAUTHORIZED';
    throw err;
  }
  const headers = {
    ...(options.headers || {}),
    Authorization: `Bearer ${token}`,
  };
  if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(apiUrl(path), {
    ...options,
    headers,
    credentials: 'omit',
    cache: 'no-store',
  });
  if (res.status === 401) {
    clearClientOneSession(activeMode);
  }
  return parseJson(res);
}

async function authedBlob(path) {
  const token = getClientOneToken(activeMode);
  if (!token) {
    const err = new Error('Sign in required');
    err.status = 401;
    throw err;
  }
  const res = await fetch(apiUrl(path), {
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'omit',
    cache: 'no-store',
  });
  if (res.status === 401) clearClientOneSession(activeMode);
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    const err = new Error(json?.error?.message || 'Download failed');
    err.status = res.status;
    throw err;
  }
  return res.blob();
}

function withRange(base, { from, to } = {}) {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const q = params.toString();
  return `${base}${q ? `?${q}` : ''}`;
}

function triggerDownload(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName || 'download';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const clientOneApi = {
  async login({ pin, accessId = '' } = {}) {
    setClientOneApiMode('external');
    const res = await fetch(apiUrl('/client-one/session'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'omit',
      body: JSON.stringify({ pin, accessId: accessId || undefined }),
    }).then(parseJson);
    const data = res?.data || {};
    setClientOneSession({
      token: data.token,
      expiresAt: data.expiresAt,
      client: data.client,
      features: data.features || data.client?.features,
      mode: 'external',
    }, 'external');
    return data;
  },

  logout() {
    clearClientOneSession(activeMode);
    if (activeMode === 'external') {
      return fetch(apiUrl('/client-one/session/logout'), {
        method: 'POST',
        credentials: 'omit',
      }).catch(() => null);
    }
    return Promise.resolve(null);
  },

  me() {
    return authedFetch('/client-one/me').then((r) => r.data);
  },

  updatePin({ currentPin, pin } = {}) {
    return authedFetch('/client-one/account/pin', {
      method: 'POST',
      body: JSON.stringify({ currentPin, pin }),
    }).then((r) => r.data);
  },

  dashboard({ from, to } = {}) {
    return authedFetch(withRange('/client-one/dashboard', { from, to })).then((r) => r.data);
  },

  camps({ from, to, page = 1, limit = 100 } = {}) {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    return authedFetch(`/client-one/camps?${params}`).then((r) => ({
      data: r.data || [],
      meta: r.meta || {},
    }));
  },

  camp(id) {
    return authedFetch(`/client-one/camps/${encodeURIComponent(id)}`).then((r) => r.data);
  },

  hcw({ from, to } = {}) {
    return authedFetch(withRange('/client-one/hcw', { from, to })).then((r) => r.data || []);
  },

  calendar({ from, to } = {}) {
    return authedFetch(withRange('/client-one/calendar', { from, to })).then((r) => r.data);
  },

  invoices() {
    return authedFetch('/client-one/invoices').then((r) => r.data || []);
  },

  async downloadInvoicePdf(id, fileName) {
    const blob = await authedBlob(`/client-one/invoices/${encodeURIComponent(id)}/pdf?download=1`);
    triggerDownload(blob, fileName || 'invoice.pdf');
  },

  annexures() {
    return authedFetch('/client-one/annexures').then((r) => r.data || []);
  },

  async downloadAnnexure(id, fileName) {
    const blob = await authedBlob(`/client-one/annexures/${encodeURIComponent(id)}/download`);
    triggerDownload(blob, fileName || 'annexure');
  },

  mis({ from, to } = {}) {
    return authedFetch(withRange('/client-one/mis', { from, to })).then((r) => r.data);
  },

  async exportMis({ from, to } = {}) {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const q = params.toString();
    const blob = await authedBlob(`/client-one/mis/export${q ? `?${q}` : ''}`);
    triggerDownload(blob, `client-one-mis-${from || 'from'}-${to || 'to'}.csv`);
  },

  campRequestLink() {
    return authedFetch('/client-one/camp-request-link').then((r) => r.data);
  },

  rotateCampRequestLink() {
    return authedFetch('/client-one/camp-request-link/rotate', { method: 'POST', body: '{}' }).then((r) => r.data);
  },

  purchaseOrders() {
    return authedFetch('/client-one/purchase-orders').then((r) => r.data || []);
  },

  async uploadPurchaseOrders(files, poId = '') {
    const form = new FormData();
    (Array.isArray(files) ? files : [files]).filter(Boolean).forEach((file) => {
      form.append('files', file);
    });
    if (poId) form.append('poId', poId);
    return authedFetch('/client-one/purchase-orders', {
      method: 'POST',
      body: form,
    }).then((r) => r.data || []);
  },

  async downloadPoFile(poId, fileId, fileName) {
    const path = fileId
      ? `/client-one/purchase-orders/${encodeURIComponent(poId)}/files/${encodeURIComponent(fileId)}`
      : `/client-one/purchase-orders/${encodeURIComponent(poId)}/file`;
    const blob = await authedBlob(path);
    triggerDownload(blob, fileName || 'purchase-order');
  },

  deletePoFile(poId, fileId) {
    return authedFetch(
      `/client-one/purchase-orders/${encodeURIComponent(poId)}/files/${encodeURIComponent(fileId)}`,
      { method: 'DELETE' },
    ).then((r) => r.data || []);
  },
};
