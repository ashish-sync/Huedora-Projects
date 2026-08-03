import { todayIso } from '../../../shared/dateFormat.js';
import {
  defaultLineItem,
  MAX_INVOICE_LINE_ITEMS,
} from '../invoiceGenerator/invoiceStorage.js';

const STORAGE_KEY = 'tylo_one_credit_note_generator_v1';
const NUMBER_KEY = 'tylo_one_credit_note_number_seq';

export { MAX_INVOICE_LINE_ITEMS as MAX_CREDIT_NOTE_LINE_ITEMS };

export function defaultCreditNoteForm() {
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
      qrEnabled: false,
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
      documentNumber: peekCreditNoteNumber(today),
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
      'This credit note is issued against the original tax invoice referenced above.',
      'The credited amount will be adjusted against future invoices or refunded as agreed.',
    ],
    declaration:
      'We declare that this credit note shows the actual particulars of the credit issued and that all details are true and correct.',
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

function readSeqMap() {
  try {
    return JSON.parse(localStorage.getItem(NUMBER_KEY) || '{}');
  } catch {
    return {};
  }
}

function periodKey(dateIso) {
  const d = dateIso ? new Date(dateIso) : new Date();
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${yy}-${mm}`;
}

export function peekCreditNoteNumber(dateIso) {
  const seqMap = readSeqMap();
  const key = periodKey(dateIso);
  const next = (seqMap[key] || 0) + 1;
  return `TCCN-${key}-${String(next).padStart(3, '0')}`;
}

export function nextCreditNoteNumber(dateIso) {
  const seqMap = readSeqMap();
  const key = periodKey(dateIso);
  const next = (seqMap[key] || 0) + 1;
  seqMap[key] = next;
  localStorage.setItem(NUMBER_KEY, JSON.stringify(seqMap));
  return `TCCN-${key}-${String(next).padStart(3, '0')}`;
}

export function loadCreditNoteDraft() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveCreditNoteDraft(form) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...form, savedAt: new Date().toISOString() }));
}

export function clearCreditNoteDraft() {
  localStorage.removeItem(STORAGE_KEY);
}
