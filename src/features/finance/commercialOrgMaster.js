import { api } from '../../shared/api.js';
import { TYLO_ORG_SEED } from './tyloOrgSeed.js';
import { TYLO_LOGO_DATA_URL } from '../../shared/tyloLogoDataUrl.js';

const CACHE_KEY = 'tylo_commercial_org_master_v1';

/** Base64 logo/QR blobs are too large for localStorage (~5MB quota) and live on the API. */
const CACHE_OMIT_KEYS = ['logoDataUrl', 'paymentQrDataUrl'];

function toCachePayload(data) {
  if (!data || typeof data !== 'object') return null;
  const out = { ...data };
  CACHE_OMIT_KEYS.forEach((key) => {
    delete out[key];
  });
  // Drop mongoose / API noise that only inflates the cache
  delete out.__v;
  return out;
}

export const ORG_MASTER_FIELD_GROUPS = [
  {
    id: 'identity',
    title: 'Company identity',
    description: 'Logo, name, and contact details used on all commercial documents.',
    fields: [
      { key: 'logoDataUrl', label: 'Upload Logo', type: 'logo' },
      { key: 'legalName', label: 'Full Name', type: 'text', required: true },
      { key: 'brandLine', label: 'Tagline', type: 'text' },
      { key: 'registeredOffice', label: 'Registered Address', type: 'textarea' },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'phone', label: 'Phone', type: 'text' },
      { key: 'website', label: 'Website', type: 'text' },
      { key: 'gstin', label: 'GSTIN', type: 'text' },
      { key: 'cin', label: 'CIN', type: 'text' },
      { key: 'pan', label: 'PAN', type: 'text' },
      { key: 'udyam', label: 'Udyam Registration No.', type: 'text' },
      { key: 'udyamLabel', label: 'Udyam category', type: 'text' },
      { key: 'stateCode', label: 'State code', type: 'text' },
    ],
  },
  {
    id: 'bank',
    title: 'Bank & payment',
    description: 'Bank details and payment QR shown on invoices, proforma, PO, and credit notes.',
    fields: [
      { key: 'accountHolder', label: 'Account Holder', type: 'text' },
      { key: 'bankName', label: 'Bank', type: 'text' },
      { key: 'accountNumber', label: 'A/C No', type: 'text' },
      { key: 'bankBranch', label: 'Branch', type: 'text' },
      { key: 'ifscCode', label: 'IFSC', type: 'text' },
      { key: 'paymentQrDataUrl', label: 'Payment QR Code', type: 'qr' },
      { key: 'upiId', label: 'UPI ID (optional — generates QR if no image uploaded)', type: 'text' },
    ],
  },
];

export function loadOrgMasterCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Migrate older caches that stored full data-URL images and filled the quota.
    if (parsed?.logoDataUrl || parsed?.paymentQrDataUrl) {
      saveOrgMasterCache(parsed);
      return toCachePayload(parsed);
    }
    return parsed;
  } catch {
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch {
      /* ignore */
    }
    return null;
  }
}

export function saveOrgMasterCache(data) {
  if (!data || typeof localStorage === 'undefined') return;
  const payload = toCachePayload(data);
  if (!payload) return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch (err) {
    // QuotaExceededError — drop this cache rather than break Finance screens.
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch {
      /* ignore */
    }
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('Org master cache skipped (storage quota):', err?.name || err);
    }
  }
}

export async function fetchCommercialOrgMaster() {
  const res = await api('/finance/org-profile');
  const data = res.data || res;
  saveOrgMasterCache(data);
  return data;
}

export async function saveCommercialOrgMaster(payload) {
  const res = await api('/finance/org-profile', { method: 'PATCH', body: payload });
  const data = res.data || res;
  saveOrgMasterCache(data);
  return data;
}

/** Prefer organisation master values; fall back to Tylo seed for empty fields. */
function masterVal(master, key, fallback = '') {
  const v = master?.[key];
  if (v != null && String(v).trim() !== '') return v;
  const seed = TYLO_ORG_SEED[key];
  if (seed != null && String(seed).trim() !== '') return seed;
  return fallback;
}

