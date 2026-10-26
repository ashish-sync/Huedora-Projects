/**
 * Letterhead lines for commercial documents — Identity + Tax registration.
 *
 * Line 1: bold legal name + regular " • address"
 * Line 2: picked header fields (GSTIN, CIN, Udyam, Email, Website)
 *
 * Purchase Order compact (portrait space):
 *   Line 1: bold legal name only
 *   Line 2: the same picked header fields
 *
 * @param {object} company
 * @param {{ omitUdyam?: boolean, variant?: 'default' | 'po-compact' }} [options]
 */

function clean(value) {
  return value == null ? '' : String(value).trim();
}

function displayWebsite(value) {
  return clean(value)
    .replace(/^https?:\/\//i, '')
    .replace(/\/$/, '');
}

export const HEADER_DISPLAY_OPTIONS = [
  { key: 'gstin', label: 'GSTIN' },
  { key: 'cin', label: 'CIN' },
  { key: 'udyam', label: 'Udyam' },
  { key: 'email', label: 'Email' },
  { key: 'website', label: 'Website' },
];

export const DEFAULT_HEADER_DISPLAY_KEYS = HEADER_DISPLAY_OPTIONS.map((opt) => opt.key);

const ALLOWED_HEADER_KEYS = new Set(DEFAULT_HEADER_DISPLAY_KEYS);

/** Canonical ordered list, or null when the field was not sent. */
export function sanitizeHeaderDisplayKeys(raw) {
  if (!Array.isArray(raw)) return null;
  const seen = new Set();
  for (const item of raw) {
    const key = String(item || '').trim().toLowerCase();
    if (ALLOWED_HEADER_KEYS.has(key)) seen.add(key);
  }
  return DEFAULT_HEADER_DISPLAY_KEYS.filter((key) => seen.has(key));
}

/** Missing/invalid → all defaults. Explicit [] → none. */
export function resolveHeaderDisplayKeys(source = {}) {
  const sanitized = sanitizeHeaderDisplayKeys(source.headerDisplayKeys);
  return sanitized === null ? [...DEFAULT_HEADER_DISPLAY_KEYS] : sanitized;
}

function buildMetaParts(company = {}, selectedKeys, options = {}) {
  const selected = new Set(selectedKeys);
  const website = displayWebsite(company.website);
  const udyam = clean(company.udyam);
  const cin = clean(company.cin);
  const parts = [];
  if (selected.has('gstin') && company.gstin) parts.push(`GSTIN: ${clean(company.gstin)}`);
  if (selected.has('cin') && cin) parts.push(`CIN: ${cin}`);
  if (selected.has('udyam') && !options.omitUdyam && udyam) parts.push(`Udyam: ${udyam}`);
  if (selected.has('email') && company.email) parts.push(`Email: ${clean(company.email)}`);
  if (selected.has('website') && website) parts.push(`Website: ${website}`);
  return parts;
}

export function formatCompanyLetterhead(company = {}, options = {}) {
  const legalName = clean(company.legalName);
  const address = clean(company.address || company.registeredOffice);
  const selectedKeys = resolveHeaderDisplayKeys(company);
  const metaParts = buildMetaParts(company, selectedKeys, options);
  const line2 = metaParts.join(' | ');

  if (options.variant === 'po-compact') {
    return {
      legalName,
      address: '',
      line1: legalName,
      line2,
      metaParts,
      lines: [legalName, line2].filter(Boolean),
    };
  }

  const line1 = [legalName, address].filter(Boolean).join(' • ');
  return {
    legalName,
    address,
    line1,
    line2,
    metaParts,
    lines: [line1, line2].filter(Boolean),
  };
}
