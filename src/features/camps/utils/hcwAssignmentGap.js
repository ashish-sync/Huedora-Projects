import { computeEndTime } from './campSchedule.js';
import { formatCampTimeLabel } from './hcwSameDayCamps.js';

export const HCW_ASSIGNMENT_GAP_MINUTES = 90;

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

function isActiveHcwAssignedCamp(camp = {}) {
  if (['cancelled', 'rejected'].includes(trimStr(camp.status))) return false;
  if (!trimStr(camp.hcwContactId)) return false;
  if (trimStr(camp.assignmentDecision) === 'refuse') return false;
  return true;
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

/**
 * Structured gap conflict for UI, or null when OK.
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

    const title = 'HCW schedule conflict';
    const summary = earlier.isCandidate
      ? 'This camp ends too close to another camp already assigned to this HCW on the same date.'
      : 'This HCW already has another camp on this date that overlaps the required 1 hour 30 minutes gap.';

    return {
      title,
      summary,
      campId: trimStr(conflicting.campId) || '—',
      pincode: trimStr(conflicting.pincode) || '—',
      timeRangeLabel: formatTimeRange(conflictingBounds),
      endsAtLabel: formatCampTimeLabel(earlier.bounds.endTime)
        + (earlier.bounds.overnight ? ' (next day)' : ''),
      earliestStartTime,
      earliestStartLabel: earliestNextDay
        ? `${earliestStartLabel} (next day)`
        : earliestStartLabel,
      gapMinutes: HCW_ASSIGNMENT_GAP_MINUTES,
      message: earlier.isCandidate
        ? `This camp ends at ${formatCampTimeLabel(earlier.bounds.endTime)}. The next camp for this HCW (${trimStr(conflicting.campId) || 'another camp'}) must start at ${earliestStartLabel} or later (1 hour 30 minutes gap required).`
        : `This HCW already has camp ${trimStr(conflicting.campId) || 'another camp'} (${formatTimeRange(earlier.bounds)}${trimStr(conflicting.pincode) ? `, PIN ${trimStr(conflicting.pincode)}` : ''}) until ${formatCampTimeLabel(earlier.bounds.endTime)}. Earliest allowed start is ${earliestStartLabel}.`,
    };
  }

  return null;
}

/** Returns a user-facing error string when candidate violates the 1h30 gap rule. */
export function getHcwAssignmentGapError(candidate = {}, others = []) {
  return findHcwAssignmentGapConflict(candidate, others)?.message || '';
}