/** Apply org master onto invoice generator form (company, bank, payment). */
export function applyOrgMasterToInvoiceForm(form, master) {
  const m = master || {};
  return {
    ...form,
    company: {
      ...form.company,
      logoDataUrl: masterVal(m, 'logoDataUrl', form.company?.logoDataUrl || TYLO_LOGO_DATA_URL),
      legalName: masterVal(m, 'legalName', form.company?.legalName),
      brandLine: masterVal(m, 'brandLine', form.company?.brandLine),
      address: masterVal(m, 'registeredOffice', form.company?.address),
      email: masterVal(m, 'email', form.company?.email),
      phone: masterVal(m, 'phone', form.company?.phone),
      website: masterVal(m, 'website', form.company?.website),
      gstin: masterVal(m, 'gstin', form.company?.gstin),
      pan: masterVal(m, 'pan', form.company?.pan),
      cin: masterVal(m, 'cin', form.company?.cin),
      udyam: masterVal(m, 'udyam', form.company?.udyam),
      udyamLabel: masterVal(m, 'udyamLabel', form.company?.udyamLabel),
      stateCode: masterVal(m, 'stateCode', form.company?.stateCode),
    },
    bank: {
      ...form.bank,
      accountHolder: masterVal(m, 'accountHolder', m.legalName || form.bank?.accountHolder),
      bankName: masterVal(m, 'bankName', form.bank?.bankName),
      accountNumber: masterVal(m, 'accountNumber', form.bank?.accountNumber),
      branchName: masterVal(m, 'bankBranch', form.bank?.branchName),
      ifscCode: masterVal(m, 'ifscCode', form.bank?.ifscCode),
    },
    payment: {
      ...form.payment,
      upiId: masterVal(m, 'upiId', form.payment?.upiId),
      paymentQrDataUrl: masterVal(m, 'paymentQrDataUrl', form.payment?.paymentQrDataUrl),
      qrEnabled: true,
    },
    signature: {
      ...form.signature,
      companyLabel: masterVal(m, 'legalName', form.signature?.companyLabel),
    },
  };
}

/** Apply org master onto proforma generator form. */
export function applyOrgMasterToProformaForm(form, master) {
  const m = master || {};
  return {
    ...form,
    company: {
      ...form.company,
      logoDataUrl: masterVal(master, 'logoDataUrl', form.company?.logoDataUrl || TYLO_LOGO_DATA_URL),
      legalName: masterVal(master, 'legalName', form.company?.legalName),
      brandLine: masterVal(master, 'brandLine', form.company?.brandLine),
      registeredOffice: masterVal(master, 'registeredOffice', form.company?.registeredOffice),
      email: masterVal(master, 'email', form.company?.email),
      phone: masterVal(master, 'phone', form.company?.phone),
      website: masterVal(master, 'website', form.company?.website),
      gstin: masterVal(master, 'gstin', form.company?.gstin),
      pan: masterVal(master, 'pan', form.company?.pan),
      cin: masterVal(master, 'cin', form.company?.cin),
      udyam: masterVal(master, 'udyam', form.company?.udyam),
      udyamLabel: masterVal(master, 'udyamLabel', form.company?.udyamLabel),
      stateCode: masterVal(master, 'stateCode', form.company?.stateCode),
    },
    bank: {
      ...form.bank,
      accountHolder: masterVal(master, 'accountHolder', master.legalName || form.bank?.accountHolder),
      bankName: masterVal(master, 'bankName', form.bank?.bankName),
      accountNumber: masterVal(master, 'accountNumber', form.bank?.accountNumber),
      bankBranch: masterVal(master, 'bankBranch', form.bank?.bankBranch),
      ifscCode: masterVal(master, 'ifscCode', form.bank?.ifscCode),
    },
    payment: {
      ...form.payment,
      upiId: masterVal(master, 'upiId', form.payment?.upiId),
      paymentQrDataUrl: masterVal(master, 'paymentQrDataUrl', form.payment?.paymentQrDataUrl),
    },
    signature: {
      ...form.signature,
      companyLabel: masterVal(master, 'legalName', form.signature?.companyLabel),
    },
  };
}

