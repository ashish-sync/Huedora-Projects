/** Pre-GST (subtotal) minus 10% → Net Receivable. ₹100 → ₹90. */
export function netReceivableFromPreGst(subtotal) {
  const preGst = Number(subtotal);
  if (!Number.isFinite(preGst) || preGst <= 0) return null;
  return Math.round(preGst * 0.9 * 100) / 100;
}

/** Calendar days from approvedAt (or issuedAt) to `now`. */
export function daysSinceDocumentApproved(row, now = new Date()) {
  const raw = row?.approvedAt || row?.issuedAt;
  if (!raw) return null;
  const start = new Date(raw);
  if (Number.isNaN(start.getTime())) return null;
  const end = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(end.getTime())) return null;
  const a = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const b = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  return Math.floor((b - a) / 86400000);
}

/** Display labels for Stage (DB keeps Draft / Issued / …). */
const STAGE_DISPLAY = {
  Draft: 'Drafting',
  Uploaded: 'Drafting',
  Submitted: 'Submitted',
  Approved: 'Issued',
  Issued: 'Issued',
  Cancelled: 'Cancelled',
};

export const COMMERCIAL_STAGE_FILTERS = [
  { value: 'Drafting', label: 'Drafting' },
  { value: 'Submitted', label: 'Submitted' },
  { value: 'Issued', label: 'Issued' },
  { value: 'Cancelled', label: 'Cancelled' },
];

/** Canonical DB stage: Draft | Submitted | Issued | Cancelled. */
export function normalizeCommercialStage(status) {
  const raw = String(status || '').trim();
  if (!raw || raw === 'Uploaded') return 'Draft';
  if (raw === 'Approved') return 'Issued';
  if (raw === 'Drafting') return 'Draft';
  return raw;
}

/** UI Stage label — Draft/Uploaded → Drafting; Approved → Issued. */
export function displayCommercialStage(status) {
  const raw = String(status || '').trim() || 'Draft';
  return STAGE_DISPLAY[raw] || raw;
}

export function isIssuedStage(status) {
  return ['Issued', 'Approved'].includes(String(status || '').trim());
}

export function isDraftingStage(status) {
  const raw = String(status || '').trim();
  return !raw || raw === 'Draft' || raw === 'Uploaded';
}

/**
 * Document-specific Status (stored in paymentStatus; independent of Stage).
 * mode: auto_invoice | auto_debit | manual
 */
export const COMMERCIAL_STATUS_BY_TYPE = {
  client_invoice: {
    mode: 'auto_invoice',
    options: ['Unpaid under 30D', 'Unpaid over 30D', 'Partially Paid', 'Paid'],
  },
  bill_of_supply: {
    mode: 'auto_invoice',
    options: ['Unpaid under 30D', 'Unpaid over 30D', 'Partially Paid', 'Paid'],
  },
  debit_note: {
    mode: 'auto_debit',
    default: 'Pending Collection',
    options: ['Pending Collection', 'Partially Paid', 'Paid'],
  },
  credit_note: {
    mode: 'manual',
    default: 'Pending Adjustment',
    options: ['Pending Adjustment', 'Partially Adjusted', 'Adjusted', 'Refunded'],
  },
  delivery_challan: {
    mode: 'manual',
    default: 'Ready for Dispatch',
    options: ['Ready for Dispatch', 'Dispatched', 'Delivered', 'Returned'],
  },
  proforma: {
    mode: 'manual',
    default: 'Sent',
    options: ['Sent', 'Accepted', 'Converted', 'Expired'],
  },
  purchase_order: {
    mode: 'manual',
    default: 'Open',
    options: ['Open', 'Partially Fulfilled', 'Fulfilled', 'Closed'],
  },
  quotation: {
    mode: 'manual',
    default: 'Sent',
    options: ['Sent', 'Under Review', 'Accepted', 'Rejected', 'Expired', 'Converted'],
  },
};

export function isManualLifecycleStatusType(documentType) {
  return COMMERCIAL_STATUS_BY_TYPE[documentType]?.mode === 'manual';
}

export function isAutoPaymentStatusType(documentType) {
  const mode = COMMERCIAL_STATUS_BY_TYPE[documentType]?.mode;
  return mode === 'auto_invoice' || mode === 'auto_debit';
}

export function defaultLifecycleStatus(documentType) {
  return COMMERCIAL_STATUS_BY_TYPE[documentType]?.default || '';
}

