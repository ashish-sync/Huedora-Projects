/** Commercial document numbering — keep in sync with server documentNumbering.js */
export const DOCUMENT_NUMBER_STANDARDS = [
  { documentType: 'client_invoice', prefix: 'TCI', label: 'Invoice', example: 'TCI-YY-MM-001' },
  { documentType: 'purchase_order', prefix: 'TCPO', label: 'Purchase Order', example: 'TCPO-YY-MM-001' },
  { documentType: 'proforma', prefix: 'TCPI', label: 'Proforma Invoice', example: 'TCPI-YY-MM-001' },
  { documentType: 'credit_note', prefix: 'TCCN', label: 'Credit Note', example: 'TCCN-YY-MM-001' },
];

export const DOCUMENT_NUMBER_FORMAT = 'PREFIX-YY-MM-SEQ';

export function proformaNumberExample(dateIso) {
  const d = dateIso ? new Date(dateIso) : new Date();
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `TCPI-${yy}-${mm}-001`;
}

export function purchaseOrderNumberExample(dateIso) {
  const d = dateIso ? new Date(dateIso) : new Date();
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `TCPO-${yy}-${mm}-001`;
}

export function invoiceNumberExample(dateIso) {
  const d = dateIso ? new Date(dateIso) : new Date();
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `TCI-${yy}-${mm}-001`;
}
