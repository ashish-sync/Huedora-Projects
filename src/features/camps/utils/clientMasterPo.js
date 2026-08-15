/** Shared PO / Camp Terms helpers for Client Master (form + list). */

export const CAMP_TERMS = {
  PO_BASED: 'po_based',
  AGREEMENT_BASED: 'agreement_based',
  APPROVAL_BASED: 'approval_based',
  NONE: 'none',
};

export const CAMP_TERMS_OPTIONS = [
  { value: CAMP_TERMS.PO_BASED, label: 'PO Based' },
  { value: CAMP_TERMS.AGREEMENT_BASED, label: 'Agreement Based' },
  { value: CAMP_TERMS.APPROVAL_BASED, label: 'Approval Based' },
  { value: CAMP_TERMS.NONE, label: 'None' },
];

export const PO_GST_RATE = 0.18;

const CAMP_TERMS_FILE_MAX_BYTES = 10 * 1024 * 1024;
const CAMP_TERMS_FILE_EXT = /\.(pdf|png|jpe?g|webp|docx?|xlsx?)$/i;

export function emptyCampTermsFormFields() {
  return {
    campTerms: CAMP_TERMS.NONE,
    purchaseOrders: [],
    campTermsFiles: [],
    poNumber: '',
    poNetValue: '',
    poApplyGst18: true,
    poGstAmount: 0,
    poGrossValue: 0,
    poIssueDate: '',
    poExpiryDate: '',
    poCombinedNet: 0,
    poCombinedGst: 0,
    poCombinedGross: 0,
    agreementStartDate: '',
    agreementEffectiveDate: '',
    agreementEndDate: '',
  };
}

/** @deprecated alias — use computePoTaxFields */
export function computePoGst(netValue, applyGst18) {
  return computePoTaxFields(netValue, applyGst18);
}

export function formatPoMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '₹0';
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export function sanitizePoNetInput(raw) {
  const cleaned = String(raw ?? '')
    .replace(/[^\d.]/g, '')
    .replace(/(\..*)\./g, '$1');
  const [whole, fraction] = cleaned.split('.');
  if (fraction == null) return whole;
  return `${whole}.${fraction.slice(0, 2)}`;
}

export function validateCampTermsFile(file) {
  if (!file) return 'File is required';
  if (file.size > CAMP_TERMS_FILE_MAX_BYTES) return 'Each file must be 10 MB or smaller';
  const name = String(file.name || '').toLowerCase();
  const mime = String(file.type || '').toLowerCase();
  const ok =
    mime === 'application/pdf'
    || mime.startsWith('image/')
    || mime.includes('word')
    || mime.includes('sheet')
    || mime.includes('excel')
    || CAMP_TERMS_FILE_EXT.test(name);
  if (!ok) return 'Allowed types: PDF, images, Word, Excel';
  return '';
}

