import { CAMP_SLOTS, resolveCampSlot } from '../constants/campLifecycle';
import { computeDurationHours } from './campSchedule';

function isCanonicalCampSlot(value) {
  return CAMP_SLOTS.includes(String(value || '').trim());
}

/**
 * Display helper for Manage Camps time column.
 * Slot is always derived from start time when possible (Morning / Noon / Evening).
 * Stored campSlot is only a fallback when start time cannot be parsed — and only
 * if it is already a canonical slot (ignore blank, "—", or junk from imports).
 */
export function getCampTimeFrameDisplay({
  camp,
  startTime,
  endTime,
  campSlot,
  durationHours,
  timeFrame,
} = {}) {
  const source = camp || {};
  const start = String(startTime ?? source.startTime ?? '').trim();
  const end = String(endTime ?? source.endTime ?? '').trim();
  const storedSlot = String(campSlot ?? source.campSlot ?? '').trim();
  const derivedSlot = start ? resolveCampSlot(start) : '';
  const slot = derivedSlot || (isCanonicalCampSlot(storedSlot) ? storedSlot : '');
  const duration = durationHours ?? source.durationHours ?? (
    start && end ? computeDurationHours(start, end) : null
  );
  const normalizedDuration = Number.isFinite(Number(duration)) && Number(duration) > 0
    ? Number(duration)
    : null;
  const range = start && end
    ? `${start} – ${end}`
    : String(timeFrame ?? source.timeFrame ?? '').trim();

  return {
    slot,
    durationHours: normalizedDuration,
    timeRange: range,
    hasContent: Boolean(slot || range || normalizedDuration),
  };
}
