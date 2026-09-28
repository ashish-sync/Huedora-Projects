/**
 * Build Document One file/title nomenclature:
 * `{Party Name}-{Document Details}-{DD/MM/YYYY}`
 * e.g. Ashish-Service Agreement-27/09/2026
 */

import { parseToDate } from '../../shared/dateFormat.js';

export function formatNomenclatureDate(value) {
  const date = parseToDate(value) || new Date();
  if (Number.isNaN(date.getTime())) {
    const fallback = new Date();
    return formatParts(fallback);
  }
  return formatParts(date);
}

function formatParts(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear());
  return `${day}/${month}/${year}`;
}

function cleanPart(value, fallback) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim() || fallback;
}

export function buildAgreementDocumentTitle({
  partyName,
  documentDetails,
  dateValue,
} = {}) {
  const name = cleanPart(partyName, 'Document');
  const details = cleanPart(documentDetails, 'Agreement');
  const date = formatNomenclatureDate(dateValue);
  return `${name}-${details}-${date}`;
}

/** Safe download basename (slashes/ampersands become dashes). */
export function agreementTitleToFileBase(title) {
  return (
    String(title || 'document')
      .replace(/[\\/:*?"<>|&]+/g, '-')
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
