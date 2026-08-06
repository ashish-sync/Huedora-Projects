import { todayIso } from '../../../shared/dateFormat.js';
import { fiscalYearLabel } from '../documentNumbering.js';

const STORAGE_KEY = 'tylo_one_purchase_order_generator_v1';
const NUMBER_KEY = 'tylo_one_purchase_order_number_seq';

export const MAX_PO_LINE_ITEMS = 7;

export function defaultPoLineItem(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    description: '',
    make: '',
    model: '',
    unit: 'Nos',
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
      udyam: '',
      udyamLabel: '',
      stateCode: '',
      state: '',
    },
    buyer: {
      companyName: '',
      address: '',
      gstin: '',
      contactPerson: '',
      mobile: '',
      email: '',
    },
    vendor: {
      name: '',
      code: 'VND-000123',
      address: '',
      gstin: '',
      pan: '',
      stateName: '',
      stateCode: '',
      contactPerson: '',
      mobile: '',
      email: '',
    },
    delivery: {
      address: '',
      contact: '',
      mobile: '',
      expectedDate: today,
      instructions: '',
    },
    billing: {
      address: '',
      gstin: '',
      state: '',
      stateCode: '',
      placeOfSupply: '',
    },
    commercial: {
      paymentTerms: '',
      freight: '',
      insurance: '',
      deliveryTerms: '',
      warranty: '',
      validity: '',
    },
    po: {
      documentNumber: '',
      documentDate: today,
      vendorQuoteRef: '',
      vendorQuoteDate: '',
      revisionNo: 0,
      projectCostCentre: '',
      // legacy aliases kept for older drafts
      deliveryDate: today,
      paymentTerms: '',
      reference: '',
    },
    lineItems: [defaultPoLineItem()],
    terms: [],
    notes: '',
    signature: {
      imageDataUrl: '',
      signatoryName: '',
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
  const company = {
    ...base.company,
    ...(raw.company || {}),
    address: raw.company?.address || raw.company?.registeredOffice || base.company.address,
    registeredOffice: raw.company?.registeredOffice || raw.company?.address || base.company.registeredOffice,
  };
  const vendor = {
    ...base.vendor,
    ...(raw.vendor || {}),
    name: raw.vendor?.name || raw.vendorName || '',
    code: raw.vendor?.code || base.vendor.code,
    address: raw.vendor?.address || raw.vendorAddress || '',
    gstin: raw.vendor?.gstin || raw.vendorGstin || '',
    mobile: raw.vendor?.mobile || '',
  };
  const po = {
    ...base.po,
    ...(raw.po || {}),
    documentNumber: raw.po?.documentNumber || raw.documentNumber || '',
    documentDate: raw.po?.documentDate || raw.documentDate || base.po.documentDate,
    vendorQuoteRef: raw.po?.vendorQuoteRef || raw.po?.reference || '',
    vendorQuoteDate: raw.po?.vendorQuoteDate || '',
    revisionNo: raw.po?.revisionNo ?? 0,
    projectCostCentre: raw.po?.projectCostCentre || raw.po?.reference || '',
    deliveryDate: raw.po?.deliveryDate || raw.dueDate || base.po.deliveryDate,
  };
  const lineItems = (raw.lineItems || []).map((line) =>
    defaultPoLineItem({
      ...line,
      unit: line.unit || line.uom || 'Nos',
      uom: line.uom || line.unit || 'Nos',
      make: line.make || '',
      model: line.model || '',
      discount: line.discount ?? 0,
    })
  );

  return {
    ...base,
    ...raw,
    company,
    buyer: {
      ...base.buyer,
      ...(raw.buyer || {}),
      companyName: raw.buyer?.companyName || company.legalName || '',
      address: raw.buyer?.address || company.registeredOffice || company.address || '',
      gstin: raw.buyer?.gstin || company.gstin || '',
      email: raw.buyer?.email || company.email || '',
      mobile: raw.buyer?.mobile || company.phone || '',
    },
    vendor,
    delivery: {
      ...base.delivery,
      ...(raw.delivery || {}),
      address: raw.delivery?.address || raw.deliveryAddress || '',
      expectedDate: raw.delivery?.expectedDate || po.deliveryDate || base.delivery.expectedDate,
      instructions: raw.delivery?.instructions || raw.shippingInstructions || '',
    },
    billing: {
      ...base.billing,
      ...(raw.billing || {}),
      address:
        raw.billing?.address ||
        raw.billingAddress ||
        [company.legalName, company.registeredOffice || company.address].filter(Boolean).join(', '),
      gstin: raw.billing?.gstin || company.gstin || '',
      state: raw.billing?.state || company.state || '',
      stateCode: raw.billing?.stateCode || company.stateCode || '',
      placeOfSupply:
        raw.billing?.placeOfSupply ||
        [company.state, company.stateCode ? `(${company.stateCode})` : null].filter(Boolean).join(' '),
    },
    commercial: {
      ...base.commercial,
      ...(raw.commercial || {}),
      paymentTerms: raw.commercial?.paymentTerms || raw.po?.paymentTerms || '',
    },
    po,
    lineItems: lineItems.length ? lineItems : base.lineItems,
    signature: { ...base.signature, ...(raw.signature || {}) },
  };
}

function readSeqMap() {
  try {
    return JSON.parse(localStorage.getItem(NUMBER_KEY) || '{}');
  } catch {
    return {};
  }
}

export function peekPONumber(dateIso) {
  const seqMap = readSeqMap();
  const fy = fiscalYearLabel(dateIso ? new Date(dateIso) : new Date());
  const next = (seqMap[fy] || 0) + 1;
  return `PO/${fy}/${String(next).padStart(4, '0')}`;
}

export function nextPONumber(dateIso) {
  const num = peekPONumber(dateIso);
  const fy = fiscalYearLabel(dateIso ? new Date(dateIso) : new Date());
  const seqMap = readSeqMap();
  seqMap[fy] = (seqMap[fy] || 0) + 1;
  localStorage.setItem(NUMBER_KEY, JSON.stringify(seqMap));
  return num;
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
