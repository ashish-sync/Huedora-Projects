import { formatTimeOfDay, normalizeTimeOfDay } from '../../../shared/dateFormat.js';
import { computeEndTime } from './campSchedule.js';
import { isActiveHcwAssignedCamp } from './campHcwAssignmentActive.js';

export { isActiveHcwAssignedCamp } from './campHcwAssignmentActive.js';

function parseTimeToMinutes(timeStr) {
  const normalized = normalizeTimeOfDay(timeStr) || String(timeStr || '').trim();
  if (!normalized) return null;
  const parts = normalized.split(':');
  const hours = Number(parts[0]);
  const minutes = Number(parts[1] || 0);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

/** Format camp clock times as HH:mm (24-hour) for assignment schedule UI. */
export function formatCampTimeLabel(timeStr) {
  const formatted = formatTimeOfDay(timeStr);
  return formatted || trimStr(timeStr) || '—';
}

function trimStr(value) {
  return value == null ? '' : String(value).trim();
}

/**
 * Normalize same-day assigned camps for the HCW schedule preview.
 * Returns rows sorted by start time with start/end/PIN for display.
 */
export function buildHcwSameDayCampRows(camps = [], {
  hcwContactId = '',
  excludeCampId = '',
  excludeCampKey = '',
} = {}) {
  const hcwId = trimStr(hcwContactId);
  if (!hcwId) return [];

  const excludeId = trimStr(excludeCampId);
  const excludeKey = trimStr(excludeCampKey);

  return (Array.isArray(camps) ? camps : [])
    .filter((camp) => {
      if (!isActiveHcwAssignedCamp(camp)) return false;
      if (String(camp.hcwContactId) !== hcwId) return false;
      if (excludeId && String(camp._id || '') === excludeId) return false;
      if (excludeKey && String(camp.campId || '') === excludeKey) return false;
      return true;
    })
    .map((camp) => {
      const startTime = trimStr(camp.startTime) || '09:00';
      const endTime = trimStr(camp.endTime) || computeEndTime(startTime, camp.durationHours || 3);
      return {
        id: String(camp._id || camp.campId || ''),
        campId: trimStr(camp.campId) || '—',
        startTime,
        endTime,
        startLabel: formatCampTimeLabel(startTime),
        endLabel: formatCampTimeLabel(endTime),
        pincode: trimStr(camp.pincode) || '—',
        startMinutes: parseTimeToMinutes(startTime) ?? 0,
      };
    })
    .sort((a, b) => a.startMinutes - b.startMinutes);
}
