import { todayIso } from '../../../shared/dateFormat.js';
import { fiscalYearLabel } from '../documentNumbering.js';

const STORAGE_KEY = 'tylo_one_purchase_order_generator_v1';
const NUMBER_KEY = 'tylo_one_purchase_order_number_seq';

export const MAX_PO_LINE_ITEMS = 5;

export function defaultPoLineItem(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    itemCode: '',
    description: '',
    hsnSac: '',
    uom: 'Nos',
    qty: 1,
    rate: 0,
    discount: 0,
    igstRate: 18,
    cgstRate: 9,
    sgstRate: 9,
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
      address: '',
      registeredOffice: '',
      email: '',
      phone: '',
      website: '',
      gstin: '',
      pan: '',
      cin: '',
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
      paymentQrDataUrl: '',
    },
    vendor: {
      name: '',
      address: '',
      gstin: '',
      pan: '',
      stateName: '',
      stateCode: '',
      contactPerson: '',
      email: '',
    },
    billingAddress: '',
    deliveryAddress: '',
    po: {
      documentNumber: '',
      documentDate: today,
      deliveryDate: today,
      paymentTerms: 'Net 30 days from invoice date',
      reference: '',
    },
    lineItems: [defaultPoLineItem()],
    terms: [
      'Goods must match specifications and quality standards agreed upon.',
      'Payment as per payment terms mentioned above.',
      'Delivery must be completed by the delivery date unless agreed otherwise in writing.',
    ],
    shippingInstructions: '',
    notes: '',
    signature: {
      imageDataUrl: '',
      signatoryName: '',
      companyLabel: '',
    },
    vendorAcceptance: {
      signatoryName: '',
      acceptedDate: '',
      companyLabel: '',
    },
    taxColumnLabels: {
      rateLabel: 'GST %',
      amountLabel: 'GST',
    },
  };
}

function migratePurchaseOrderDraft(raw) {
  if (!raw) return null;
  const base = defaultPurchaseOrderForm();

  const vendor = {
    ...base.vendor,
    ...(raw.vendor || {}),
    name: raw.vendor?.name || raw.vendorName || '',
    address: raw.vendor?.address || raw.vendorAddress || '',
    gstin: raw.vendor?.gstin || raw.vendorGstin || '',
  };

  const po = {
    ...base.po,
    ...(raw.po || {}),
    documentNumber: raw.po?.documentNumber || raw.documentNumber || base.po.documentNumber,
    documentDate: raw.po?.documentDate || raw.documentDate || base.po.documentDate,
    deliveryDate: raw.po?.deliveryDate || raw.dueDate || base.po.deliveryDate,
    paymentTerms: raw.po?.paymentTerms || raw.paymentTerms || base.po.paymentTerms,
    reference: raw.po?.reference || raw.reference || '',
  };

  const company = {
    ...base.company,
    ...(raw.company || {}),
    address: raw.company?.address || raw.company?.registeredOffice || base.company.address,
    registeredOffice: raw.company?.registeredOffice || raw.company?.address || base.company.registeredOffice,
  };

  const lineItems = (raw.lineItems || []).map((line) =>
    defaultPoLineItem({
      ...line,
      itemCode: line.itemCode || line.hsnSac || '',
      hsnSac: line.hsnSac || line.itemCode || '',
      uom: line.uom || 'Nos',
      discount: line.discount ?? 0,
      igstRate: line.igstRate ?? raw.purchaseTaxRate ?? 18,
      cgstRate: line.cgstRate ?? (Number(raw.purchaseTaxRate) || 18) / 2,
      sgstRate: line.sgstRate ?? (Number(raw.purchaseTaxRate) || 18) / 2,
      rate: line.isFoc ? 0 : line.rate,
    })
  );

  const terms = Array.isArray(raw.terms)
    ? raw.terms
    : raw.notes && !Array.isArray(raw.terms)
      ? base.terms
      : base.terms;

  return {
    ...base,
    ...raw,
    company,
    bank: { ...base.bank, ...(raw.bank || {}) },
    payment: { ...base.payment, ...(raw.payment || {}) },
    vendor,
    po,
    billingAddress: raw.billingAddress || company.address || company.registeredOffice || '',
    deliveryAddress: raw.deliveryAddress || '',
    lineItems: lineItems.length ? lineItems : base.lineItems,
    terms,
    shippingInstructions: raw.shippingInstructions || '',
    notes: raw.notes || '',
    signature: { ...base.signature, ...(raw.signature || {}) },
    vendorAcceptance: { ...base.vendorAcceptance, ...(raw.vendorAcceptance || {}) },
    taxColumnLabels: { ...base.taxColumnLabels, ...(raw.taxColumnLabels || {}) },
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
  const fy = fiscalYearLabel(d);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${fy}_${mm}`;
}

export function peekPONumber(dateIso) {
  const seqMap = readSeqMap();
  const d = dateIso ? new Date(dateIso) : new Date();
  const fy = fiscalYearLabel(d);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const key = periodKey(dateIso);
  const next = (seqMap[key] || 0) + 1;
  return `PO/${fy}/${mm}/${String(next).padStart(4, '0')}`;
}

export function nextPONumber(dateIso) {
  const seqMap = readSeqMap();
  const d = dateIso ? new Date(dateIso) : new Date();
  const fy = fiscalYearLabel(d);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const key = periodKey(dateIso);
  const next = (seqMap[key] || 0) + 1;
  seqMap[key] = next;
  localStorage.setItem(NUMBER_KEY, JSON.stringify(seqMap));
  return `PO/${fy}/${mm}/${String(next).padStart(4, '0')}`;
}

export function loadPurchaseOrderDraft() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? migratePurchaseOrderDraft(JSON.parse(raw)) : null;
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
