import { describe, expect, it } from 'vitest';
import {
  campCreateApprovalReasons,
  canSetHistoricalCampDates,
  getFutureRequestDateError,
  getHistoricalCampDateErrors,
  isCampDateNeedingApproval,
  isFutureRequestDate,
  isHistoricalCampDate,
  isRequestDateNeedingApproval,
} from './campDatePolicy.js';

function isoOffset(days) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

describe('campDatePolicy', () => {
  it('flags dates more than 2 days in the past', () => {
    expect(isHistoricalCampDate(isoOffset(-3))).toBe(true);
    expect(isHistoricalCampDate(isoOffset(-2))).toBe(false);
  });

  it('does not block anyone from entering historical dates', () => {
    expect(getHistoricalCampDateErrors({ campDate: isoOffset(-5) })).toEqual([]);
    expect(getHistoricalCampDateErrors({ requestDate: isoOffset(-4) })).toEqual([]);
  });

  it('still recognizes admin and team-leader designations', () => {
    expect(canSetHistoricalCampDates({ designation: 'Administrator' })).toBe(true);
    expect(canSetHistoricalCampDates({ role: 'Admin' })).toBe(true);
    expect(canSetHistoricalCampDates({ designation: 'Team Leader' })).toBe(true);
  });

  it('blocks request dates in the future', () => {
    expect(isFutureRequestDate(isoOffset(0))).toBe(false);
    expect(isFutureRequestDate(isoOffset(-1))).toBe(false);
    expect(isFutureRequestDate(isoOffset(1))).toBe(true);
    expect(getFutureRequestDateError(isoOffset(2))).toMatch(/cannot be in the future/i);
  });

  it('needs RM approval only for dates earlier than today minus 2 days', () => {
    expect(isRequestDateNeedingApproval(isoOffset(-2))).toBe(false);
    expect(isCampDateNeedingApproval(isoOffset(1))).toBe(false);
    expect(isRequestDateNeedingApproval(isoOffset(-3))).toBe(true);
    expect(isCampDateNeedingApproval(isoOffset(-3))).toBe(true);
    expect(campCreateApprovalReasons({ campDate: isoOffset(1), requestDate: isoOffset(-2) })).toEqual([]);
    expect(campCreateApprovalReasons({ campDate: isoOffset(-3), requestDate: isoOffset(0) }))
      .toContain('camp_date_historical');
    expect(campCreateApprovalReasons({ campDate: isoOffset(10), requestDate: isoOffset(-3) }))
      .toContain('request_date_historical');
  });
});
