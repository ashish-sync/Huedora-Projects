import { api } from '../../shared/api.js';

const CACHE_KEY = 'tylo_commercial_org_master_v1';
const CACHE_KEY_PREFIX = 'tylo_commercial_org_master_v2:';
const LIST_CACHE_KEY = 'tylo_commercial_org_list_v1';

/** Base64 logo/signature blobs are too large for localStorage (~5MB quota) and live on the API. */
const CACHE_OMIT_KEYS = ['logoDataUrl', 'paymentQrDataUrl', 'signatureDataUrl'];

function toCachePayload(data) {
  if (!data || typeof data !== 'object') return null;
  const out = { ...data };
  CACHE_OMIT_KEYS.forEach((key) => {
    delete out[key];
  });
  delete out.__v;
  return out;
}

/**
 * Field groups for Organisation master — only fields used on commercial documents.
 * Letterhead: logo, legal name, address, email, website, GSTIN, CIN, Udyam
 * Tax mode: state / state code
 * Bank block: account fields
 * Digital signature: image + signatory name
 */
export const ORG_MASTER_FIELD_GROUPS = [
  {
    id: 'identity',
    title: 'Identity',
    description:
      'Legal name, address, email, and website used on document headers across all commercial docs.',
    fields: [
      { key: 'logoDataUrl', label: 'Logo', type: 'logo' },
      { key: 'legalName', label: 'Legal name', type: 'text', required: true, header: true },
      { key: 'brandLine', label: 'Tagline', type: 'text' },
      { key: 'registeredOffice', label: 'Registered address', type: 'textarea', header: true },
      { key: 'email', label: 'Email', type: 'email', header: true },
      { key: 'website', label: 'Website', type: 'text', header: true },
    ],
  },
  {
    id: 'tax',
    title: 'Tax registration',
    description: 'GSTIN, CIN, and Udyam on header line 2; state drives CGST/SGST vs IGST.',
    fields: [
      { key: 'gstin', label: 'GSTIN', type: 'text', header: true },
      { key: 'cin', label: 'CIN', type: 'text', header: true },
      { key: 'udyam', label: 'Udyam Registration No.', type: 'text', header: true },
      { key: 'state', label: 'State', type: 'text' },
      { key: 'stateCode', label: 'State code', type: 'text' },
    ],
  },
  {
    id: 'bank',
    title: 'Bank details',
    description: 'Shown in the Bank Details block on commercial documents.',
    fields: [
      { key: 'accountHolder', label: 'Account Holder', type: 'text' },
      { key: 'bankName', label: 'Bank', type: 'text' },
      { key: 'accountNumber', label: 'A/C No', type: 'text' },
      { key: 'bankBranch', label: 'Branch', type: 'text' },
      { key: 'ifscCode', label: 'IFSC', type: 'text' },
    ],
  },
  {
    id: 'signature',
    title: 'Digital signature',
    description: 'Uploaded signature image shown in the Digital Signature block on documents.',
    fields: [
      { key: 'signatureDataUrl', label: 'Signature', type: 'signature' },
      { key: 'signatoryName', label: 'Signatory name', type: 'text' },
    ],
  },
];

/** Keys that feed the document letterhead (must stay in sync with companyLetterhead.js). */
export const ORG_LETTERHEAD_KEYS = [
  'legalName',
  'registeredOffice',
  'gstin',
  'cin',
  'udyam',
  'email',
  'website',
];

function cacheKeyForOrg(orgId) {
  const id = String(orgId || 'default').trim() || 'default';
  return `${CACHE_KEY_PREFIX}${id}`;
}

export function loadOrgMasterCache(orgId = 'default') {
  try {
    const raw =
      localStorage.getItem(cacheKeyForOrg(orgId)) ||
      (orgId === 'default' ? localStorage.getItem(CACHE_KEY) : null);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.logoDataUrl || parsed?.paymentQrDataUrl || parsed?.signatureDataUrl) {
      saveOrgMasterCache(parsed, orgId);
      return toCachePayload(parsed);
    }
    return parsed;
  } catch {
    try {
      localStorage.removeItem(cacheKeyForOrg(orgId));
    } catch {
      /* ignore */
    }
    return null;
  }
}

