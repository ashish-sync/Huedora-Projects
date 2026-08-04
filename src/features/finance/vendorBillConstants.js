export const VENDOR_BILL_STATUSES = [
  'draft',
  'submitted',
  'under_verification',
  'verified',
  'approved',
  'rejected',
  'partially_paid',
  'paid',
  'cancelled',
];

export const VENDOR_BILL_STATUS_LABELS = {
  draft: 'Draft',
  submitted: 'Submitted',
  under_verification: 'Under verification',
  verified: 'Verified',
  approved: 'Approved',
  rejected: 'Rejected',
  partially_paid: 'Partially paid',
  paid: 'Paid',
  cancelled: 'Cancelled',
};

export function normalizeVendorBillStatus(raw) {
  const value = String(raw || '').trim();
  const lower = value.toLowerCase().replace(/\s+/g, '_');
  if (VENDOR_BILL_STATUSES.includes(lower)) return lower;
  if (value === 'Open') return 'approved';
  if (value === 'Partially paid') return 'partially_paid';
  if (value === 'Paid') return 'paid';
  if (value === 'Cancelled') return 'cancelled';
  if (value === 'Draft') return 'draft';
  return 'draft';
}

export function vendorBillStatusLabel(status) {
  return VENDOR_BILL_STATUS_LABELS[normalizeVendorBillStatus(status)] || status || '—';
}

export const VENDOR_BILL_EDITABLE_STATUSES = new Set(['draft', 'rejected']);
export const VENDOR_BILL_PAYABLE_STATUSES = new Set(['approved', 'partially_paid']);

export function formatVendorBillMoney(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return '—';
  return num.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}
