import { todayIso } from '../../../shared/dateFormat.js';

const STORAGE_KEY = 'tylo_one_purchase_order_generator_v1';
const NUMBER_KEY = 'tylo_one_purchase_order_number_seq';

export const MAX_PO_LINE_ITEMS = 5;

export function defaultPoLineItem(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    description: '',
    qty: 1,
    rate: 0,
    isFoc: false,
    ...overrides,
  };
}

export function defaultPurchaseOrderForm() {
  const today = todayIso();
  return {
    company: {
      logoDataUrl: '',
      legalName: '',
      brandLine: '',
      registeredOffice: '',
      email: '',
      phone: '',
      website: '',
      gstin: '',
    },
    documentNumber: peekPONumber(today),
    vendorName: '',
    vendorAddress: '',
    vendorGstin: '',
    documentDate: today,
    dueDate: today,
    purchaseTaxRate: 18,
    lineItems: [defaultPoLineItem()],
    notes: 'It was great doing business with you.',
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

export function peekPONumber(dateIso) {
  const seqMap = readSeqMap();
  const key = periodKey(dateIso);
  const next = (seqMap[key] || 0) + 1;
  return `TCPO-${key}-${String(next).padStart(3, '0')}`;
}

export function nextPONumber(dateIso) {
  const seqMap = readSeqMap();
  const key = periodKey(dateIso);
  const next = (seqMap[key] || 0) + 1;
  seqMap[key] = next;
  localStorage.setItem(NUMBER_KEY, JSON.stringify(seqMap));
  return `TCPO-${key}-${String(next).padStart(3, '0')}`;
}

export function loadPurchaseOrderDraft() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function savePurchaseOrderDraft(form) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...form, savedAt: new Date().toISOString() }));
}

export function clearPurchaseOrderDraft() {
  localStorage.removeItem(STORAGE_KEY);
}
