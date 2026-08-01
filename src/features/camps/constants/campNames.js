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

const LEGACY_CAMP_METHOD_ALIASES = {
  bmd: 'BMD',
  classic: 'BMD',
  diet: 'Dietician',
  dieit: 'Dietician',
  dietician: 'Dietician',
  dietitian: 'Dietician',
  physio: 'Neuro & Physio',
  nuero: 'Neuro & Physio',
  neuro: 'Neuro & Physio',
  diagnostic: 'Diagnostics',
  diagnostics: 'Diagnostics',
  daignostic: 'Diagnostics',
  uro: 'Uroflowmetery',
  uroflowmetery: 'Uroflowmetery',
};

/** Align camp / client-master method values (mirrors server normalizeCampName). */
export function normalizeCampMethodKey(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  if (KNOWN_METHODS.has(trimmed)) return trimmed;

  const lower = trimmed.toLowerCase();
  if (LEGACY_CAMP_METHOD_ALIASES[lower]) return LEGACY_CAMP_METHOD_ALIASES[lower];

  if (lower.includes('bmd') || lower.includes('classic')) return 'BMD';
  if (lower.includes('diet') || lower.includes('dieit')) return 'Dietician';
  if (lower.includes('physio') || lower.includes('nuero') || lower.includes('neuro')) {
    return 'Neuro & Physio';
  }
  if (lower.includes('diagnostic') || lower.includes('daignostic')) return 'Diagnostics';
  if (lower.includes('uro')) return 'Uroflowmetery';

  return trimmed;
}
