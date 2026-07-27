/** Canonical camp / client-master Method options. */
export const CAMP_METHOD_OTHER_LABEL = 'Others';

export const CAMP_NAME_OPTIONS = [
  'BMD',
  'Neuro & Physio',
  'Uroflowmetery',
  'Diagnostics',
  'Dietician',
  CAMP_METHOD_OTHER_LABEL,
];

const KNOWN_METHODS = new Set(CAMP_NAME_OPTIONS);

export function isKnownCampMethod(value) {
  return KNOWN_METHODS.has(String(value || '').trim());
}

/** Valid stored method: known option (not bare Others) or custom Others text. */
export function isValidCampMethod(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return false;
  if (trimmed.toLowerCase() === 'others' || trimmed === CAMP_METHOD_OTHER_LABEL) return false;
  if (isKnownCampMethod(trimmed)) return true;
  return trimmed.length >= 2;
}
