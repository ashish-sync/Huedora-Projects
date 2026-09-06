/**
 * Camp One execution-document display helpers (mirrors server nomenclature).
 * Stored: {campId}__{DOCTOR}{CODE}.ext · Display: {DOCTOR}{CODE}.ext
 */

const DOC_CODE_PATTERN = 'DF|PF|GS|OT|DOC';

export function stripLegacyCampDateFromExecutionName(name = '') {
  const raw = String(name || '').trim();
  if (!raw) return '';
  const dot = raw.lastIndexOf('.');
  const ext = dot >= 0 ? raw.slice(dot) : '';
  const stem = dot >= 0 ? raw.slice(0, dot) : raw;
  const cleaned = stem.replace(new RegExp(`(${DOC_CODE_PATTERN})(\\d{8})$`, 'i'), '$1');
  return `${cleaned}${ext}`;
}

/** Prefer API fileName; strip legacy date suffix for older uploads. */
export function executionDocumentDisplayName(doc = {}) {
  const preferred = String(doc?.fileName || '').trim();
  if (preferred) return stripLegacyCampDateFromExecutionName(preferred);
  const stored = String(doc?.storedName || '').trim();
  if (stored) {
    const cleaned = stripLegacyCampDateFromExecutionName(stored);
    const logical = cleaned.includes('__') ? cleaned.split('__').pop() : cleaned;
    return logical || cleaned;
  }
  return String(doc?.originalFileName || 'file').trim() || 'file';
}
