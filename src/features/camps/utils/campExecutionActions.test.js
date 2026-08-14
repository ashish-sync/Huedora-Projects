import { describe, expect, it } from 'vitest';
import { canMarkCampExecuted, getExecutionBlockers } from './campExecutionActions.js';

const now = new Date('2026-08-03T10:00:00');

const approvedAssignedCamp = {
  status: 'approved',
  assignmentStatus: 'Assigned',
  lifecycleStage: 'execution',
  executionStatus: 'Ongoing',
  chargeableStatus: 'Chargeable',
  inTime: '09:05',
  attire: 'No Issues',
  campDate: '2026-08-03',
  startTime: '09:00',
};

describe('campExecutionActions', () => {
  it('allows mark executed when required fields are filled (no timing gate)', () => {
    expect(canMarkCampExecuted(approvedAssignedCamp, now)).toBe(true);
    expect(getExecutionBlockers(approvedAssignedCamp, now)).toEqual([]);
  });

  it('greys out mark executed until Chargeable Status, In Time, and Attire are filled', () => {
    expect(canMarkCampExecuted({ ...approvedAssignedCamp, chargeableStatus: '' }, now)).toBe(false);
    expect(getExecutionBlockers({ ...approvedAssignedCamp, chargeableStatus: '' }, now))
      .toContain('Select Chargeable Status');

    expect(canMarkCampExecuted({ ...approvedAssignedCamp, inTime: '' }, now)).toBe(false);
    expect(getExecutionBlockers({ ...approvedAssignedCamp, inTime: '' }, now))
      .toContain('Enter In Time');

    expect(canMarkCampExecuted({ ...approvedAssignedCamp, attire: '' }, now)).toBe(false);
    expect(getExecutionBlockers({ ...approvedAssignedCamp, attire: '' }, now))
      .toContain('Select Attire');

    const missingAll = {
      ...approvedAssignedCamp,
      chargeableStatus: '',
      inTime: '',
      attire: '',
    };
    expect(getExecutionBlockers(missingAll, now)).toEqual([
      'Select Chargeable Status',
      'Enter In Time',
      'Select Attire',
    ]);
  });

  it('does not require waiting 30 minutes after camp start time', () => {
    const tooEarly = new Date('2026-08-03T09:20:00');
    expect(canMarkCampExecuted(approvedAssignedCamp, tooEarly)).toBe(true);
    expect(getExecutionBlockers(approvedAssignedCamp, tooEarly)).toEqual([]);
  });

  it('blocks cancelled or refused execution statuses', () => {
    expect(canMarkCampExecuted({ ...approvedAssignedCamp, executionStatus: 'Cancelled' }, now)).toBe(false);
    expect(canMarkCampExecuted({ ...approvedAssignedCamp, executionStatus: 'Refused' }, now)).toBe(false);
    expect(getExecutionBlockers({ ...approvedAssignedCamp, executionStatus: 'Refused' }, now)[0])
      .toMatch(/cancelled or refused/i);
  });

  it('blocks camps that are not approved', () => {
    const camp = { status: 'pending_review', assignmentStatus: 'Assigned' };
    expect(canMarkCampExecuted(camp, now)).toBe(false);
    expect(getExecutionBlockers(camp, now)[0]).toMatch(/approved/i);
  });

  it('blocks camps without an assigned HCW', () => {
    const camp = { status: 'approved', assignmentStatus: 'Pending', lifecycleStage: 'assignment' };
    expect(canMarkCampExecuted(camp, now)).toBe(false);
    expect(getExecutionBlockers(camp, now)[0]).toMatch(/assign a healthcare worker/i);
  });

  it('blocks camps already marked executed', () => {
    const camp = { ...approvedAssignedCamp, status: 'executed' };
    expect(canMarkCampExecuted(camp, now)).toBe(false);
    expect(getExecutionBlockers(camp, now)[0]).toMatch(/already marked executed/i);
  });
});
