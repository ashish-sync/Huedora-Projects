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

/**
 * Ageing-based Status while unpaid after approval.
 * 0–10 Invoice Sent · 11–30 Invoice Due · 31–45 Invoice Overdue · 46+ MSME Breach
 */
export function paymentStatusFromAgeingDays(days) {
  if (days == null || !Number.isFinite(days) || days < 0) return 'Invoice Sent';
  if (days <= 10) return 'Invoice Sent';
  if (days <= 30) return 'Invoice Due';
  if (days <= 45) return 'Invoice Overdue';
  return 'MSME Breach';
}

/** Normalize legacy + current stored paymentStatus values. */
export function normalizeStoredPaymentStatus(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw || raw === 'unpaid') return 'Unpaid';
  if (raw === 'fully paid' || raw === 'paid' || raw === 'fully_paid') return 'Paid';
  if (raw === 'partially paid' || raw === 'partially_paid' || raw === 'partial') {
    return 'Partially Paid';
  }
  return String(value || '').trim() || 'Unpaid';
}

/**
 * Billing Center Status column (payment / ageing). Empty before Stage Issued/Approved.
 * Paid / Partially Paid always win; otherwise Status follows approval ageing.
 */
export function resolveCommercialPaymentDisplayStatus(row, now = new Date()) {
  if (!['Issued', 'Approved'].includes(row?.status)) return '';
  const stored = normalizeStoredPaymentStatus(row?.paymentStatus);
  if (stored === 'Paid') return 'Paid';
  if (stored === 'Partially Paid') return 'Partially Paid';
  const days = daysSinceDocumentApproved(row, now);
  return paymentStatusFromAgeingDays(days == null ? 0 : days);
}

/** Billing Center Status filter options (payment / ageing). */
export const COMMERCIAL_PAYMENT_STATUS_FILTERS = [
  'Invoice Sent',
  'Invoice Due',
  'Invoice Overdue',
  'MSME Breach',
  'Partially Paid',
  'Paid',
];

/** CSS modifier for Status (payment) pills. */
export function paymentStatusPillClass(displayStatus) {
  switch (displayStatus) {
    case 'Paid':
      return 'status-pill finance-pay-status finance-pay-status--paid';
    case 'Partially Paid':
      return 'status-pill finance-pay-status finance-pay-status--partially-paid';
    case 'Invoice Sent':
      return 'status-pill finance-pay-status finance-pay-status--invoice-sent';
    case 'Invoice Due':
      return 'status-pill finance-pay-status finance-pay-status--invoice-due';
    case 'Invoice Overdue':
      return 'status-pill finance-pay-status finance-pay-status--invoice-overdue';
    case 'MSME Breach':
      return 'status-pill finance-pay-status finance-pay-status--msme-breach';
    default:
      return 'status-pill status-pill-muted finance-pay-status';
  }
}
