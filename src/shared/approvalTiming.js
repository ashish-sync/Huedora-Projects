/** Elapsed milliseconds between two instants, skipping any time that falls on Sunday. */
export function elapsedMsExcludingSunday(start, end = new Date()) {
  const t0 = new Date(start).getTime();
  const t1 = new Date(end).getTime();
  if (!Number.isFinite(t0) || !Number.isFinite(t1) || t1 <= t0) return 0;

  let total = 0;
  let cur = t0;
  while (cur < t1) {
    const d = new Date(cur);
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;
    const segEnd = Math.min(t1, dayEnd);
    if (d.getDay() !== 0) total += segEnd - cur;
    cur = dayEnd;
  }
  return total;
}

const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;

/**
 * Approval tasks are overdue after 48 hours of elapsed time,
 * not counting Sunday hours in between.
 */
export function isApprovalOverdue(startedAt, now = new Date()) {
  if (!startedAt) return false;
  return elapsedMsExcludingSunday(startedAt, now) >= FORTY_EIGHT_HOURS_MS;
}

export function approvalOverdueLabel(startedAt, now = new Date()) {
  if (!isApprovalOverdue(startedAt, now)) return '';
  return 'Overdue';
}
