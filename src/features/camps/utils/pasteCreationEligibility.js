const MANDATORY_LABELS = {
  doctorName: 'Doctor Name',
  pincode: 'PIN Code',
  campDate: 'Camp Date',
  startTime: 'Camp Start Time',
};

function trimStr(value) {
  return value == null ? '' : String(value).replace(/\s+/g, ' ').trim();
}

/** Mirror server pasteTimeNormalize — keep create gate consistent while editing. */
export function normalizePasteStartTime(value) {
  const raw = trimStr(value);
  if (!raw) return '';

  let text = raw.replace(/\./g, ':').replace(/\s+/g, ' ').trim();
  text = text.replace(/\b(onwards?|starting|from)\b/gi, '').trim();

  const compact = text.match(/^(\d{1,2})([0-5]\d)\s*(am|pm)?$/i);
  if (compact) {
    text = `${compact[1]}:${compact[2]}${compact[3] ? ` ${compact[3]}` : ''}`;
  }

  const match = text.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!match) return '';

  let hours = Number(match[1]);
  const minutes = match[2] != null ? Number(match[2]) : 0;
  const meridiem = match[3]?.toUpperCase();
  if (Number.isNaN(hours) || Number.isNaN(minutes) || minutes > 59) return '';
  if (meridiem === 'PM' && hours < 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;
  if (!meridiem && hours > 23) return '';
  if (hours < 0 || hours > 23) return '';
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function getPasteCreationMissingKeys(row = {}) {
  const missing = [];
  if (!trimStr(row.doctorName)) missing.push('doctorName');
  if (!/^\d{6}$/.test(trimStr(row.pincode))) missing.push('pincode');
  if (!trimStr(row.campDate)) missing.push('campDate');
  if (!normalizePasteStartTime(row.startTime)) missing.push('startTime');
  return missing;
}

export function isPasteCreationEligible(row = {}) {
  return getPasteCreationMissingKeys(row).length === 0;
}

export function labelPasteCreationField(key) {
  return MANDATORY_LABELS[key] || key;
}

/**
 * Refresh preview entry flags after Edit-mode changes so Create Camps
 * unlocks as soon as the 4 mandatory fields are present.
 */
export function withPasteCreationFlags(entry = {}) {
  if (entry.duplicateOf?.campId || entry.historicalDateBlocked) {
    return {
      ...entry,
      creationEligible: false,
      reviewStatus: 'REVIEW_REQUIRED',
    };
  }

  const row = entry.row || {};
  const normalizedStart = normalizePasteStartTime(row.startTime);
  const nextRow = normalizedStart && normalizedStart !== trimStr(row.startTime)
    ? { ...row, startTime: normalizedStart }
    : row;
  const mandatoryMissing = getPasteCreationMissingKeys(nextRow);
  const creationEligible = mandatoryMissing.length === 0;

  return {
    ...entry,
    row: nextRow,
    creationEligible,
    mandatoryMissing,
    valid: entry.valid && creationEligible,
    partial: creationEligible ? true : false,
    reviewStatus: creationEligible ? (entry.valid ? 'READY' : 'READY') : 'REVIEW_REQUIRED',
    errors: creationEligible
      ? (entry.errors || []).filter((err) => !/is required|must be exactly|must be a whole/i.test(String(err)))
      : [
          ...mandatoryMissing.map((key) => `${labelPasteCreationField(key)} is required`),
          ...(entry.errors || []).filter((err) => /doctor name|pin code|camp date|start time/i.test(String(err))),
        ],
  };
}

export function refreshPastePreviewEligibility(preview) {
  if (!preview?.bodyPreview) return preview;
  const bodyPreview = preview.bodyPreview.map((entry) => withPasteCreationFlags(entry));
  const creatable = bodyPreview.filter(
    (entry) => entry.creationEligible && !entry.duplicateOf && !entry.historicalDateBlocked,
  );
  return {
    ...preview,
    bodyPreview,
    summary: {
      ...(preview.summary || {}),
      validBodyRows: creatable.length,
      partialBodyRows: creatable.filter((entry) => entry.partial && !entry.valid).length,
      invalidBodyRows: bodyPreview.filter(
        (entry) => !entry.creationEligible && !entry.duplicateOf,
      ).length,
    },
  };
}
