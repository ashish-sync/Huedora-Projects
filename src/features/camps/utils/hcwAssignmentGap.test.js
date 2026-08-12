import { describe, expect, it } from 'vitest';
import { findHcwAssignmentGapConflict, getHcwAssignmentGapError } from './hcwAssignmentGap.js';

const existing = {
  _id: 'a',
  campId: 'CAMP-A',
  hcwContactId: 'hcw-1',
  assignmentDecision: 'assign',
  status: 'approved',
  campDate: '2026-08-15',
  startTime: '08:00',
  endTime: '14:00',
  pincode: '641045',
};

describe('findHcwAssignmentGapConflict', () => {
  it('allows 15:30 after a 14:00 end', () => {
    expect(findHcwAssignmentGapConflict({
      ...existing,
      _id: 'b',
      campId: 'CAMP-B',
      startTime: '15:30',
      endTime: '18:00',
    }, [existing])).toBeNull();
  });

  it('returns structured details before 15:30', () => {
    const conflict = findHcwAssignmentGapConflict({
      ...existing,
      _id: 'b',
      campId: 'CAMP-B',
      startTime: '15:00',
      endTime: '18:00',
    }, [existing]);
    expect(conflict).toMatchObject({
      title: 'HCW Schedule Conflict',
      campId: 'CAMP-A',
      pincode: '641045',
      earliestStartTime: '15:30',
      earliestStartLabel: '3:30 PM',
      timeRangeLabel: '8:00 AM – 2:00 PM',
      endsAtLabel: '2:00 PM',
    });
    expect(conflict.message).toMatch(
      /HCW Schedule Conflict: This HCW has another camp scheduled until 2:00 PM\. A mandatory 1h 30m gap is required, so the earliest available start time is 3:30 PM\./,
    );
  });

  it('labels overnight conflicting camps clearly', () => {
    const overnight = {
      ...existing,
      startTime: '11:50',
      endTime: '05:00',
    };
    const conflict = findHcwAssignmentGapConflict({
      ...existing,
      _id: 'b',
      campId: 'CAMP-B',
      startTime: '12:00',
      endTime: '15:00',
    }, [overnight]);
    expect(conflict).toMatchObject({
      campId: 'CAMP-A',
      timeRangeLabel: '11:50 AM – 5:00 AM (next day)',
      earliestStartLabel: '6:30 AM (next day)',
    });
  });
});

describe('getHcwAssignmentGapError', () => {
  it('returns message string for blocked assignment', () => {
    const error = getHcwAssignmentGapError({
      ...existing,
      _id: 'b',
      campId: 'CAMP-B',
      startTime: '15:00',
      endTime: '18:00',
    }, [existing]);
    expect(error).toMatch(/earliest available start time is 3:30 PM/);
  });
});
