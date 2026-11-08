import { describe, expect, it } from 'vitest';
import {
  TIME_ZONE,
  formatDate,
  formatDateDDMMYYYY,
  formatDateRangeLabel,
  formatDateTime,
  formatTime,
  formatTimeOfDay,
  normalizeTimeOfDay,
  parseToDate,
  toApiDateValue,
  todayIso,
} from './dateFormat.js';

describe('Standardized Date and Time Formatting (Client)', () => {
  it('enforces Asia/Kolkata timezone standard', () => {
    expect(TIME_ZONE).toBe('Asia/Kolkata');
  });

  it('formats calendar and ISO dates to DD-MM-YYYY', () => {
    expect(formatDate('2026-08-15')).toBe('15-08-2026');
    expect(formatDate('15/08/2026')).toBe('15-08-2026');
    expect(formatDate('08-11-2026')).toBe('08-11-2026');
    expect(formatDateDDMMYYYY('2026-01-05')).toBe('05-01-2026');
  });

  it('formats Date instances and UTC ISO timestamps accurately in Asia/Kolkata', () => {
    // 18:45 UTC is 00:15 next day in IST (UTC+05:30)
    const lateUtc = new Date('2026-11-08T18:45:00Z');
    expect(formatDate(lateUtc)).toBe('09-11-2026');
    expect(formatTime(lateUtc)).toBe('12:15 AM');
    expect(formatDateTime(lateUtc)).toBe('09-11-2026 12:15 AM');
  });

  it('formats clock strings to hh:mm AM/PM (12-hour zero-padded)', () => {
    expect(formatTime('09:30')).toBe('09:30 AM');
    expect(formatTime('14:30')).toBe('02:30 PM');
    expect(formatTime('11:00 AM')).toBe('11:00 AM');
    expect(formatTime('6:00 PM')).toBe('06:00 PM');
    expect(formatTime('9AM')).toBe('09:00 AM');
    expect(formatTime('930pm')).toBe('09:30 PM');
    expect(formatTime('00:00')).toBe('12:00 AM');
    expect(formatTime('12:00')).toBe('12:00 PM');
    expect(formatTimeOfDay('17:45')).toBe('05:45 PM');
  });

  it('preserves normalizeTimeOfDay as 24-hour HH:mm for native inputs and internal storage', () => {
    expect(normalizeTimeOfDay('20:30')).toBe('20:30');
    expect(normalizeTimeOfDay('11:00 AM')).toBe('11:00');
    expect(normalizeTimeOfDay('6:00 PM')).toBe('18:00');
    expect(normalizeTimeOfDay('9AM')).toBe('09:00');
    expect(normalizeTimeOfDay('09:30')).toBe('09:30');
  });

  it('formats datetimes as DD-MM-YYYY hh:mm AM/PM', () => {
    expect(formatDateTime('2026-08-15T09:00:00Z')).toBe('15-08-2026 02:30 PM');
    expect(formatDateTime('2026-08-15 14:30:00')).toBe('15-08-2026 02:30 PM');
  });

  it('handles empty, null and unparseable values gracefully', () => {
    expect(formatDate('')).toBe('');
    expect(formatDate(null)).toBe('');
    expect(formatTime('')).toBe('');
    expect(formatTime(null)).toBe('');
    expect(formatDateTime('')).toBe('-');
    expect(formatDateTime(null)).toBe('-');
  });

  it('formats date ranges as DD-MM-YYYY to DD-MM-YYYY', () => {
    expect(formatDateRangeLabel('2026-11-01', '2026-11-08')).toBe('01-11-2026 to 08-11-2026');
  });

  it('preserves toApiDateValue returning YYYY-MM-DD for form controls', () => {
    expect(toApiDateValue('15-08-2026')).toBe('2026-08-15');
    expect(toApiDateValue('2026-08-15')).toBe('2026-08-15');
    expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

