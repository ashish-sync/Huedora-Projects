/**
 * TYLO One standard date/time utilities.
 * Mandatory standards:
 * - Date: DD-MM-YYYY (e.g. 08-11-2026)
 * - Time: hh:mm AM/PM (e.g. 09:30 AM)
 * - Timezone: Asia/Kolkata (IST, UTC+05:30)
 *
 * Internal APIs / DOM input types:
 * - <input type="date"> uses YYYY-MM-DD
 * - <input type="time"> uses HH:mm (24-hour)
 * - normalizeTimeOfDay returns 24-hour HH:mm for internal data / comparisons
 */

export const TIME_ZONE = 'Asia/Kolkata';

const DATE_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
});

function expandYear(yearPart) {
  const y = String(yearPart || '').trim();
  if (y.length === 4) return Number(y);
  if (y.length === 2) {
    const n = Number(y);
    return n >= 70 ? 1900 + n : 2000 + n;
  }
  return NaN;
}

function calendarDate(year, month, day) {
  if ([year, month, day].some((n) => Number.isNaN(n) || !Number.isFinite(n))) return null;
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

export function parseToDate(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  const text = String(value).trim();
  if (!text) return null;

  const isoDateTime = /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?/.exec(text);
  if (isoDateTime) {
    const hasTz = /[Zz]|[+-]\d{2}(?::?\d{2})?$/.test(text);
    const normalizedIso = hasTz ? text : `${text.replace(' ', 'T')}+05:30`;
    const parsed = new Date(normalizedIso);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (iso) {
    return calendarDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  }

  const compact = text.replace(/\s+/g, '');
  const delimited = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(compact);
  if (delimited) {
    const a = Number(delimited[1]);
    const b = Number(delimited[2]);
    const year = expandYear(delimited[3]);
    if (!Number.isNaN(year)) {
      // Indian DD-MM-YY first; recover US M/D/YY only when DD-MM is impossible.
      const dmy = calendarDate(year, b, a);
      if (dmy) return dmy;
      if (a <= 12 && b > 12) {
        const mdy = calendarDate(year, a, b);
        if (mdy) return mdy;
      }
    }
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatInstantDate(date) {
  const parts = DATE_FORMATTER.formatToParts(date);
  let day = '';
  let month = '';
  let year = '';
  for (const p of parts) {
    if (p.type === 'day') day = p.value;
    else if (p.type === 'month') month = p.value;
    else if (p.type === 'year') year = p.value;
  }
  return `${day}-${month}-${year}`;
}

/** Display date as DD-MM-YYYY in Asia/Kolkata */
export function formatDate(value) {
  if (!value) return '';
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : formatInstantDate(value);
  }

  const text = String(value).trim();
  if (!text) return '';

  // Pure date YYYY-MM-DD
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (isoMatch) {
    return `${isoMatch[3]}-${isoMatch[2]}-${isoMatch[1]}`;
  }

  // Delimited DD-MM-YYYY or DD/MM/YYYY or MM/DD/YYYY
  const delimitedMatch = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(text);
  if (delimitedMatch) {
    const a = Number(delimitedMatch[1]);
    const b = Number(delimitedMatch[2]);
    const year = expandYear(delimitedMatch[3]);
    if (!Number.isNaN(year)) {
      if (a <= 12 && b > 12) {
        // Recover leftover US MM-DD-YYYY
        return `${String(b).padStart(2, '0')}-${String(a).padStart(2, '0')}-${year}`;
      }
      return `${String(a).padStart(2, '0')}-${String(b).padStart(2, '0')}-${year}`;
    }
  }

  const date = parseToDate(text);
  if (!date) return text;
  return formatInstantDate(date);
}

/** Alias for explicit 4-digit year display */
export const formatDateDDMMYYYY = formatDate;

/**
 * Normalize a clock time (09:00, 9:00 am, 930pm, 6.00 PM) to HH:mm (24-hour).
 * Returns '' when the value cannot be parsed as a time of day.
 * Used internally for <input type="time"> values and 24-hr comparisons.
 */
export function normalizeTimeOfDay(value) {
  const raw = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!raw) return '';

  let text = raw
    .replace(/\./g, ':')
    .replace(/\b(onwards?|starting|from)\b/gi, '')
    .trim();

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

function format24HourTo12Hour(hhmm) {
  if (!hhmm || typeof hhmm !== 'string') return '';
  const [hStr, mStr] = hhmm.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return '';
  const meridiem = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${meridiem}`;
}

function formatInstantTime(date) {
  const parts = TIME_FORMATTER.formatToParts(date);
  let hour = '';
  let minute = '';
  let dayPeriod = '';
  for (const p of parts) {
    if (p.type === 'hour') hour = p.value;
    else if (p.type === 'minute') minute = p.value;
    else if (p.type === 'dayPeriod') dayPeriod = p.value;
  }
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${dayPeriod.toUpperCase()}`;
}

/**
 * Display time as hh:mm AM/PM (12-hour) in Asia/Kolkata timezone.
 * Accepts Date, ISO datetime, or clock strings (09:00, 14:30, 2:30 pm).
 */
export function formatTime(value) {
  if (value == null || value === '') return '';
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : formatInstantTime(value);
  }

  const text = String(value).trim();
  if (!text) return '';

  // If clock string like "09:30" or "14:30" or "9:00 am" (not full ISO datetime)
  const clock = normalizeTimeOfDay(text);
  if (clock && !/^\d{4}-\d{2}-\d{2}/.test(text)) {
    return format24HourTo12Hour(clock);
  }

  // Datetime string
  const date = parseToDate(text);
  if (!date) return '';
  return formatInstantTime(date);
}

/** Alias — prefer this name when formatting camp start/end columns. */
export const formatTimeOfDay = formatTime;

/** Display as DD-MM-YYYY hh:mm AM/PM in Asia/Kolkata timezone */
export function formatDateTime(value) {
  if (!value) return '-';
  const date = parseToDate(value);
  if (!date) return '-';
  const dateStr = formatDate(date);
  const timeStr = formatTime(date);
  if (!dateStr || !timeStr) return '-';
  return `${dateStr} ${timeStr}`;
}

export const formatDateTimeDDMMYYYY = formatDateTime;

export function formatDateRangeLabel(dateFrom, dateTo) {
  const from = dateFrom ? formatDate(dateFrom) : '...';
  const to = dateTo ? formatDate(dateTo) : '...';
  return `${from} to ${to}`;
}

/** Parse display or ISO date to YYYY-MM-DD for API / date inputs */
export function toApiDateValue(value) {
  if (!value) return '';
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    const parts = DATE_FORMATTER.formatToParts(value);
    let day = '';
    let month = '';
    let year = '';
    for (const p of parts) {
      if (p.type === 'day') day = p.value;
      else if (p.type === 'month') month = p.value;
      else if (p.type === 'year') year = p.value;
    }
    return `${year}-${month}-${day}`;
  }

  const text = String(value || '').trim();
  if (!text) return '';

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (isoMatch) return text;

  const date = parseToDate(text);
  if (date) {
    const parts = DATE_FORMATTER.formatToParts(date);
    let day = '';
    let month = '';
    let year = '';
    for (const p of parts) {
      if (p.type === 'day') day = p.value;
      else if (p.type === 'month') month = p.value;
      else if (p.type === 'year') year = p.value;
    }
    return `${year}-${month}-${day}`;
  }

  return text;
}

/** Today as YYYY-MM-DD in Asia/Kolkata timezone (form defaults) */
export function todayIso() {
  return toApiDateValue(new Date());
}
