function parseTimeToMinutes(timeStr) {
  if (!timeStr) return null;
  const parts = String(timeStr).trim().split(':');
  const hours = Number(parts[0]);
  const minutes = Number(parts[1] || 0);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
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
