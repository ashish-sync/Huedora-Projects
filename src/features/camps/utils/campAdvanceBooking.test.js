import { describe, expect, it } from 'vitest';
import {
  getAdvanceBookingEligibility,
  getAdvanceBookingErrors,
  istWallToUtcMs,
  minCampDateIsoSatisfyingAdvanceBooking,
} from './campAdvanceBooking.js';

function istDate(year, monthIndex, day, hour, minute = 0) {
  return new Date(istWallToUtcMs({
    year,
    month: monthIndex,
    day,
    hour,
    minute,
  }));
}

describe('campAdvanceBooking (client)', () => {
  it('allows Sunday / after-hours submissions and only gates lead time', () => {
    const sunday = istDate(2026, 2, 15, 12, 0);
    expect(
      getAdvanceBookingErrors({ campDate: '2026-03-16', startTime: '10:00' }, sunday),
    ).not.toHaveLength(0);
    expect(
      getAdvanceBookingErrors({ campDate: '2026-03-16', startTime: '10:00' }, sunday)[0],
    ).toMatch(/Insufficient advance notice|working/i);
    expect(
      getAdvanceBookingErrors({ campDate: '2026-03-18', startTime: '12:00' }, sunday),
    ).toEqual([]);
  });

  it('reports eligibility for UI and supports exactly 18 working hours', () => {
    const now = istDate(2026, 2, 18, 11, 0);
    const short = getAdvanceBookingEligibility(
      { campDate: '2026-03-18', startTime: '18:00' },
      now,
    );
    expect(short.ok).toBe(false);
    expect(short.message).toMatch(/Insufficient advance notice/i);

    const exact = getAdvanceBookingErrors(
      { campDate: '2026-03-20', startTime: '11:00' },
      now,
    );
    expect(exact).toEqual([]);
  });

  it('covers Saturday and multi-week cases', () => {
    const saturday = istDate(2026, 2, 21, 16, 0);
    expect(
      getAdvanceBookingErrors({ campDate: '2026-03-24', startTime: '12:00' }, saturday).length,
    ).toBeGreaterThan(0);
    expect(
      getAdvanceBookingErrors({ campDate: '2026-03-25', startTime: '12:00' }, saturday),
    ).toEqual([]);
    expect(minCampDateIsoSatisfyingAdvanceBooking(saturday, '12:00')).toBeTruthy();
  });
});
