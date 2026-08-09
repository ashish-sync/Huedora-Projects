import { computeEndTime } from './campSchedule.js';

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

/** Format HH:mm as 8:00 AM / 3:30 PM for assignment schedule UI. */
export function formatCampTimeLabel(timeStr) {
  const minutes = parseTimeToMinutes(timeStr);
  if (minutes == null) return trimStr(timeStr) || '—';
  const hours24 = Math.floor(minutes / 60) % 24;
  const mins = minutes % 60;
  const meridiem = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 || 12;
  return `${hours12}:${String(mins).padStart(2, '0')} ${meridiem}`;
}

function isActiveHcwAssignedCamp(camp = {}) {
  if (['cancelled', 'rejected'].includes(trimStr(camp.status))) return false;
  if (!trimStr(camp.hcwContactId)) return false;
  if (trimStr(camp.assignmentDecision) === 'refuse') return false;
  return true;
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
