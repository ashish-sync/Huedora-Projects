import { describe, expect, it } from 'vitest';
import { isActiveHcwAssignedCamp } from './campHcwAssignmentActive.js';
import { findHcwAssignmentGapConflict } from './hcwAssignmentGap.js';

describe('isActiveHcwAssignedCamp', () => {
  const active = {
    status: 'approved',
    hcwContactId: 'hcw-1',
    assignmentDecision: 'assign',
    assignmentStatus: 'Assigned',
  };

  it('treats cancelled camps as inactive even with stale HCW fields', () => {
    expect(isActiveHcwAssignedCamp({
      ...active,
      status: 'cancelled',
    })).toBe(false);
  });

  it('treats unassigned camps as inactive', () => {
    expect(isActiveHcwAssignedCamp({
      ...active,
      assignmentStatus: 'Unassigned',
      assignmentDecision: 'refuse',
    })).toBe(false);
  });

  it('treats legacy execution Cancelled as inactive', () => {
    expect(isActiveHcwAssignedCamp({
      ...active,
      executionStatus: 'Cancelled',
    })).toBe(false);
  });
});

describe('findHcwAssignmentGapConflict cancelled peers', () => {
  const existing = {
    _id: 'a',
    campId: 'CAMP-A',
    hcwContactId: 'hcw-1',
    assignmentDecision: 'assign',
    assignmentStatus: 'Assigned',
    status: 'approved',
    campDate: '2026-08-15',
    startTime: '08:00',
    endTime: '14:00',
  };

  it('ignores cancelled camps with stale assignment fields', () => {
    expect(findHcwAssignmentGapConflict({
      ...existing,
      _id: 'b',
      campId: 'CAMP-B',
      startTime: '15:00',
      endTime: '18:00',
    }, [{
      ...existing,
      status: 'cancelled',
      assignmentDecision: 'assign',
      assignmentStatus: 'Assigned',
    }])).toBeNull();
  });
});
