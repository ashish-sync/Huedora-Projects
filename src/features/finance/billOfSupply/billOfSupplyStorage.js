import { todayIso } from '../../../shared/dateFormat.js';
import { fiscalYearLabel } from '../documentNumbering.js';
import {
  defaultLineItem,
  MAX_INVOICE_LINE_ITEMS,
} from '../invoiceGenerator/invoiceStorage.js';

const STORAGE_KEY = 'tylo_one_bill_of_supply_generator_v1';
const NUMBER_KEY = 'tylo_one_bill_of_supply_number_seq';

export { MAX_INVOICE_LINE_ITEMS as MAX_BILL_OF_SUPPLY_LINE_ITEMS };

export function defaultBillOfSupplyForm() {
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
        igstRate: 0,
        cgstRate: 0,
        sgstRate: 0,
      }),
    ],
    terms: [
      'Payment is due within 30 days from the date of the Bill of Supply unless otherwise agreed.',
    ],
    declaration: '',
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

function periodKey(dateIso) {
  return fiscalYearLabel(dateIso ? new Date(dateIso) : new Date());
}

export function peekBillOfSupplyNumber(dateIso) {
  const seqMap = readSeqMap();
  const fy = periodKey(dateIso);
  const next = (seqMap[fy] || 0) + 1;
  return `TYLO/${fy}/${String(next).padStart(4, '0')}`;
}

export function nextBillOfSupplyNumber(dateIso) {
  const seqMap = readSeqMap();
  const fy = periodKey(dateIso);
  const next = (seqMap[fy] || 0) + 1;
  seqMap[fy] = next;
  localStorage.setItem(NUMBER_KEY, JSON.stringify(seqMap));
  return `TYLO/${fy}/${String(next).padStart(4, '0')}`;
}

export function loadBillOfSupplyDraft() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveBillOfSupplyDraft(form) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...form, savedAt: new Date().toISOString() }));
}

export function clearBillOfSupplyDraft() {
  localStorage.removeItem(STORAGE_KEY);
}
