/** Canonical spelling for the Dietician label across TYLO One. */
export const CANONICAL_DIETICIAN = 'Dietician';

const DIETICIAN_KEYS = new Set([
  'dietician',
  'dieticians',
  'dietitian',
  'dietitians',
  'deitician',
  'dieitician',
  'dieititian',
]);

function compactKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
}

export function canonicalizeDieticianLabel(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return raw;
  if (DIETICIAN_KEYS.has(compactKey(raw))) return CANONICAL_DIETICIAN;
  return raw;
}

export function canonicalizeDieticianText(value) {
  const raw = String(value ?? '');
  if (!raw) return raw;
  return raw.replace(/\b[Dd][Ii][Ee][Tt][Ii][Tt][Ii][Aa][Nn](s)?\b/g, (match, plural) => {
    const isAllCaps = match === match.toUpperCase();
    const isTitle = match[0] === match[0].toUpperCase();
    if (isAllCaps) return plural ? 'DIETICIANS' : 'DIETICIAN';
    if (isTitle) return plural ? 'Dieticians' : 'Dietician';
    return plural ? 'dieticians' : 'dietician';
  });
}

export function isDieticianLabel(value) {
  return DIETICIAN_KEYS.has(compactKey(value));
}
