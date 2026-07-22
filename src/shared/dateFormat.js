/**
 * TYLO One display dates: DD-MM-YYYY, times: 24-hour HH:mm.
 * API / form values stay YYYY-MM-DD.
 */

function expandYear(yearPart) {
  const y = String(yearPart || '').trim();
  if (y.length === 4) return Number(y);
  if (y.length === 2) {
    const n = Number(y);
    return n >= 70 ? 1900 + n : 2000 + n;
  }
  return NaN;
}

export function parseToDate(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  const text = String(value).trim();
  if (!text) return null;

  const compact = text.replace(/\s+/g, '');

  const dmyDash = /^(\d{2})-(\d{2})-(\d{2}|\d{4})$/.exec(compact);
  if (dmyDash) {
    const year = expandYear(dmyDash[3]);
    if (!Number.isNaN(year)) {
      return new Date(year, Number(dmyDash[2]) - 1, Number(dmyDash[1]));
    }
  }

  const dmySlash = /^(\d{2})\/(\d{2})\/(\d{2}|\d{4})$/.exec(compact);
  if (dmySlash) {
    const year = expandYear(dmySlash[3]);
    if (!Number.isNaN(year)) {
      return new Date(year, Number(dmySlash[2]) - 1, Number(dmySlash[1]));
    }
  }

  const isoDateTime = /^(\d{4})-(\d{2})-(\d{2})[T\s]/.exec(text);
  if (isoDateTime) {
    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (iso) {
    return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Display date as DD-MM-YYYY */
export function formatDate(value) {
  if (!value) return '';
  const date = parseToDate(value);
  if (!date) return String(value).trim();

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear());
  return `${day}-${month}-${year}`;
}

/** Alias for explicit 4-digit year display */
export const formatDateDDMMYYYY = formatDate;

/** Display time as HH:mm (24-hour) */
export function formatTime(value) {
  if (!value) return '';
  const date = parseToDate(value);
  if (!date) return '';
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/** Display as DD-MM-YYYY HH:mm */
export function formatDateTime(value) {
  if (!value) return '-';
  const date = parseToDate(value);
  if (!date) return '-';
  return `${formatDate(date)} ${formatTime(date)}`;
}

export function formatDateRangeLabel(dateFrom, dateTo) {
  const from = dateFrom ? formatDate(dateFrom) : '...';
  const to = dateTo ? formatDate(dateTo) : '...';
  return `${from} to ${to}`;
}

/** Parse display or ISO date to YYYY-MM-DD for API / date inputs */
export function toApiDateValue(value) {
  const text = String(value || '').trim();
  if (!text) return '';

  const date = parseToDate(text);
  if (date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return text;
}

/** Today as YYYY-MM-DD (form defaults) */
export function todayIso() {
  return toApiDateValue(new Date());
}
