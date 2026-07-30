function parseTimeToMinutes(timeStr) {
  if (!timeStr) return null;
  const parts = String(timeStr).trim().split(':');
  const hours = Number(parts[0]);
  const minutes = Number(parts[1] || 0);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

function parseLocalDateInput(value) {
  const text = String(value || '').trim();
  if (!text) return null;

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  const dmy = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/.exec(text);

  let year;
  let month;
  let day;

  if (iso) {
    year = Number(iso[1]);
    month = Number(iso[2]);
    day = Number(iso[3]);
  } else if (dmy) {
    day = Number(dmy[1]);
    month = Number(dmy[2]);
    year = Number(dmy[3]);
    if (year < 100) year += 2000;
  } else {
    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString().slice(0, 10);
  }

  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function applyTimeToDate(date, timeStr, fallbackEndOfDay = false) {
  const minutes = parseTimeToMinutes(timeStr);
  if (minutes == null) {
    if (fallbackEndOfDay) date.setHours(23, 59, 59, 999);
    return date;
  }
  date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return date;
}

export function getCampStartDateTime(camp = {}) {
  const dateStr = parseLocalDateInput(camp.campDate) || String(camp.campDate || '').slice(0, 10);
  const start = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(start.getTime())) return null;
  return applyTimeToDate(start, camp.startTime || '09:00');
}

export function getCampEndDateTime(camp = {}) {
  const dateStr = parseLocalDateInput(camp.campDate) || String(camp.campDate || '').slice(0, 10);
  const end = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(end.getTime())) return null;
  const endTime = camp.endTime || computeEndTime(camp.startTime, camp.durationHours);
  return applyTimeToDate(end, endTime, !endTime);
}

export function computeEndTime(startTime, durationHours) {
  const startMinutes = parseTimeToMinutes(startTime);
  if (startMinutes == null || !durationHours) return '';

  const totalMinutes = startMinutes + Number(durationHours) * 60;
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function computeDurationHours(startTime, endTime) {
  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);
  if (startMinutes == null || endMinutes == null) return 3;

  let diff = endMinutes - startMinutes;
  if (diff <= 0) diff += 24 * 60;

  const hours = diff / 60;
  if (hours <= 0) return 3;

  return Math.max(1, Math.min(12, Math.round(hours * 100) / 100));
}

export function resolveCampSchedule({ startTime = '09:00', endTime = '' } = {}) {
  const start = String(startTime || '09:00').trim() || '09:00';
  const end = String(endTime || '').trim();
  return {
    startTime: start,
    endTime: end,
    durationHours: end ? computeDurationHours(start, end) : 3,
  };
}
