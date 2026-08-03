import { todayIso } from '../../../shared/dateFormat.js';

const STORAGE_KEY = 'tylo_one_invoice_generator_v1';
const NUMBER_KEY = 'tylo_one_invoice_number_seq';

/** Max line items on Tylo GST invoice (A4 landscape single-page layout). */
export const MAX_INVOICE_LINE_ITEMS = 5;

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
      qrEnabled: true,
      paymentQrDataUrl: '',
    },
    clientMasterId: '',
    clientId: '',
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
      vehicleNo: '',
      shipBy: 'Road',
      transporterName: '',
    },
    invoice: {
      documentNumber: peekInvoiceNumber(today),
      copyLabel: 'Original for Recipient',
      issueDate: today,
      dueDate: today,
      dispatchFrom: '',
      dispatchDate: today,
      placeOfSupply: '',
      vendorCode: '',
      poReference: '',
      projectName: '',
      reverseCharge: 'N',
      receiptVoucherNo: '',
      cnReference: '',
      dnReference: '',
    },
    lineItems: [defaultLineItem()],
    terms: [
      'Please check the total amount before making payment.',
      'Payment to be made via NEFT/RTGS/UPI as per bank details.',
      'Goods once sold will not be taken back after 30 days.',
    ],
    declaration:
      'We declare that this invoice shows the actual price of the goods/services described and that all particulars are true and correct.',
    adjustments: {
      cnAmount: 0,
      dnAmount: 0,
      advanceReceived: 0,
    },
    taxColumnLabels: {
      rateLabel: 'GST %',
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

export function nextInvoiceNumber(dateIso) {
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
  seqMap[periodKey] = next;
  localStorage.setItem(NUMBER_KEY, JSON.stringify(seqMap));

  return `TCIN-${yy}-${mm}-${String(next).padStart(3, '0')}`;
}

export function peekInvoiceNumber(dateIso) {
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
  return `TCIN-${yy}-${mm}-${String(next).padStart(3, '0')}`;
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
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ ...form, savedAt: new Date().toISOString() })
  );
}

export function clearInvoiceDraft() {
  localStorage.removeItem(STORAGE_KEY);
}
