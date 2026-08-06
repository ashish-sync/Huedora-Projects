import { todayIso } from '../../../shared/dateFormat.js';
import { fiscalYearLabel } from '../documentNumbering.js';

const STORAGE_KEY = 'tylo_one_proforma_generator_v1';
const NUMBER_KEY = 'tylo_one_proforma_number_seq';

/** Max line items on Tylo proforma (portrait A4). */
export const MAX_PROFORMA_LINE_ITEMS = 8;

export const PROFORMA_DECLARATION =
  'This is a Proforma Invoice issued for quotation, approval or advance payment purposes only. It is not a Tax Invoice under the GST Act and does not create any GST liability. A final Tax Invoice will be issued upon confirmation and/or execution of services, as applicable.\n\nThis document is a Proforma Invoice and does not constitute a Tax Invoice under GST. Prices are indicative based on the proposed scope. GST, if applicable, will be charged in the final Tax Invoice.';

export const PROFORMA_PAYMENT_TERM =
  'Payment is due within 30 days from the date of the final Tax Invoice unless otherwise agreed.';

export function defaultLineRow(overrides = {}) {
  return {
    type: 'line',
    id: crypto.randomUUID(),
    description: 'Healthcare Camp / Activation Services',
    hsnSac: '999316',
    qty: 1,
    rate: 0,
    discount: 0,
    igstRate: 18,
    cgstRate: 9,
    sgstRate: 9,
    ...overrides,
  };
}

export function defaultSectionRow(title = 'A. Services') {
  return {
    type: 'section',
    id: crypto.randomUUID(),
    title,
  };
}

export function defaultProformaForm() {
  const today = todayIso();
  const due = new Date(today);
  due.setDate(due.getDate() + 30);
  const dueDate = due.toISOString().slice(0, 10);
  return {
    company: {
      logoDataUrl: '',
      legalName: '',
      brandLine: '',
      registeredOffice: '',
      gstin: '',
      pan: '',
      cin: '',
      udyam: '',
      udyamLabel: '',
      phone: '',
      email: '',
      website: '',
      stateCode: '',
    },
    clientMasterId: '',
    clientId: '',
    shipToSameAsBillTo: false,
    recipient: {
      name: '',
      projectName: '',
      placeOfSupply: '',
      deliveryAddress: '',
      contactPerson: '',
      contactEmail: '',
      recipientGstin: '',
      recipientPan: '',
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
    },
    document: {
      documentNumber: '',
      issueDate: today,
      dueDate,
      paymentTermsDays: 30,
      reference: '',
      referenceDate: '',
      servicePeriod: '',
      customNotes: '',
    },
    bank: {
      bankName: '',
      accountNumber: '',
      ifscCode: '',
      bankBranch: '',
      accountHolder: '',
    },
    payment: {
      upiId: '',
      paymentQrDataUrl: '',
    },
    adjustments: {
      cnAmount: 0,
      dnAmount: 0,
      advanceReceived: 0,
      roundOff: '',
    },
    rows: [defaultLineRow()],
    terms: [PROFORMA_PAYMENT_TERM],
    declaration: PROFORMA_DECLARATION,
    taxColumnLabels: {
      rateLabel: 'GST Rate %',
      amountLabel: 'GST',
    },
    signature: {
      imageDataUrl: '',
      signatoryName: 'Authorised Signatory',
      companyLabel: '',
    },
  };
}

export function peekProformaNumber(dateIso) {
  const d = dateIso ? new Date(dateIso) : new Date();
  const fy = fiscalYearLabel(d);
  let seqMap = {};
  try {
    seqMap = JSON.parse(localStorage.getItem(NUMBER_KEY) || '{}');
  } catch {
    seqMap = {};
  }
  const next = (seqMap[fy] || 0) + 1;
  return `TYLO/${fy}/${String(next).padStart(4, '0')}`;
}

export function nextProformaNumber(dateIso) {
  const num = peekProformaNumber(dateIso);
  const d = dateIso ? new Date(dateIso) : new Date();
  const fy = fiscalYearLabel(d);
  let seqMap = {};
  try {
    seqMap = JSON.parse(localStorage.getItem(NUMBER_KEY) || '{}');
  } catch {
    seqMap = {};
  }
  seqMap[fy] = (seqMap[fy] || 0) + 1;
  localStorage.setItem(NUMBER_KEY, JSON.stringify(seqMap));
  return num;
}

export function loadProformaDraft() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveProformaDraft(form) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...form, savedAt: new Date().toISOString() }));
}

export function clearProformaDraft() {
  localStorage.removeItem(STORAGE_KEY);
}
