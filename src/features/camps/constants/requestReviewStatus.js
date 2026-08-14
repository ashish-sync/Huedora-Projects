export const REQUEST_REVIEW_STATUSES = [
  'review_pending',
  'review_overdue',
  'information_requested',
  'request_approved',
  'request_rejected',
];

export const REQUEST_REVIEW_LABELS = {
  review_pending: 'Review Pending',
  review_overdue: 'Review Overdue',
  information_requested: 'Info Requested',
  // Internal post-confirm code — not a Request Stage selectable status.
  request_approved: 'Review Pending',
  request_rejected: 'Refused',
};

/** Short descriptions for Request Stage filter / badges. */
export const REQUEST_REVIEW_DESCRIPTIONS = {
  review_pending: 'Default for requests created within the last 6 working hours',
  review_overdue: 'Still in Review Pending for more than 6 working hours',
  information_requested: 'Required camp details are incomplete',
  request_rejected: 'Request refused',
};

const WORK_START_HOUR = 9;
const WORK_END_HOUR = 19;
const SIX_WORKING_HOURS_MS = 6 * 60 * 60 * 1000;

function workWindowForDate(date) {
  const d = new Date(date);
  if (d.getDay() === 0) return null;
  const y = d.getFullYear();
  const m = d.getMonth();
  const day = d.getDate();
  return {
    start: new Date(y, m, day, WORK_START_HOUR, 0, 0, 0).getTime(),
    end: new Date(y, m, day, WORK_END_HOUR, 0, 0, 0).getTime(),
  };
}

export function elapsedWorkingMs(start, end = new Date()) {
  const t0 = new Date(start).getTime();
  const t1 = new Date(end).getTime();
  if (!Number.isFinite(t0) || !Number.isFinite(t1) || t1 <= t0) return 0;

  let total = 0;
  const cursor = new Date(t0);
  cursor.setHours(0, 0, 0, 0);

  while (cursor.getTime() < t1) {
    const window = workWindowForDate(cursor);
    if (window) {
      const segStart = Math.max(t0, window.start);
      const segEnd = Math.min(t1, window.end);
      if (segEnd > segStart) total += segEnd - segStart;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return total;
}

export function isReviewOverdue(submittedAt, now = new Date()) {
  if (!submittedAt) return false;
  return elapsedWorkingMs(submittedAt, now) >= SIX_WORKING_HOURS_MS;
}

/**
 * Client-side resolver mirrors server rules when API enrichment is unavailable.
 * Incomplete details win over the 6 working-hour clock.
 */
export function resolveRequestReviewStatus(camp = {}, now = new Date()) {
  if (camp.status === 'approved') return 'request_approved';
  if (camp.status === 'rejected') return 'request_rejected';
  if (camp.status === 'pending_review') {
    if (
      camp.requestIncomplete ||
      camp.requestReviewStatus === 'information_requested' ||
      (Array.isArray(camp.approvalBlockers) && camp.approvalBlockers.length > 0)
    ) {
      return 'information_requested';
    }
    if (isReviewOverdue(camp.submittedAt, now)) return 'review_overdue';
    return 'review_pending';
  }
  return camp.requestReviewStatus || '';
}
