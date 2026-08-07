import { todayIso } from '../../../shared/dateFormat.js';
import { fiscalYearLabel } from '../documentNumbering.js';

const STORAGE_KEY = 'tylo_one_invoice_generator_v1';
const NUMBER_KEY = 'tylo_one_invoice_number_seq';

/** Max line items on Tylo GST tax invoice (A4 portrait letterhead). */
export const MAX_INVOICE_LINE_ITEMS = 5;

export const INVOICE_PAYMENT_TERM = 'Payment is due within 30 days from the date of invoice.';

export function msmeDeclaration(company = {}) {
  const legal = String(company.legalName || 'Tylo Care Private Limited').trim();
  const udyam = String(company.udyam || 'UDYAM-MH-19-0446179').trim();
  return `${legal} is registered as a Micro Enterprise under the MSMED Act, 2006, bearing Udyam Registration No. ${udyam}. Delayed payments shall be governed by applicable provisions of the MSMED Act, 2006.`;
}

/** True when stored declaration is the old short MSME fallback (no Udyam). */
export function isStaleMsmeDeclaration(text) {
  const t = String(text || '').trim();
  if (!t) return true;
  return /MSMED Act/i.test(t) && !/Udyam Registration No\./i.test(t);
}

/** True when stored Proforma declaration is missing the scope / GST follow-on paragraph. */
export function isStaleProformaDeclaration(text) {
  const t = String(text || '').trim();
  if (!t) return true;
  if (!/Proforma Invoice issued for quotation/i.test(t)) return false;
  return !/Prices are indicative based on the proposed scope/i.test(t);
}

export function defaultLineItem(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    description: '',
    subDescription: '',
    hsnSac: '999316',
    uom: 'Nos',
    qty: 1,
    rate: 0,
    discount: 0,
    igstRate: 18,
    cgstRate: 9,
    sgstRate: 9,
    ...overrides,
  };
}

export function defaultInvoiceForm() {
  const today = todayIso();
  const due = new Date(today);
  due.setDate(due.getDate() + 30);
  const dueDate = due.toISOString().slice(0, 10);
  return {
    company: {
      logoDataUrl: '',
      legalName: '',
      brandLine: '',
      address: '',
      email: '',
      phone: '',
      website: '',
      contactPerson: '',
      gstin: '',
      pan: '',
      cin: '',
      udyam: '',
      udyamLabel: '',
      lutBondNo: '',
      fssaiNo: '',
      tan: '',
      dlNo: '',
      stateCode: '',
    },
    bank: {
      accountHolder: '',
      bankName: '',
      accountNumber: '',
      branchName: '',
      ifscCode: '',
    },
    payment: {
      upiId: '',
      qrEnabled: false,
      paymentQrDataUrl: '',
    },
    clientMasterId: '',
    clientId: '',
    clientPurchaseOrderId: '',
    shipToSameAsBillTo: false,
    billTo: {
      name: '',
      contactPerson: '',
      address: '',
      email: '',
      phone: '',
      gstin: '',
      pan: '',
      stateName: '',
      stateCode: '',
    },
    shipTo: {
      name: '',
      contactPerson: '',
      address: '',
      gstin: '',
      stateName: '',
      stateCode: '',
      vehicleNo: '',
      shipBy: 'Road',
      transporterName: '',
    },
    invoice: {
      documentNumber: '',
      copyLabel: 'Original for Recipient',
      issueDate: today,
      dueDate,
      dispatchFrom: '',
      dispatchDate: today,
      placeOfSupply: '',
      vendorCode: '',
      poReference: '',
      poDate: '',
      projectName: '',
      servicePeriod: '',
      reverseCharge: 'N',
      receiptVoucherNo: '',
      cnReference: '',
      dnReference: '',
    },
    lineItems: [
      defaultLineItem({
        description: 'Healthcare Camp / Activation Services',
        igstRate: 18,
        cgstRate: 9,
        sgstRate: 9,
      }),
    ],
    terms: [INVOICE_PAYMENT_TERM],
    declaration: msmeDeclaration(),
    adjustments: {
      cnAmount: 0,
      dnAmount: 0,
      advanceReceived: 0,
      roundOff: '',
    },
    taxColumnLabels: {
      rateLabel: 'GST Rate %',
      amountLabel: 'GST',
    },
    signature: {
      imageDataUrl: '',
      signatoryName: '',
      companyLabel: '',
    },
    taxMode: 'igst',
  };
}

function readSeqMap() {
  try {
    return JSON.parse(localStorage.getItem(NUMBER_KEY) || '{}');
  } catch {
    return {};
  }
}

export function peekInvoiceNumber(dateIso) {
  const seqMap = readSeqMap();
  const fy = fiscalYearLabel(dateIso ? new Date(dateIso) : new Date());
  const next = (seqMap[fy] || 0) + 1;
  return `TYLO/${fy}/${String(next).padStart(4, '0')}`;
}

export function nextInvoiceNumber(dateIso) {
  const num = peekInvoiceNumber(dateIso);
  const fy = fiscalYearLabel(dateIso ? new Date(dateIso) : new Date());
  const seqMap = readSeqMap();
  seqMap[fy] = (seqMap[fy] || 0) + 1;
  localStorage.setItem(NUMBER_KEY, JSON.stringify(seqMap));
  return num;
}

export function loadInvoiceDraft() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveInvoiceDraft(form) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...form, savedAt: new Date().toISOString() }));
}

export function clearInvoiceDraft() {
  localStorage.removeItem(STORAGE_KEY);
}
