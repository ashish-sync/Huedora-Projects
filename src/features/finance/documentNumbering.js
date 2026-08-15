/** Commercial document numbering — keep in sync with server documentNumbering.js */

/**
 * PREFIX/FY/MM/SEQ — e.g. TCIN/26-27/08/001
 * TCIN Tax Invoice · TCPO Purchase Order · TCPI Proforma · TCQT Quotation
 * TCCN Credit Note · TCDN Debit Note · TCDC Delivery Challan · TCBS Bill of Supply
 */
export const DOCUMENT_NUMBER_STANDARDS = [
  { documentType: 'purchase_order', prefix: 'TCPO', label: 'Purchase Order', example: 'TCPO/26-27/08/001' },
  { documentType: 'quotation', prefix: 'TCQT', label: 'Quotation', example: 'TCQT/26-27/08/001' },
  { documentType: 'proforma', prefix: 'TCPI', label: 'Proforma Invoice', example: 'TCPI/26-27/08/001' },
  { documentType: 'client_invoice', prefix: 'TCIN', label: 'Tax Invoice', example: 'TCIN/26-27/08/001' },
  { documentType: 'credit_note', prefix: 'TCCN', label: 'Credit Note', example: 'TCCN/26-27/08/001' },
  { documentType: 'debit_note', prefix: 'TCDN', label: 'Debit Note', example: 'TCDN/26-27/08/001' },
  { documentType: 'delivery_challan', prefix: 'TCDC', label: 'Delivery Challan', example: 'TCDC/26-27/08/001' },
  { documentType: 'bill_of_supply', prefix: 'TCBS', label: 'Bill of Supply', example: 'TCBS/26-27/08/001' },
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
  return `${prefix}/${fy}/${mm}/001`;
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

export function debitNoteNumberExample(dateIso) {
  return numberExample('TCDN', dateIso);
}

export function deliveryChallanNumberExample(dateIso) {
  return numberExample('TCDC', dateIso);
}

export function billOfSupplyNumberExample(dateIso) {
  return numberExample('TCBS', dateIso);
}

export function quotationNumberExample(dateIso) {
  return numberExample('TCQT', dateIso);
}

/** Local preview helper — PREFIX/FY/MM/SEQ with 3-digit sequence. */
export function formatLocalDocumentNumber(prefix, dateIso, sequence = 1) {
  const d = dateIso ? new Date(dateIso) : new Date();
  const fy = fiscalYearLabel(d);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${prefix}/${fy}/${mm}/${String(sequence).padStart(3, '0')}`;
}

export function localDocumentPeriodKey(dateIso) {
  const d = dateIso ? new Date(dateIso) : new Date();
  const fy = fiscalYearLabel(d);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${fy}_${mm}`;
}
