import { IMPORT_ACCEPT_ATTR, IMPORT_ACCEPT_HINT, MAX_IMPORT_ROWS } from './importFilePolicy.js';

const MAX_BYTES = 3 * 1024 * 1024;

/**
 * Prefer API error.message; never show bare status codes or 1–2 word stubs.
 */
export function getErrorMessage(err, fallback = 'Something went wrong. Please try again.') {
  if (!err) return fallback;
  const raw =
    err.message ||
    err.error?.message ||
    (typeof err === 'string' ? err : '');
  const text = String(raw || '').trim();
  if (!text) return fallback;
  if (/^(failed|error|invalid|denied|forbidden|unauthorized|request failed)$/i.test(text)) {
    return fallback;
  }
  if (/^request failed \(\d+\)$/i.test(text)) {
    return fallback;
  }
  return text;
}

/** Validate a browser File before upload; returns one clear sentence or null. */
export function validateImportFileClient(file) {
  if (!file) {
    return `Please choose a file to import (.csv preferred, or .xlsb). Maximum ${MAX_IMPORT_ROWS.toLocaleString()} rows and 3 MB.`;
  }
  const name = String(file.name || '');
  const lower = name.toLowerCase();
  if (!lower.endsWith('.csv') && !lower.endsWith('.xlsb')) {
    return 'This file type is not supported for import. Use a .csv file (preferred) or .xlsb — Excel workbooks (.xlsx/.xls) are not accepted. In Excel: File → Save As → CSV.';
  }
  if (!file.size || file.size <= 0) {
    return `This file has no data rows to import. Download the sample CSV, add up to ${MAX_IMPORT_ROWS.toLocaleString()} rows under the header, and try again.`;
  }
  if (file.size > MAX_BYTES) {
    return `This file is larger than 3 MB. Reduce the file (max ${MAX_IMPORT_ROWS.toLocaleString()} rows) and upload again.`;
  }
  return null;
}

export function formatRowImportError(e) {
  const row = e?.row != null ? `Row ${e.row}` : 'A row';
  const field = e?.field && e.field !== 'import' ? ` (${e.field})` : '';
  const msg = String(e?.message || e?.reason || 'Import failed').trim();
  const detail = /[.!?]$/.test(msg) ? msg : `${msg}.`;
  return `${row}${field}: ${detail}`;
}

/**
 * Validate a non-spreadsheet upload (images, PDFs, DOCX) before FormData.append.
 * @returns {string|null} one-line error or null if OK
 */
export function validateUploadFile(file, { maxBytes = 5 * 1024 * 1024, acceptExt = null, label = 'file' } = {}) {
  if (!file) return `Please choose a ${label} to upload.`;
  const size = Number(file.size) || 0;
  if (size <= 0) return `This ${label} is empty. Choose another file and try again.`;
  if (size > maxBytes) {
    const mb = Math.round(maxBytes / (1024 * 1024));
    return `This ${label} is larger than ${mb} MB. Choose a smaller file and try again.`;
  }
  if (acceptExt?.length) {
    const name = String(file.name || '').toLowerCase();
    const ok = acceptExt.some((ext) => name.endsWith(String(ext).toLowerCase()));
    if (!ok) {
      return `This ${label} type is not supported. Allowed: ${acceptExt.join(', ')}.`;
    }
  }
  return null;
}

export { IMPORT_ACCEPT_ATTR, IMPORT_ACCEPT_HINT };
