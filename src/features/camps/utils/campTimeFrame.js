import { resolveCampSlot } from '../constants/campLifecycle';
import { computeDurationHours } from './campSchedule';

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
  const slot = String(campSlot ?? source.campSlot ?? (start ? resolveCampSlot(start) : '')).trim();
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
    hasContent: Boolean(slot || range),
  };
}
