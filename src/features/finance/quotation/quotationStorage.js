import { todayIso } from '../../../shared/dateFormat.js';
import { fiscalYearLabel } from '../documentNumbering.js';
import {
  defaultLineItem,
  MAX_INVOICE_LINE_ITEMS,
} from '../invoiceGenerator/invoiceStorage.js';

const STORAGE_KEY = 'tylo_one_quotation_generator_v1';
const NUMBER_KEY = 'tylo_one_quotation_number_seq';

export { MAX_INVOICE_LINE_ITEMS as MAX_QUOTATION_LINE_ITEMS };

export const QUOTATION_DECLARATION =
  'This quotation is issued for budgetary/commercial evaluation only. It is neither a Proforma Invoice nor a Tax Invoice. Prices are based on the proposed scope, subject to applicable GST, commercial discussions and issuance of a Purchase Order/Work Order. A Proforma Invoice or Tax Invoice will be issued, as applicable.';

export const QUOTATION_PAYMENT_TERM =
  'Payment terms: 30 days from the date of the Tax Invoice unless otherwise agreed in writing.';

export function defaultQuotationForm() {
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
    terms: [QUOTATION_PAYMENT_TERM],
    declaration: QUOTATION_DECLARATION,
    adjustments: {
      cnAmount: 0,
      dnAmount: 0,
      advanceReceived: 0,
    },
    taxColumnLabels: {
      rateLabel: 'GST Rate',
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

export function peekQuotationNumber(dateIso) {
  const seqMap = readSeqMap();
  const fy = fiscalYearLabel(dateIso ? new Date(dateIso) : new Date());
  const next = (seqMap[fy] || 0) + 1;
  return `TYLO/${fy}/${String(next).padStart(4, '0')}`;
}

export function nextQuotationNumber(dateIso) {
  const num = peekQuotationNumber(dateIso);
  const fy = fiscalYearLabel(dateIso ? new Date(dateIso) : new Date());
  const seqMap = readSeqMap();
  seqMap[fy] = (seqMap[fy] || 0) + 1;
  localStorage.setItem(NUMBER_KEY, JSON.stringify(seqMap));
  return num;
}

export function loadQuotationDraft() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveQuotationDraft(form) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...form, savedAt: new Date().toISOString() }));
}

export function clearQuotationDraft() {
  localStorage.removeItem(STORAGE_KEY);
}
