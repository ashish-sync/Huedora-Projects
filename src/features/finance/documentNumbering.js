/** Commercial document numbering — keep in sync with server documentNumbering.js */
export const DOCUMENT_NUMBER_STANDARDS = [
  { documentType: 'client_invoice', prefix: 'TCIN', label: 'Invoice', example: 'TCIN-YY-MM-001' },
  { documentType: 'purchase_order', prefix: 'TCPO', label: 'Purchase Order', example: 'TCPO-YY-MM-001' },
  { documentType: 'proforma', prefix: 'TCPI', label: 'Proforma Invoice', example: 'TCPI-YY-MM-001' },
  { documentType: 'credit_note', prefix: 'TCCN', label: 'Credit Note', example: 'TCCN-YY-MM-001' },
];

export const DOCUMENT_NUMBER_FORMAT = 'PREFIX-YY-MM-SEQ';

function numberExample(prefix, dateIso) {
  const d = dateIso ? new Date(dateIso) : new Date();
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${prefix}-${yy}-${mm}-001`;
}

export function proformaNumberExample(dateIso) {
  return numberExample('TCPI', dateIso);
}

export function purchaseOrderNumberExample(dateIso) {
  return numberExample('TCPO', dateIso);
}

export function invoiceNumberExample(dateIso) {
  return numberExample('TCIN', dateIso);
}

export function creditNoteNumberExample(dateIso) {
  return numberExample('TCCN', dateIso);
}
