import { computeDurationHours } from './campSchedule';

export function getCampDurationHours(row = {}) {
  const fromField = Number(row.durationHours);
  if (Number.isFinite(fromField) && fromField > 0) return fromField;
  if (row.startTime && row.endTime) {
    const computed = computeDurationHours(row.startTime, row.endTime);
    if (Number.isFinite(computed) && computed > 0) return computed;
  }
  return null;
}

export function isCampDurationOutOfRange(durationHours) {
  return Number.isFinite(durationHours) && (durationHours < 2 || durationHours > 8);
}

export function confirmCampDurationIfNeeded(durationHours, { plural = false } = {}) {
  if (!isCampDurationOutOfRange(durationHours)) return true;
  return window.confirm(
    `Camp duration is ${durationHours} hour(s). Typical camps run 2–8 hours. Continue${plural ? ' creating camp(s)' : ''}?`,
  );
}

export function confirmPastePreviewDurations(bodyPreview = []) {
  const creatable = bodyPreview.filter((entry) => (entry.valid || entry.partial) && !entry.duplicateOf && entry.row);
  const outOfRange = creatable
    .map((entry) => getCampDurationHours(entry.row))
    .filter((hours) => isCampDurationOutOfRange(hours));
  if (!outOfRange.length) return true;
  const unique = [...new Set(outOfRange)];
  const sample = unique.slice(0, 3).join(', ');
  const suffix = unique.length > 3 ? '…' : '';
  return window.confirm(
    `${creatable.length > 1 ? 'Some camps have' : 'Camp has'} duration outside 2–8 hours (${sample}${suffix}). Continue creating camp(s)?`,
  );
}
