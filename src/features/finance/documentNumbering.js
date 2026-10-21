/** Commercial document numbering — keep in sync with server documentNumbering.js */

/**
 * PREFIXFY/MM/SEQ — e.g. TCIN26-27/08/001
 * Prefix = organisation documentCode (TC, MD, RD, TYLO) + type suffix.
 */
export const DEFAULT_DOCUMENT_CODE = 'TC';

export const DOCUMENT_TYPE_SUFFIXES = {
  purchase_order: 'PO',
  quotation: 'QT',
  proforma: 'PI',
  client_invoice: 'IN',
  credit_note: 'CN',
  debit_note: 'DN',
  delivery_challan: 'DC',
  bill_of_supply: 'BS',
};

export function normalizeDocumentCode(value) {
  const raw = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
  if (raw.length < 2 || raw.length > 5) return '';
  return raw;
}

export function documentPrefix(documentType, documentCode = DEFAULT_DOCUMENT_CODE) {
  const suffix = DOCUMENT_TYPE_SUFFIXES[documentType];
  if (!suffix) return '';
  const code = normalizeDocumentCode(documentCode) || DEFAULT_DOCUMENT_CODE;
  return `${code}${suffix}`;
}

export const DOCUMENT_NUMBER_STANDARDS = [
  { documentType: 'purchase_order', prefix: 'TCPO', label: 'Purchase Order', example: 'TCPO26-27/08/001' },
  { documentType: 'quotation', prefix: 'TCQT', label: 'Quotation', example: 'TCQT26-27/08/001' },
  { documentType: 'proforma', prefix: 'TCPI', label: 'Proforma Invoice', example: 'TCPI26-27/08/001' },
  { documentType: 'client_invoice', prefix: 'TCIN', label: 'Tax Invoice', example: 'TCIN26-27/08/001' },
  { documentType: 'credit_note', prefix: 'TCCN', label: 'Credit Note', example: 'TCCN26-27/08/001' },
  { documentType: 'debit_note', prefix: 'TCDN', label: 'Debit Note', example: 'TCDN26-27/08/001' },
  { documentType: 'delivery_challan', prefix: 'TCDC', label: 'Delivery Challan', example: 'TCDC26-27/08/001' },
  { documentType: 'bill_of_supply', prefix: 'TCBS', label: 'Bill of Supply', example: 'TCBS26-27/08/001' },
];

export const DOCUMENT_NUMBER_FORMAT = 'PREFIXFY/MM/SEQ';

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
  return `${prefix}${fy}/${mm}/001`;
}

export function documentNumberExample(documentType, dateIso, documentCode = DEFAULT_DOCUMENT_CODE) {
  return numberExample(documentPrefix(documentType, documentCode), dateIso);
}

export function proformaNumberExample(dateIso, documentCode) {
  return documentNumberExample('proforma', dateIso, documentCode);
}

export function purchaseOrderNumberExample(dateIso, documentCode) {
  return documentNumberExample('purchase_order', dateIso, documentCode);
}

export function invoiceNumberExample(dateIso, documentCode) {
  return documentNumberExample('client_invoice', dateIso, documentCode);
}

export function creditNoteNumberExample(dateIso, documentCode) {
  return documentNumberExample('credit_note', dateIso, documentCode);
}

export function debitNoteNumberExample(dateIso, documentCode) {
  return documentNumberExample('debit_note', dateIso, documentCode);
}

export function deliveryChallanNumberExample(dateIso, documentCode) {
  return documentNumberExample('delivery_challan', dateIso, documentCode);
}

export function billOfSupplyNumberExample(dateIso, documentCode) {
  return documentNumberExample('bill_of_supply', dateIso, documentCode);
}

export function quotationNumberExample(dateIso, documentCode) {
  return documentNumberExample('quotation', dateIso, documentCode);
}

/** Local preview helper — PREFIXFY/MM/SEQ with 3-digit sequence. */
export function formatLocalDocumentNumber(prefix, dateIso, sequence = 1) {
  const d = dateIso ? new Date(dateIso) : new Date();
  const fy = fiscalYearLabel(d);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${prefix}${fy}/${mm}/${String(sequence).padStart(3, '0')}`;
}

export function localDocumentPeriodKey(dateIso) {
  const d = dateIso ? new Date(dateIso) : new Date();
  const fy = fiscalYearLabel(d);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${fy}_${mm}`;
}

export function numberingPreviewForCode(documentCode) {
  const code = normalizeDocumentCode(documentCode) || DEFAULT_DOCUMENT_CODE;
  return DOCUMENT_NUMBER_STANDARDS.map((row) => ({
    ...row,
    prefix: documentPrefix(row.documentType, code),
    example: documentNumberExample(row.documentType, null, code),
  }));
}
