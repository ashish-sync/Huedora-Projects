/**
 * Build Document One file/title nomenclature:
 * `{Primary Party}-{Document Details}-{DD-MM-YYYY}`
 * e.g. Ashish-Service Agreement-27-09-2026
 *
 * Long multi-party names and org-prefixed template titles are shortened so
 * list/file names stay readable.
 */

import { formatDate, parseToDate } from '../../shared/dateFormat.js';

const PARTY_MAX = 42;
const DETAILS_MAX = 40;

export function formatNomenclatureDate(value) {
  const date = parseToDate(value) || new Date();
  if (Number.isNaN(date.getTime())) {
    return formatDate(new Date()) || '';
  }
  return formatDate(date);
}

function cleanPart(value, fallback) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim() || fallback;
}

/** Keep the first party when names are joined with & / and / ,. */
export function primaryPartyName(value, fallback = 'Document') {
  const raw = cleanPart(value, fallback);
  const first = raw.split(/\s*(?:&+|\/|,|\band\b)\s*/i)[0] || raw;
  return truncatePart(first, PARTY_MAX) || fallback;
}

/**
 * Drop org brand prefixes and compress noisy separators in template titles.
 * "Tylo Care - Service Agreement & NDA" → "Service Agreement NDA"
 */
export function shortenDocumentDetails(value, fallback = 'Agreement') {
  let details = cleanPart(value, fallback);
  details = details
    .replace(/^(tylo\s*care(?:\s*private\s*limited)?|tcpl|tylo)\s*[-–—:|]\s*/i, '')
    .replace(/\s*&\s*/g, ' ')
    .replace(/\s*[-–—|]\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return truncatePart(details, DETAILS_MAX) || fallback;
}

function truncatePart(value, max) {
  const text = String(value || '').trim();
  if (!text || text.length <= max) return text;
  const cut = text.slice(0, max - 1).replace(/\s+\S*$/, '').trim();
  return `${cut || text.slice(0, max - 1)}…`;
}

export function buildAgreementDocumentTitle({
  partyName,
  documentDetails,
  dateValue,
} = {}) {
  const name = primaryPartyName(partyName, 'Document');
  const details = shortenDocumentDetails(documentDetails, 'Agreement');
  const date = formatNomenclatureDate(dateValue);
  return `${name}-${details}-${date}`;
}

/** Safe download basename (path-unsafe chars become dashes). */
export function agreementTitleToFileBase(title) {
  return (
    String(title || 'document')
      .replace(/[\\/:*?"<>|]+/g, '-')
      .replace(/\s*&\s*/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/-+/g, '-')
      .replace(/^\s*-+\s*|\s*-+\s*$/g, '')
      .trim() || 'document'
  );
}

/** Trigger a browser download with an explicit file name (avoids blob UUID names). */
export function downloadBlobWithName(blob, fileName, mimeType) {
  const raw = String(fileName || 'document').trim() || 'document';
  const extMatch = raw.match(/(\.[a-z0-9]+)$/i);
  const ext = extMatch ? extMatch[1] : '';
  const stem = ext ? raw.slice(0, -ext.length) : raw;
  const name = `${agreementTitleToFileBase(stem)}${ext}`;
  const type = mimeType || blob?.type || 'application/octet-stream';
  const file = new File([blob], name, { type });
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}
