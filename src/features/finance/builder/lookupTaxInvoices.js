import { api } from '../../../shared/api.js';

function normalizeDocNo(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function withDocumentNumber(rows) {
  return (Array.isArray(rows) ? rows : []).filter((row) => String(row?.documentNumber || '').trim());
}

/** Issued tax invoices available to reference from Credit / Debit notes. */
export async function listIssuedClientInvoices({ limit = 300 } = {}) {
  const res = await api(`/finance/client-invoices?status=Issued&limit=${limit}&page=1`);
  return withDocumentNumber(res?.data);
}

/** Exact document-number match among Issued tax invoices. */
export async function findIssuedClientInvoiceByNumber(documentNumber) {
  const q = String(documentNumber || '').trim();
  if (!q) return null;
  const res = await api(
    `/finance/client-invoices?q=${encodeURIComponent(q)}&status=Issued&limit=25&page=1`
  );
  const rows = withDocumentNumber(res?.data);
  const norm = normalizeDocNo(q);
  return rows.find((row) => normalizeDocNo(row.documentNumber) === norm) || null;
}

export function invoiceDocumentDateIso(row) {
  const raw = row?.documentDate || row?.builderForm?.invoice?.issueDate || '';
  return String(raw).slice(0, 10);
}
