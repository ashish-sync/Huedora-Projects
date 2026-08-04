/** Commercial document numbering — keep in sync with server documentNumbering.js */

/**
 * PREFIX/FY/MM/SEQ — e.g. IN/26-27/08/0002
 * PO Purchase Order · PI Proforma · IN Tax Invoice · CN Credit Note · DN Debit Note
 */
export const DOCUMENT_NUMBER_STANDARDS = [
  { documentType: 'purchase_order', prefix: 'PO', label: 'Purchase Order', example: 'PO/26-27/08/0001' },
  { documentType: 'proforma', prefix: 'PI', label: 'Proforma Invoice', example: 'PI/26-27/08/0001' },
  { documentType: 'client_invoice', prefix: 'IN', label: 'Tax Invoice', example: 'IN/26-27/08/0002' },
  { documentType: 'credit_note', prefix: 'CN', label: 'Credit Note', example: 'CN/26-27/08/0001' },
  { documentType: 'debit_note', prefix: 'DN', label: 'Debit Note', example: 'DN/26-27/08/0001' },
];

export const DOCUMENT_NUMBER_FORMAT = 'PREFIX/FY/MM/SEQ';

/** Indian FY label e.g. 26-27 for Apr 2026 – Mar 2027 */
export function fiscalYearLabel(dateIso) {
  const d = dateIso ? new Date(dateIso) : new Date();
  const month = d.getMonth();
  const year = d.getFullYear();
  const startYear = month >= 3 ? year : year - 1;
  return `${String(startYear).slice(-2)}-${String(startYear + 1).slice(-2)}`;
}

function numberExample(prefix, dateIso) {
  const d = dateIso ? new Date(dateIso) : new Date();
  const fy = fiscalYearLabel(d);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${prefix}/${fy}/${mm}/0001`;
}

export function proformaNumberExample(dateIso) {
  return numberExample('PI', dateIso);
}

export function purchaseOrderNumberExample(dateIso) {
  return numberExample('PO', dateIso);
}

export function invoiceNumberExample(dateIso) {
  return numberExample('IN', dateIso);
}

export function creditNoteNumberExample(dateIso) {
  return numberExample('CN', dateIso);
}

export function debitNoteNumberExample(dateIso) {
  return numberExample('DN', dateIso);
}
