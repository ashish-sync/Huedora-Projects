import { todayIso } from '../../../shared/dateFormat.js';

const STORAGE_KEY = 'tylo_one_proforma_generator_v1';
const NUMBER_KEY = 'tylo_one_proforma_number_seq';

/** Max line items on Tylo proforma (A4 landscape single-page layout). */
export const MAX_PROFORMA_LINE_ITEMS = 5;

export function defaultLineRow(overrides = {}) {
  return {
    type: 'line',
    id: crypto.randomUUID(),
    description: '',
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
  return {
    company: {
      logoDataUrl: '',
      legalName: '',
      brandLine: '',
      registeredOffice: '',
      gstin: '',
      pan: '',
      cin: '',
      phone: '',
      email: '',
      website: '',
      stateCode: '',
    },
    clientMasterId: '',
    clientId: '',
    recipient: {
      name: '',
      projectName: '',
      placeOfSupply: '',
      deliveryAddress: '',
      contactPerson: '',
      contactEmail: '',
      recipientGstin: '',
      recipientPan: '',
      stateCode: '',
    },
    document: {
      documentNumber: peekProformaNumber(today),
      issueDate: today,
      dueDate: today,
      paymentTermsDays: 45,
      reference: '',
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
    },
    rows: [defaultLineRow()],
    terms: [
      'This is a proforma invoice and not a tax invoice.',
      'Prices are valid for 30 days from the issue date.',
    ],
    taxColumnLabels: {
      rateLabel: 'GST %',
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
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const periodKey = `${yy}-${mm}`;
  let seqMap = {};
  try {
    seqMap = JSON.parse(localStorage.getItem(NUMBER_KEY) || '{}');
  } catch {
    seqMap = {};
  }
  const next = (seqMap[periodKey] || 0) + 1;
  return `TCPI-${yy}-${mm}-${String(next).padStart(3, '0')}`;
}

export function nextProformaNumber(dateIso) {
  const num = peekProformaNumber(dateIso);
  const d = dateIso ? new Date(dateIso) : new Date();
  const periodKey = `${String(d.getFullYear()).slice(-2)}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  let seqMap = {};
  try {
    seqMap = JSON.parse(localStorage.getItem(NUMBER_KEY) || '{}');
  } catch {
    seqMap = {};
  }
  seqMap[periodKey] = (seqMap[periodKey] || 0) + 1;
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