/** Apply org master onto purchase order generator form. */
export function applyOrgMasterToPurchaseOrderForm(form, master) {
  const m = master || {};
  const address = masterVal(m, 'registeredOffice', form.company?.address || form.company?.registeredOffice);
  const legal = masterVal(m, 'legalName', form.company?.legalName);
  const gstin = masterVal(m, 'gstin', form.company?.gstin);
  const email = masterVal(m, 'email', form.company?.email);
  const phone = masterVal(m, 'phone', form.company?.phone);
  const stateCode = masterVal(m, 'stateCode', form.company?.stateCode);
  const state = masterVal(m, 'state', form.company?.state || form.billing?.state);
  return {
    ...form,
    company: {
      ...form.company,
      logoDataUrl: masterVal(m, 'logoDataUrl', form.company?.logoDataUrl || TYLO_LOGO_DATA_URL),
      legalName: legal,
      brandLine: masterVal(m, 'brandLine', form.company?.brandLine),
      address,
      registeredOffice: address,
      email,
      phone,
      website: masterVal(m, 'website', form.company?.website),
      gstin,
      pan: masterVal(m, 'pan', form.company?.pan),
      cin: masterVal(m, 'cin', form.company?.cin),
      udyam: masterVal(m, 'udyam', form.company?.udyam),
      udyamLabel: masterVal(m, 'udyamLabel', form.company?.udyamLabel),
      stateCode,
      state,
    },
    buyer: {
      ...form.buyer,
      companyName: form.buyer?.companyName || legal || '',
      address: form.buyer?.address || address || '',
      gstin: form.buyer?.gstin || gstin || '',
      email: form.buyer?.email || email || '',
      mobile: form.buyer?.mobile || phone || '',
    },
    billing: {
      ...form.billing,
      address:
        form.billing?.address ||
        [legal, address].filter(Boolean).join(', '),
      gstin: form.billing?.gstin || gstin || '',
      state: form.billing?.state || state || '',
      stateCode: form.billing?.stateCode || stateCode || '',
      placeOfSupply:
        form.billing?.placeOfSupply ||
        [state, stateCode ? `(${stateCode})` : null].filter(Boolean).join(' '),
    },
    bank: {
      ...form.bank,
      accountHolder: masterVal(m, 'accountHolder', m.legalName || form.bank?.accountHolder),
      bankName: masterVal(m, 'bankName', form.bank?.bankName),
      accountNumber: masterVal(m, 'accountNumber', form.bank?.accountNumber),
      branchName: masterVal(m, 'bankBranch', form.bank?.branchName),
      ifscCode: masterVal(m, 'ifscCode', form.bank?.ifscCode),
    },
    payment: {
      ...form.payment,
      upiId: masterVal(m, 'upiId', form.payment?.upiId),
      paymentQrDataUrl: masterVal(m, 'paymentQrDataUrl', form.payment?.paymentQrDataUrl),
    },
    signature: {
      ...form.signature,
      companyLabel: masterVal(m, 'legalName', form.signature?.companyLabel),
    },
  };
}

/** Shared org profile for PO / credit note previews */
export function getOrgMasterDisplay(master) {
  if (!master) return null;
  return {
    logoDataUrl: master.logoDataUrl,
    legalName: master.legalName,
    brandLine: master.brandLine,
    address: master.registeredOffice,
    email: master.email,
    phone: master.phone,
    website: master.website,
    gstin: master.gstin,
    pan: master.pan,
    cin: master.cin,
    stateCode: master.stateCode,
    bank: {
      accountHolder: master.accountHolder || master.legalName,
      bankName: master.bankName,
      accountNumber: master.accountNumber,
      branchName: master.bankBranch,
      ifscCode: master.ifscCode,
    },
  };
}

export function emptyOrgMasterForm() {
  return {
    legalName: '',
    brandLine: '',
    registeredOffice: '',
    email: '',
    phone: '',
    website: '',
    accountHolder: '',
    bankName: '',
    accountNumber: '',
    bankBranch: '',
    ifscCode: '',
    upiId: '',
    logoDataUrl: '',
    paymentQrDataUrl: '',
    gstin: '',
    pan: '',
    cin: '',
    udyam: '',
    udyamLabel: '',
    stateCode: '',
  };
}

export function orgMasterToPayload(form) {
  return {
    legalName: form.legalName,
    brandLine: form.brandLine,
    registeredOffice: form.registeredOffice,
    email: form.email,
    phone: form.phone,
    website: form.website,
    accountHolder: form.accountHolder,
    bankName: form.bankName,
    accountNumber: form.accountNumber,
    bankBranch: form.bankBranch,
    ifscCode: form.ifscCode,
    upiId: form.upiId,
    logoDataUrl: form.logoDataUrl,
    paymentQrDataUrl: form.paymentQrDataUrl,
    gstin: form.gstin,
    pan: form.pan,
    cin: form.cin,
    udyam: form.udyam,
    udyamLabel: form.udyamLabel,
    stateCode: form.stateCode,
  };
}