export function newPurchaseOrderId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `po-${crypto.randomUUID()}`;
  }
  return `po-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function parsePoNetValue(raw) {
  if (raw === '' || raw == null) return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : Number.NaN;
}

function roundPoMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

/**
 * When Tax 18% is on, `enteredAmount` is GST-inclusive.
 * Example: 5500 → Net 4661.02, GST 838.98, Gross 5500.
 * When Tax is off, entered amount is net (no GST).
 */
export function computePoTaxFields(enteredAmount, applyGst18) {
  const entered = Number.isFinite(Number(enteredAmount)) ? Math.max(0, Number(enteredAmount)) : 0;
  const apply = Boolean(applyGst18);
  if (!apply) {
    const net = roundPoMoney(entered);
    return {
      poNetValue: net,
      poApplyGst18: false,
      poGstAmount: 0,
      poGrossValue: net,
    };
  }
  const gross = roundPoMoney(entered);
  const net = roundPoMoney(gross / (1 + PO_GST_RATE));
  const gst = roundPoMoney(gross - net);
  return {
    poNetValue: net,
    poApplyGst18: true,
    poGstAmount: gst,
    poGrossValue: gross,
  };
}

/** Amount shown in the PO amount input (inclusive when GST on). */
export function poAmountInputValue(row) {
  if (!row) return '';
  const apply = row.poApplyGst18 !== false;
  if (!apply) {
    return row.poNetValue === '' || row.poNetValue == null ? '' : row.poNetValue;
  }
  if (row.poGrossValue === '' || row.poGrossValue == null) {
    return row.poNetValue === '' || row.poNetValue == null ? '' : row.poNetValue;
  }
  return row.poGrossValue;
}

/** Resolve the inclusive/entered amount when loading a stored PO row. */
export function resolvePoEnteredAmount(row, applyGst18) {
  const apply = applyGst18 !== false;
  if (!apply) {
    return row?.poNetValue === '' || row?.poNetValue == null ? '' : Number(row.poNetValue) || 0;
  }
  const gross = Number(row?.poGrossValue);
  const net = Number(row?.poNetValue);
  const gst = Number(row?.poGstAmount);
  if (Number.isFinite(gross) && gross > 0) {
    if (!Number.isFinite(net) || net <= 0) return gross;
    if (!Number.isFinite(gst) || gst <= 0) return gross;
    // Prefer stored gross when it matches net+gst (inclusive model).
    if (Math.abs(gross - roundPoMoney(net + gst)) <= 0.02) return gross;
    // Legacy exclusive model stored gross === net; rebuild inclusive from net+gst.
    if (Math.abs(gross - net) <= 0.02 && gst > 0) return roundPoMoney(net + gst);
    return gross;
  }
  if (Number.isFinite(net) && Number.isFinite(gst) && gst > 0) return roundPoMoney(net + gst);
  return Number.isFinite(net) ? net : 0;
}

export function createEmptyPurchaseOrder(overrides = {}) {
  return {
    id: newPurchaseOrderId(),
    poNumber: '',
    poNetValue: '',
    poApplyGst18: true,
    poGstAmount: 0,
    poGrossValue: '',
    poIssueDate: '',
    poExpiryDate: '',
    files: [],
    poFile: null,
    ...overrides,
  };
}

export function normalizeCampTerms(value) {
  const raw = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (raw === 'po' || raw === 'po_based' || raw === 'pobased') return CAMP_TERMS.PO_BASED;
  if (raw === 'agreement' || raw === 'agreement_based' || raw === 'agreementbased') {
    return CAMP_TERMS.AGREEMENT_BASED;
  }
  if (raw === 'approval' || raw === 'approval_based' || raw === 'approvalbased') {
    return CAMP_TERMS.APPROVAL_BASED;
  }
  if (raw === 'none' || raw === 'n_a' || raw === 'na') return CAMP_TERMS.NONE;
  return CAMP_TERMS.NONE;
}

export function campTermsLabel(value) {
  const normalized = normalizeCampTerms(value);
  return CAMP_TERMS_OPTIONS.find((opt) => opt.value === normalized)?.label || 'None';
}

function normalizeStoredFile(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const storedName = String(raw.storedName || raw.id || '').trim();
  const fileName = String(raw.fileName || raw.originalName || '').trim();
  if (!storedName && !fileName) return null;
  return {
    id: String(raw.id || storedName || ''),
    storedName: storedName || String(raw.id || ''),
    fileName: fileName || storedName || 'file',
    mimeType: String(raw.mimeType || ''),
    size: Number(raw.size) || Number(raw.fileSize) || 0,
    url: String(raw.url || ''),
    uploadedAt: raw.uploadedAt || null,
  };
}

export function campTermsFilesFromRecord(row) {
  // Dedicated Agreement/Approval attachments only — never fall back to PO uploads.
  const list = Array.isArray(row?.campTermsFiles) ? row.campTermsFiles : [];
  return list.map(normalizeStoredFile).filter(Boolean);
}

function filesFromPoRow(row) {
  const list = Array.isArray(row?.files) ? row.files : [];
  const fromList = list.map(normalizeStoredFile).filter(Boolean);
  if (fromList.length) return fromList;
  const legacy = normalizeStoredFile(row?.poFile);
  return legacy ? [legacy] : [];
}

function normalizePurchaseOrderRow(row, index = 0) {
  if (!row || typeof row !== 'object') return null;
  const apply = row.poApplyGst18 !== false;
  const entered = resolvePoEnteredAmount(row, apply);
  const tax = computePoTaxFields(entered === '' ? 0 : entered, apply);
  const files = filesFromPoRow(row);
  const emptyInput =
    (apply
      ? row.poGrossValue === '' || row.poGrossValue == null
      : row.poNetValue === '' || row.poNetValue == null)
    && !(Number(row.poNetValue) > 0 || Number(row.poGrossValue) > 0);
  return {
    id: String(row.id || `po-${index + 1}`),
    poNumber: String(row.poNumber || '').trim(),
    ...tax,
    poNetValue: emptyInput ? '' : tax.poNetValue,
    poGrossValue: emptyInput ? '' : tax.poGrossValue,
    poIssueDate: String(row.poIssueDate || '').trim().slice(0, 10),
    poExpiryDate: String(row.poExpiryDate || '').trim().slice(0, 10),
    files,
    poFile: files[0] || null,
  };
}

/**
 * Load all PO rows from a client master record (never collapses to one).
 */
export function purchaseOrdersFromRecord(row) {
  if (!row) return [];
  if (Array.isArray(row.purchaseOrders) && row.purchaseOrders.length > 0) {
    return row.purchaseOrders.map((item, i) => normalizePurchaseOrderRow(item, i)).filter(Boolean);
  }
  const terms = normalizeCampTerms(row.campTerms);
  const hasLegacy =
    String(row.poNumber || '').trim() ||
    Number(row.poNetValue) > 0 ||
    row.poFile ||
    String(row.poIssueDate || '').trim() ||
    String(row.poExpiryDate || '').trim() ||
    // Only treat shared campTermsFiles as legacy PO uploads when terms is PO Based.
    (terms === CAMP_TERMS.PO_BASED
      && Array.isArray(row.campTermsFiles)
      && row.campTermsFiles.length > 0);
  if (!hasLegacy) return [];
  const files = terms === CAMP_TERMS.PO_BASED
    ? campTermsFilesFromRecord(row)
    : (normalizeStoredFile(row?.poFile) ? [normalizeStoredFile(row.poFile)] : []);
  return [
    normalizePurchaseOrderRow(
      {
        id: 'po-legacy',
        poNumber: row.poNumber,
        poNetValue: row.poNetValue,
        poApplyGst18: row.poApplyGst18,
        poIssueDate: row.poIssueDate,
        poExpiryDate: row.poExpiryDate,
        files,
        poFile: files[0] || row.poFile,
      },
      0
    ),
  ];
}

export function combinePurchaseOrders(orders) {
  const list = Array.isArray(orders) ? orders : [];
  let net = 0;
  let gst = 0;
  let gross = 0;
  list.forEach((row) => {
    const apply = row.poApplyGst18 !== false;
    const entered = poAmountInputValue(row);
    const tax = computePoTaxFields(entered === '' || entered == null ? 0 : entered, apply);
    net += tax.poNetValue;
    gst += tax.poGstAmount;
    gross += tax.poGrossValue;
  });
  const round2 = (n) => Math.round(n * 100) / 100;
  return {
    poCombinedNet: round2(net),
    poCombinedGst: round2(gst),
    poCombinedGross: round2(gross),
    poCount: list.length,
  };
}

export function campTermsFieldsFromRecord(row) {
  const campTerms = normalizeCampTerms(row?.campTerms);
  // Always hydrate both PO and Agreement details so switching terms never loses them.
  const purchaseOrders = purchaseOrdersFromRecord(row);

  if (campTerms === CAMP_TERMS.PO_BASED && purchaseOrders.length === 0) {
    purchaseOrders.push(createEmptyPurchaseOrder());
  }

  const primary = purchaseOrders[0] || null;
  const combined = combinePurchaseOrders(purchaseOrders);
  // Agreement files are dedicated campTermsFiles only — never PO row uploads.
  const agreementFiles = campTermsFilesFromRecord(row);

  return {
    campTerms,
    purchaseOrders,
    campTermsFiles: agreementFiles,
    poNumber: primary?.poNumber || '',
    poNetValue: primary?.poNetValue ?? '',
    poApplyGst18: primary ? primary.poApplyGst18 !== false : true,
    poGstAmount: primary?.poGstAmount ?? 0,
    poGrossValue: primary?.poGrossValue ?? 0,
    poIssueDate: primary?.poIssueDate || '',
    poExpiryDate: primary?.poExpiryDate || '',
    agreementStartDate: String(row?.agreementStartDate || '').trim().slice(0, 10),
    agreementEffectiveDate: String(row?.agreementEffectiveDate || '').trim().slice(0, 10),
    agreementEndDate: String(row?.agreementEndDate || '').trim().slice(0, 10),
    ...combined,
  };
}

/**
 * After a PO file upload/delete, merge server files into the matching local row.
 * Preserves unsaved PO No. / Value / dates that the upload response would otherwise wipe.
 */
export function mergePoFilesFromServerRecord(prevOrders, poId, serverRow) {
  const localOrders = Array.isArray(prevOrders) ? prevOrders : [];
  const serverOrders = purchaseOrdersFromRecord(serverRow);
  const serverPo =
    serverOrders.find((row) => String(row.id) === String(poId))
    || (serverOrders.length === 1 ? serverOrders[0] : null);
  const serverFiles = serverPo ? filesFromPoRow(serverPo) : [];

  let matched = false;
  const nextOrders = localOrders.map((row) => {
    if (String(row.id) !== String(poId)) return row;
    matched = true;
    return {
      ...row,
      id: serverPo?.id || row.id,
      files: serverFiles,
      poFile: serverFiles[0] || null,
    };
  });

  if (!matched && serverPo) {
    nextOrders.push({
      ...createEmptyPurchaseOrder({ id: String(poId) }),
      ...serverPo,
      files: serverFiles,
      poFile: serverFiles[0] || null,
    });
  }

  return nextOrders.length ? nextOrders : [createEmptyPurchaseOrder({ id: poId })];
}

function serializePoForApi(row) {
  const apply = row.poApplyGst18 !== false;
  const entered = poAmountInputValue(row);
  const tax = computePoTaxFields(entered === '' || entered == null ? 0 : entered, apply);
  const files = (Array.isArray(row.files) ? row.files : [])
    .map(normalizeStoredFile)
    .filter(Boolean);
  return {
    id: String(row.id || newPurchaseOrderId()),
    poNumber: String(row.poNumber || '').trim().slice(0, 80),
    ...tax,
    poIssueDate: String(row.poIssueDate || '').trim().slice(0, 10),
    poExpiryDate: String(row.poExpiryDate || '').trim().slice(0, 10),
    files,
    poFile: files[0] || null,
  };
}

/**
 * Build API payload for Camp Terms.
 * Always includes Agreement dates from the form so switching the active terms
 * type never wipes them. Meaningful PO rows are included when present; empty
 * placeholder rows are omitted so the server can preserve existing POs.
 */
export function buildCampTermsPayload(form) {
  const campTerms = normalizeCampTerms(form.campTerms);
  const sharedFiles = Array.isArray(form.campTermsFiles) ? form.campTermsFiles : [];
  const purchaseOrders = (Array.isArray(form.purchaseOrders) ? form.purchaseOrders : [])
    .map(serializePoForApi)
    .filter(
      (row) =>
        row.poNumber
        || row.poNetValue > 0
        || (row.files && row.files.length)
        || row.poIssueDate
        || row.poExpiryDate
    );

  const agreementStartDate = String(form.agreementStartDate || '').trim().slice(0, 10);
  const agreementEffectiveDate = String(form.agreementEffectiveDate || '').trim().slice(0, 10);
  const agreementEndDate = String(form.agreementEndDate || '').trim().slice(0, 10);

  const payload = {
    campTerms,
    // Dedicated agreement/approval attachments (server preserves when empty).
    campTermsFiles: sharedFiles,
    agreementStartDate,
    agreementEffectiveDate,
    agreementEndDate,
  };

  if (purchaseOrders.length) {
    const combined = combinePurchaseOrders(purchaseOrders);
    const primary = purchaseOrders[0];
    Object.assign(payload, {
      purchaseOrders,
      poNumber: primary?.poNumber || '',
      poNetValue: primary?.poNetValue ?? 0,
      poApplyGst18: primary ? primary.poApplyGst18 !== false : false,
      poGstAmount: primary?.poGstAmount ?? 0,
      poGrossValue: primary?.poGrossValue ?? 0,
      poIssueDate: primary?.poIssueDate || '',
      poExpiryDate: primary?.poExpiryDate || '',
      poFile: primary?.poFile || null,
      ...combined,
    });
  }
  // Omit empty purchaseOrders so agreement-only saves never wipe stored POs.

  return payload;
}

/** @deprecated Use campTermsLabel / campTermsFieldsFromRecord */
export function formatPoMasterSummary(row) {
  const terms = normalizeCampTerms(row?.campTerms);
  if (terms === CAMP_TERMS.PO_BASED) {
    const orders = purchaseOrdersFromRecord(row);
    const combined = combinePurchaseOrders(orders);
    if (!orders.length) return 'PO Based';
    if (orders.length === 1) {
      const po = orders[0];
      const num = po.poNumber || '—';
      const entered = poAmountInputValue(po);
      const tax = computePoTaxFields(entered === '' || entered == null ? 0 : entered, po.poApplyGst18 !== false);
      if (tax.poGstAmount > 0) {
        return `PO ${num} · Net ₹${Number(tax.poNetValue || 0).toLocaleString('en-IN')} · GST ₹${Number(tax.poGstAmount).toLocaleString('en-IN')}`;
      }
      return `PO ${num} · ₹${Number(tax.poNetValue || 0).toLocaleString('en-IN')}`;
    }
    return `${orders.length} POs · Net ₹${Number(combined.poCombinedNet || 0).toLocaleString('en-IN')}`;
  }
  return campTermsLabel(terms);
}
