/**
 * Canonical Camp One Stage → Status vocabulary (guide).
 * Confirmed / Assigned / Mark Complete are actions — not selectable statuses.
 * Payment Done is Finance One–controlled — never a Camp One manual select.
 */

export const REQUEST_WORKFLOW_STATUSES = [
  { value: 'review_pending', label: 'Review Pending' },
  { value: 'review_overdue', label: 'Review Overdue' },
  { value: 'request_rejected', label: 'Refused' },
  { value: 'information_requested', label: 'Info Requested' },
];

export const ASSIGNMENT_WORKFLOW_STATUSES = [
  { value: 'unassigned', label: 'Unassigned' },
  { value: 'hiring_requested', label: 'Hiring Requested' },
];

export const EXECUTION_WORKFLOW_STATUSES = [
  { value: 'planned', label: 'Planned' },
  { value: 'executed', label: 'Executed' },
  { value: 'cancelled_by_tylo', label: 'Cancelled by Tylo' },
  { value: 'cancelled_by_client', label: 'Cancelled by Client' },
];

export const FINANCIAL_WORKFLOW_STATUSES = [
  { value: 'payment_not_checked', label: 'Pending Confirmation' },
  { value: 'payment_confirmed', label: 'Confirmed Payment' },
  { value: 'payment_hold', label: 'Hold' },
  { value: 'payment_done', label: 'Payment Done' },
];

export const EXECUTION_CANCEL_LABELS = {
  'Cancelled by Tylo': 'Cancelled by Tylo',
  'Cancelled by TCPL': 'Cancelled by Tylo',
  'Cancelled by Client': 'Cancelled by Client',
};

export function financialWorkflowStatus(camp = {}) {
  if (String(camp.financePaymentStatus || '').trim() === 'paid') {
    return { value: 'payment_done', label: 'Payment Done' };
  }
  const submit = String(camp.paymentSubmitStatus || '').trim();
  if (submit === 'payment_hold') return { value: 'payment_hold', label: 'Hold' };
  if (submit === 'payment_confirmed') {
    return { value: 'payment_confirmed', label: 'Confirmed Payment' };
  }
  return { value: 'payment_not_checked', label: 'Pending Confirmation' };
}

export function financialWorkflowStatusLabel(campOrSubmit, financePaymentStatus) {
  if (campOrSubmit && typeof campOrSubmit === 'object') {
    return financialWorkflowStatus(campOrSubmit).label;
  }
  return financialWorkflowStatus({
    paymentSubmitStatus: campOrSubmit,
    financePaymentStatus,
  }).label;
}