export function commercialStatusFilterOptions(documentType = '') {
  if (documentType && COMMERCIAL_STATUS_BY_TYPE[documentType]) {
    return [...COMMERCIAL_STATUS_BY_TYPE[documentType].options];
  }
  const set = new Set();
  for (const cfg of Object.values(COMMERCIAL_STATUS_BY_TYPE)) {
    for (const opt of cfg.options) set.add(opt);
  }
  return [...set];
}

/** @deprecated Use commercialStatusFilterOptions() */
export const COMMERCIAL_PAYMENT_STATUS_FILTERS = commercialStatusFilterOptions();

/**
 * Ageing Status for Tax Invoice / Bill of Supply while unpaid.
 * ≤30 days → Unpaid under 30D · >30 → Unpaid over 30D
 */
export function paymentStatusFromAgeingDays(days) {
  if (days == null || !Number.isFinite(days) || days < 0) return 'Unpaid under 30D';
  if (days <= 30) return 'Unpaid under 30D';
  return 'Unpaid over 30D';
}

/** Normalize legacy + current stored payment/lifecycle Status values. */
export function normalizeStoredPaymentStatus(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw || raw === 'unpaid') return 'Unpaid';
  if (raw === 'fully paid' || raw === 'paid' || raw === 'fully_paid') return 'Paid';
  if (raw === 'partially paid' || raw === 'partially_paid' || raw === 'partial') {
    return 'Partially Paid';
  }
  // Legacy ageing labels → 30D buckets
  if (
    raw === 'invoice sent' ||
    raw === 'invoice due' ||
    raw === 'unpaid under 30d' ||
    raw === 'unpaid under 30 d'
  ) {
    return 'Unpaid under 30D';
  }
  if (
    raw === 'invoice overdue' ||
    raw === 'msme breach' ||
    raw === 'unpaid over 30d' ||
    raw === 'unpaid over 30 d'
  ) {
    return 'Unpaid over 30D';
  }
  return String(value || '').trim() || 'Unpaid';
}

function shouldShowLifecycleStatus(row) {
  const stage = normalizeCommercialStage(row?.status);
  return stage === 'Issued' || stage === 'Cancelled';
}

/**
 * Billing Center Status column — document-type specific.
 * Empty before Issued. Paid / Partially Paid win for payment docs; otherwise ageing or stored manual.
 */
export function resolveCommercialDisplayStatus(row, now = new Date()) {
  if (!shouldShowLifecycleStatus(row)) return '';
  const type = row?.documentType;
  const cfg = COMMERCIAL_STATUS_BY_TYPE[type];
  if (!cfg) return '';

  const storedRaw = String(row?.paymentStatus || '').trim();
  const storedNorm = normalizeStoredPaymentStatus(storedRaw);

  if (cfg.mode === 'auto_invoice') {
    if (storedNorm === 'Paid') return 'Paid';
    if (storedNorm === 'Partially Paid') return 'Partially Paid';
    if (normalizeCommercialStage(row?.status) === 'Cancelled' && !row?.issuedAt && !row?.approvedAt) {
      return '';
    }
    const days = daysSinceDocumentApproved(row, now);
    return paymentStatusFromAgeingDays(days == null ? 0 : days);
  }

  if (cfg.mode === 'auto_debit') {
    if (storedNorm === 'Paid') return 'Paid';
    if (storedNorm === 'Partially Paid') return 'Partially Paid';
    return 'Pending Collection';
  }

  // manual
  if (storedRaw && cfg.options.includes(storedRaw)) return storedRaw;
  if (storedNorm !== 'Unpaid' && cfg.options.includes(storedNorm)) return storedNorm;
  return cfg.default || '';
}

/** @deprecated Prefer resolveCommercialDisplayStatus */
export function resolveCommercialPaymentDisplayStatus(row, now = new Date()) {
  return resolveCommercialDisplayStatus(row, now);
}

function slugStatusClass(label) {
  return String(label || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** CSS modifier for Status pills. */
export function paymentStatusPillClass(displayStatus) {
  const slug = slugStatusClass(displayStatus);
  if (!slug) return 'status-pill status-pill-muted finance-pay-status';
  return `status-pill finance-pay-status finance-pay-status--${slug}`;
}

/** @deprecated Alias */
export function lifecycleStatusPillClass(displayStatus) {
  return paymentStatusPillClass(displayStatus);
}
