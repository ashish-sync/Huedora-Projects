/** Commercial document numbering — keep in sync with server documentNumbering.js */

/**
 * PREFIXFY/MM/SEQ — PREFIX = {org documentCode}{type suffix}
 * e.g. TCIN26-27/08/001 · MDIN26-27/08/001 · RDPO26-27/08/001
 */
export const DEFAULT_DOCUMENT_CODE = 'TC';

export const DOCUMENT_TYPE_SUFFIXES = {
  client_invoice: 'IN',
  purchase_order: 'PO',
  proforma: 'PI',
  quotation: 'QT',
  credit_note: 'CN',
  debit_note: 'DN',
  delivery_challan: 'DC',
  bill_of_supply: 'BS',
};

export const DOCUMENT_NUMBER_LABELS = {
  purchase_order: 'Purchase Order',
  quotation: 'Quotation',
  proforma: 'Proforma Invoice',
  client_invoice: 'Tax Invoice',
  credit_note: 'Credit Note',
  debit_note: 'Debit Note',
  delivery_challan: 'Delivery Challan',
  bill_of_supply: 'Bill of Supply',
};

export function normalizeDocumentCode(value) {
  const raw = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
  if (raw.length >= 2 && raw.length <= 5) return raw;
  return DEFAULT_DOCUMENT_CODE;
}

export function prefixForDocumentType(documentType, documentCode = DEFAULT_DOCUMENT_CODE) {
  const suffix = DOCUMENT_TYPE_SUFFIXES[documentType];
  if (!suffix) return '';
  return `${normalizeDocumentCode(documentCode)}${suffix}`;
}

export const DOCUMENT_NUMBER_STANDARDS = Object.entries(DOCUMENT_TYPE_SUFFIXES).map(
  ([documentType, suffix]) => {
    const prefix = `${DEFAULT_DOCUMENT_CODE}${suffix}`;
    return {
      documentType,
      prefix,
      label: DOCUMENT_NUMBER_LABELS[documentType] || documentType,
      example: `${prefix}26-27/08/001`,
    };
  },
);

export const DOCUMENT_NUMBER_FORMAT = 'PREFIXFY/MM/SEQ';

export function numberingPreviewForCode(documentCode = DEFAULT_DOCUMENT_CODE) {
  const code = normalizeDocumentCode(documentCode);
  return Object.entries(DOCUMENT_TYPE_SUFFIXES).map(([documentType, suffix]) => ({
    documentType,
    prefix: `${code}${suffix}`,
    label: DOCUMENT_NUMBER_LABELS[documentType] || documentType,
    example: `${code}${suffix}26-27/08/001`,
  }));
}

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
  const prefix = prefixForDocumentType(documentType, documentCode);
  return prefix ? numberExample(prefix, dateIso) : '';
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
