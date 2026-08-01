import { describe, expect, it } from 'vitest';
import {
  canSetHistoricalCampDates,
  getHistoricalCampDateErrors,
  isHistoricalCampDate,
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

  it('blocks non-leaders from historical dates', () => {
    const errors = getHistoricalCampDateErrors(
      { campDate: isoOffset(-5) },
      { canSetHistorical: false },
    );
    expect(errors[0]).toMatch(/Team Leaders/);
  });

  it('does not grant historical dates to admin role without team leader designation', () => {
    expect(canSetHistoricalCampDates({ designation: 'Administrator' })).toBe(false);
  });

  it('allows team leaders', () => {
    expect(canSetHistoricalCampDates({ designation: 'Team Leader' })).toBe(true);
  });
});
