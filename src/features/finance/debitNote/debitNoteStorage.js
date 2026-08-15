import { todayIso } from '../../../shared/dateFormat.js';
import { formatLocalDocumentNumber, localDocumentPeriodKey } from '../documentNumbering.js';
import {
  defaultLineItem,
  MAX_INVOICE_LINE_ITEMS,
} from '../invoiceGenerator/invoiceStorage.js';

const STORAGE_KEY = 'tylo_one_debit_note_generator_v1';
const NUMBER_KEY = 'tylo_one_debit_note_number_seq';

export { MAX_INVOICE_LINE_ITEMS as MAX_DEBIT_NOTE_LINE_ITEMS };

export function defaultDebitNoteForm() {
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
      dnReference: '',
      originalInvoiceDate: '',
      debitReason: 'Additional Service / Underbilling / Rate Revision / Tax Adjustment',
    },
    lineItems: [
      defaultLineItem({
        description: 'Healthcare Camp / Activation Services',
      }),
    ],
    terms: ['Payment is due within 30 days from the date of invoice.'],
    declaration: '',
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

export function peekDebitNoteNumber(dateIso) {
  const seqMap = readSeqMap();
  const key = localDocumentPeriodKey(dateIso);
  const next = (seqMap[key] || 0) + 1;
  return formatLocalDocumentNumber('TCDN', dateIso, next);
}

export function nextDebitNoteNumber(dateIso) {
  const seqMap = readSeqMap();
  const key = localDocumentPeriodKey(dateIso);
  const next = (seqMap[key] || 0) + 1;
  seqMap[key] = next;
  localStorage.setItem(NUMBER_KEY, JSON.stringify(seqMap));
  return formatLocalDocumentNumber('TCDN', dateIso, next);
}

export function loadDebitNoteDraft() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveDebitNoteDraft(form) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...form, savedAt: new Date().toISOString() }));
}

export function clearDebitNoteDraft() {
  localStorage.removeItem(STORAGE_KEY);
}