export function saveOrgMasterCache(data, orgId) {
  if (!data || typeof localStorage === 'undefined') return;
  const payload = toCachePayload(data);
  if (!payload) return;
  const id = String(orgId || data._id || data.id || 'default');
  try {
    localStorage.setItem(cacheKeyForOrg(id), JSON.stringify(payload));
    if (id === 'default' || data.isDefault) {
      localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
    }
  } catch (err) {
    try {
      localStorage.removeItem(cacheKeyForOrg(id));
    } catch {
      /* ignore */
    }
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('Org master cache skipped (storage quota):', err?.name || err);
    }
  }
}

export async function fetchCommercialOrgList() {
  const res = await api('/finance/org-profiles');
  const data = res.data || [];
  try {
    localStorage.setItem(LIST_CACHE_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
  return data;
}

export function loadOrgListCache() {
  try {
    const raw = localStorage.getItem(LIST_CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function fetchCommercialOrgMaster(orgId = 'default') {
  const id = String(orgId || 'default').trim() || 'default';
  const path = id === 'default' ? '/finance/org-profile' : `/finance/org-profiles/${encodeURIComponent(id)}`;
  const res = await api(path);
  const data = res.data || res;
  saveOrgMasterCache(data, data._id || id);
  return data;
}

export async function saveCommercialOrgMaster(payload, orgId = 'default') {
  const id = String(orgId || payload?._id || 'default').trim() || 'default';
  const path = id === 'default' ? '/finance/org-profile' : `/finance/org-profiles/${encodeURIComponent(id)}`;
  const res = await api(path, { method: 'PATCH', body: payload });
  const data = res.data || res;
  saveOrgMasterCache(data, data._id || id);
  return data;
}

export async function createCommercialOrgMaster(payload) {
  const res = await api('/finance/org-profiles', { method: 'POST', body: payload });
  const data = res.data || res;
  saveOrgMasterCache(data, data._id);
  return data;
}

/** Prefer frozen issuance snapshot when present. */
export function orgMasterFromDocument(doc, liveMaster) {
  if (doc?.orgSnapshot && typeof doc.orgSnapshot === 'object') {
    const stage = String(doc.status || '');
    if (stage === 'Issued' || stage === 'Approved' || stage === 'Cancelled') {
      return { ...doc.orgSnapshot, _id: doc.orgProfileId || doc.orgSnapshot.orgProfileId };
    }
  }
  return liveMaster;
}

/**
 * Read Identity / Bank / Tax fields from Organisation master only.
 * While master is still loading, keep the previous form value.
 * Never inject Tylo seed into documents.
 */
function orgVal(master, key, formFallback = '') {
  if (!master) return formFallback ?? '';
  const v = master[key];
  // Null/undefined/blank master values must not wipe a non-blank form value.
  if (v == null || (typeof v === 'string' && !v.trim())) {
    return formFallback ?? '';
  }
  return typeof v === 'string' ? v : String(v);
}

function companyFromOrg(master, formCompany = {}) {
  const address = orgVal(master, 'registeredOffice', formCompany?.address || formCompany?.registeredOffice);
  return {
    ...formCompany,
    logoDataUrl: orgVal(master, 'logoDataUrl', formCompany?.logoDataUrl),
    legalName: orgVal(master, 'legalName', formCompany?.legalName),
    brandLine: orgVal(master, 'brandLine', formCompany?.brandLine),
    address,
    registeredOffice: address,
    email: orgVal(master, 'email', formCompany?.email),
    website: orgVal(master, 'website', formCompany?.website),
    gstin: orgVal(master, 'gstin', formCompany?.gstin),
    cin: orgVal(master, 'cin', formCompany?.cin),
    udyam: orgVal(master, 'udyam', formCompany?.udyam),
    state: orgVal(master, 'state', formCompany?.state),
    stateCode: orgVal(master, 'stateCode', formCompany?.stateCode),
  };
}

function bankFromOrg(master, formBank = {}, branchKey = 'branchName') {
  return {
    ...formBank,
    accountHolder: orgVal(master, 'accountHolder', formBank?.accountHolder) || orgVal(master, 'legalName', ''),
    bankName: orgVal(master, 'bankName', formBank?.bankName),
    accountNumber: orgVal(master, 'accountNumber', formBank?.accountNumber),
    [branchKey]: orgVal(master, 'bankBranch', formBank?.[branchKey]),
    ifscCode: orgVal(master, 'ifscCode', formBank?.ifscCode),
  };
}

function signatureFromOrg(master, formSignature = {}, legalName = '') {
  // Preserve per-document Click-to-Sign timestamp; keep stamped name unless blank.
  if (formSignature?.mode === 'click_to_sign' && formSignature?.signedAt) {
    return {
      ...formSignature,
      imageDataUrl: '',
      signatoryName:
        formSignature.signatoryName
        || orgVal(master, 'signatoryName', ''),
      companyLabel: legalName || formSignature?.companyLabel || '',
    };
  }
  return {
    ...formSignature,
    imageDataUrl: orgVal(master, 'signatureDataUrl', formSignature?.imageDataUrl),
    signatoryName: orgVal(master, 'signatoryName', formSignature?.signatoryName),
    companyLabel: legalName || formSignature?.companyLabel || '',
  };
}

/** Apply org master onto invoice generator form (company, bank, signature). */
export function applyOrgMasterToInvoiceForm(form, master) {
  const company = companyFromOrg(master, form.company);
  return {
    ...form,
    company,
    bank: bankFromOrg(master, form.bank, 'branchName'),
    signature: signatureFromOrg(master, form.signature, company.legalName),
  };
}

/** Apply org master onto proforma generator form. */
export function applyOrgMasterToProformaForm(form, master) {
  const company = companyFromOrg(master, form.company);
  return {
    ...form,
    company: {
      ...company,
      registeredOffice: company.registeredOffice || company.address,
    },
    bank: bankFromOrg(master, form.bank, 'bankBranch'),
    signature: signatureFromOrg(master, form.signature, company.legalName),
  };
}

/** Apply org master onto purchase order — buyer/billing identity & tax always from org. */
export function applyOrgMasterToPurchaseOrderForm(form, master) {
  const company = companyFromOrg(master, form.company);
  const legal = company.legalName || '';
  const address = company.address || company.registeredOffice || '';
  const state = company.state || '';
  const stateCode = company.stateCode || '';
  const placeOfSupply = [state, stateCode ? `(${stateCode})` : null].filter(Boolean).join(' ');

  return {
    ...form,
    company,
    buyer: {
      ...form.buyer,
      companyName: legal,
      address,
      gstin: company.gstin || '',
      email: company.email || '',
      contactPerson: form.buyer?.contactPerson || '',
    },
    billing: {
      ...form.billing,
      address: [legal, address].filter(Boolean).join(', '),
      gstin: company.gstin || '',
      state,
      stateCode,
      placeOfSupply,
    },
    bank: bankFromOrg(master, form.bank, 'branchName'),
    signature: signatureFromOrg(master, form.signature, legal),
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
    website: master.website,
    gstin: master.gstin,
    cin: master.cin,
    state: master.state,
    stateCode: master.stateCode,
    udyam: master.udyam,
    signatureDataUrl: master.signatureDataUrl,
    signatoryName: master.signatoryName,
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
    name: '',
    legalName: '',
    brandLine: '',
    registeredOffice: '',
    email: '',
    website: '',
    accountHolder: '',
    bankName: '',
    accountNumber: '',
    bankBranch: '',
    ifscCode: '',
    logoDataUrl: '',
    signatureDataUrl: '',
    signatoryName: '',
    gstin: '',
    cin: '',
    udyam: '',
    state: '',
    stateCode: '',
  };
}

export function orgMasterToPayload(form) {
  return {
    name: form.name || form.legalName,
    legalName: form.legalName,
    brandLine: form.brandLine,
    registeredOffice: form.registeredOffice,
    email: form.email,
    website: form.website,
    accountHolder: form.accountHolder,
    bankName: form.bankName,
    accountNumber: form.accountNumber,
    bankBranch: form.bankBranch,
    ifscCode: form.ifscCode,
    logoDataUrl: form.logoDataUrl,
    signatureDataUrl: form.signatureDataUrl,
    signatoryName: form.signatoryName,
    gstin: form.gstin,
    cin: form.cin,
    udyam: form.udyam,
    state: form.state,
    stateCode: form.stateCode,
  };
}
