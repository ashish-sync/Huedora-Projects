/** Commercial document numbering — keep in sync with server documentNumbering.js */

/**
 * PREFIX/FY/SEQ — e.g. TYLO/26-27/0001 (Tax Invoice, Quotation, Proforma, CN/DN, Bill of Supply)
 * PO/FY/SEQ · DC/FY/SEQ
 */
export const DOCUMENT_NUMBER_STANDARDS = [
  { documentType: 'purchase_order', prefix: 'PO', label: 'Purchase Order', example: 'PO/26-27/0001' },
  { documentType: 'quotation', prefix: 'TYLO', label: 'Quotation', example: 'TYLO/26-27/0001' },
  { documentType: 'proforma', prefix: 'TYLO', label: 'Proforma Invoice', example: 'TYLO/26-27/0001' },
  { documentType: 'client_invoice', prefix: 'TYLO', label: 'Tax Invoice', example: 'TYLO/26-27/0001' },
  { documentType: 'credit_note', prefix: 'TYLO', label: 'Credit Note', example: 'TYLO/26-27/0001' },
  { documentType: 'debit_note', prefix: 'TYLO', label: 'Debit Note', example: 'TYLO/26-27/0001' },
  { documentType: 'delivery_challan', prefix: 'DC', label: 'Delivery Challan', example: 'DC/26-27/0001' },
  { documentType: 'bill_of_supply', prefix: 'TYLO', label: 'Bill of Supply', example: 'TYLO/26-27/0001' },
];

export const DOCUMENT_NUMBER_FORMAT = 'PREFIX/FY/SEQ';

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
  const d = dateIso ? new Date(dateIso) : new Date();
  const fy = fiscalYearLabel(d);
  return `TYLO/${fy}/0001`;
}

export function purchaseOrderNumberExample(dateIso) {
  const d = dateIso ? new Date(dateIso) : new Date();
  const fy = fiscalYearLabel(d);
  return `PO/${fy}/0001`;
}

export function invoiceNumberExample(dateIso) {
  const d = dateIso ? new Date(dateIso) : new Date();
  const fy = fiscalYearLabel(d);
  return `TYLO/${fy}/0001`;
}

export function creditNoteNumberExample(dateIso) {
  const d = dateIso ? new Date(dateIso) : new Date();
  const fy = fiscalYearLabel(d);
  return `TYLO/${fy}/0001`;
}

export function debitNoteNumberExample(dateIso) {
  const d = dateIso ? new Date(dateIso) : new Date();
  const fy = fiscalYearLabel(d);
  return `TYLO/${fy}/0001`;
}

export function deliveryChallanNumberExample(dateIso) {
  const d = dateIso ? new Date(dateIso) : new Date();
  const fy = fiscalYearLabel(d);
  return `DC/${fy}/0001`;
}

export function billOfSupplyNumberExample(dateIso) {
  const d = dateIso ? new Date(dateIso) : new Date();
  const fy = fiscalYearLabel(d);
  return `TYLO/${fy}/0001`;
}

export function quotationNumberExample(dateIso) {
  const d = dateIso ? new Date(dateIso) : new Date();
  const fy = fiscalYearLabel(d);
  return `TYLO/${fy}/0001`;
}
