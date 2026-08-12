import { computeEndTime } from './campSchedule.js';
import { formatCampTimeLabel } from './hcwSameDayCamps.js';
import { isActiveHcwAssignedCamp } from './campHcwAssignmentActive.js';

export { isActiveHcwAssignedCamp } from './campHcwAssignmentActive.js';

export const HCW_ASSIGNMENT_GAP_MINUTES = 30;

export const HCW_GAP_APPROVAL_MESSAGE =
  'This assignment requires approval from your Reporting Manager.';

function trimStr(value) {
  return value == null ? '' : String(value).trim();
}

function parseTimeToMinutes(timeStr) {
  if (!timeStr) return null;
  const parts = String(timeStr).trim().split(':');
  const hours = Number(parts[0]);
  const minutes = Number(parts[1] || 0);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

function formatMinutes(totalMinutes) {
  const normalized = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function parseLocalDateInput(value) {
  const text = trimStr(value);
  if (!text) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(text);
  if (!dmy) return text.slice(0, 10) || null;
  let year = Number(dmy[3]);
  if (year < 100) year += 2000;
  return `${year}-${String(Number(dmy[2])).padStart(2, '0')}-${String(Number(dmy[1])).padStart(2, '0')}`;
}

function scheduleBounds(camp = {}) {
  const startTime = trimStr(camp.startTime) || '09:00';
  const endTime = trimStr(camp.endTime) || computeEndTime(startTime, camp.durationHours || 3);
  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);
  if (startMinutes == null || endMinutes == null) return null;
  const overnight = endMinutes <= startMinutes;
  return {
    startMinutes,
    endMinutes: overnight ? endMinutes + 24 * 60 : endMinutes,
    startTime,
    endTime,
    overnight,
  };
}

function formatTimeRange(bounds) {
  const startLabel = formatCampTimeLabel(bounds.startTime);
  const endLabel = formatCampTimeLabel(bounds.endTime);
  if (bounds.overnight) return `${startLabel} – ${endLabel} (next day)`;
  return `${startLabel} – ${endLabel}`;
}

function formatGapDurationLabel(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours && mins) return `${hours}h ${mins}m`;
  if (hours) return `${hours}h`;
  return `${mins}m`;
}

function buildHcwAssignmentGapMessage({
  endsAtLabel,
  earliestStartLabel,
  gapMinutes,
  isCandidate,
}) {
  const gapLabel = formatGapDurationLabel(gapMinutes);
  if (isCandidate) {
    return `HCW Schedule Conflict: This camp is scheduled until ${endsAtLabel}. A ${gapLabel} gap is recommended before the next camp for this HCW, so the earliest available start time for that camp is ${earliestStartLabel}.`;
  }
  return `HCW Schedule Conflict: This HCW has another camp scheduled until ${endsAtLabel}. A ${gapLabel} gap is recommended, so the earliest available start time is ${earliestStartLabel}.`;
}

/**
 * Structured gap conflict for UI, or null when OK.
 * Soft warning: assignment may proceed with Reporting Manager approval.
 */
export function findHcwAssignmentGapConflict(candidate = {}, others = []) {
  if (!isActiveHcwAssignedCamp(candidate)) return null;

  const candidateDate = parseLocalDateInput(candidate.campDate);
  if (!candidateDate) return null;

  const candidateBounds = scheduleBounds(candidate);
  if (!candidateBounds) return null;

  const peers = (Array.isArray(others) ? others : [])
    .filter((camp) => {
      if (!isActiveHcwAssignedCamp(camp)) return false;
      if (String(camp.hcwContactId) !== String(candidate.hcwContactId)) return false;
      if (candidate._id && camp._id && String(camp._id) === String(candidate._id)) return false;
      return parseLocalDateInput(camp.campDate) === candidateDate;
    })
    .map((camp) => ({ camp, bounds: scheduleBounds(camp) }))
    .filter((entry) => entry.bounds);

  const ordered = [
    { camp: candidate, bounds: candidateBounds, isCandidate: true },
    ...peers.map((entry) => ({ ...entry, isCandidate: false })),
  ].sort((a, b) => a.bounds.startMinutes - b.bounds.startMinutes);

  for (let i = 0; i < ordered.length - 1; i += 1) {
    const earlier = ordered[i];
    const later = ordered[i + 1];
    const earliestAllowedMinutes = earlier.bounds.endMinutes + HCW_ASSIGNMENT_GAP_MINUTES;
    if (later.bounds.startMinutes >= earliestAllowedMinutes) continue;
    if (!earlier.isCandidate && !later.isCandidate) continue;

    const conflicting = earlier.isCandidate ? later.camp : earlier.camp;
    const conflictingBounds = earlier.isCandidate ? later.bounds : earlier.bounds;
    const earliestStartTime = formatMinutes(earliestAllowedMinutes);
    const earliestStartLabel = formatCampTimeLabel(earliestStartTime);
    const earliestNextDay = earliestAllowedMinutes >= 24 * 60;

    const endsAtLabel = formatCampTimeLabel(earlier.bounds.endTime)
      + (earlier.bounds.overnight ? ' (next day)' : '');
    const earliestStartLabelResolved = earliestNextDay
      ? `${earliestStartLabel} (next day)`
      : earliestStartLabel;
    const message = buildHcwAssignmentGapMessage({
      endsAtLabel,
      earliestStartLabel: earliestStartLabelResolved,
      gapMinutes: HCW_ASSIGNMENT_GAP_MINUTES,
      isCandidate: earlier.isCandidate,
    });

    return {
      title: 'HCW Schedule Conflict',
      message,
      approvalMessage: HCW_GAP_APPROVAL_MESSAGE,
      softWarning: true,
      campId: trimStr(conflicting.campId) || '—',
      pincode: trimStr(conflicting.pincode) || '—',
      timeRangeLabel: formatTimeRange(conflictingBounds),
      endsAtLabel,
      earliestStartTime,
      earliestStartLabel: earliestStartLabelResolved,
      gapMinutes: HCW_ASSIGNMENT_GAP_MINUTES,
    };
  }

  return null;
}

/** Returns a user-facing warning string when candidate violates the 30m gap rule. */
export function getHcwAssignmentGapError(candidate = {}, others = []) {
  return findHcwAssignmentGapConflict(candidate, others)?.message || '';
}
