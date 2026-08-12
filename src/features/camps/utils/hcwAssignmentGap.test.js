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
  it('allows 14:30 after a 14:00 end', () => {
    expect(findHcwAssignmentGapConflict({
      ...existing,
      _id: 'b',
      campId: 'CAMP-B',
      startTime: '14:30',
      endTime: '18:00',
    }, [existing])).toBeNull();
  });

  it('returns soft warning details before 14:30', () => {
    const conflict = findHcwAssignmentGapConflict({
      ...existing,
      _id: 'b',
      campId: 'CAMP-B',
      startTime: '14:15',
      endTime: '18:00',
    }, [existing]);
    expect(conflict).toMatchObject({
      title: 'HCW Schedule Conflict',
      softWarning: true,
      campId: 'CAMP-A',
      pincode: '641045',
      earliestStartTime: '14:30',
      earliestStartLabel: '2:30 PM',
      timeRangeLabel: '8:00 AM – 2:00 PM',
      endsAtLabel: '2:00 PM',
      gapMinutes: 30,
    });
    expect(conflict.message).toMatch(
      /HCW Schedule Conflict: This HCW has another camp scheduled until 2:00 PM\. A 30m gap is recommended, so the earliest available start time is 2:30 PM\./,
    );
    expect(conflict.approvalMessage).toMatch(/Reporting Manager/);
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
      earliestStartLabel: '5:30 AM (next day)',
    });
  });
});

describe('getHcwAssignmentGapError', () => {
  it('returns message string for gap warning', () => {
    const error = getHcwAssignmentGapError({
      ...existing,
      _id: 'b',
      campId: 'CAMP-B',
      startTime: '14:15',
      endTime: '18:00',
    }, [existing]);
    expect(error).toMatch(/earliest available start time is 2:30 PM/);
  });
});
