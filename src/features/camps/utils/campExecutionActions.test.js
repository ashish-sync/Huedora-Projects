import { describe, expect, it } from 'vitest';
import { canMarkCampExecuted, getExecutionBlockers } from './campExecutionActions.js';

const approvedAssignedCamp = {
  status: 'approved',
  assignmentStatus: 'Assigned',
  lifecycleStage: 'execution',
  executionStatus: 'Ongoing',
};

describe('campExecutionActions', () => {
  it('allows mark executed for approved assigned camps', () => {
    expect(canMarkCampExecuted(approvedAssignedCamp)).toBe(true);
    expect(getExecutionBlockers(approvedAssignedCamp)).toEqual([]);
  });

  it('blocks cancelled or refused execution statuses', () => {
    expect(canMarkCampExecuted({ ...approvedAssignedCamp, executionStatus: 'Cancelled' })).toBe(false);
    expect(canMarkCampExecuted({ ...approvedAssignedCamp, executionStatus: 'Refused' })).toBe(false);
    expect(getExecutionBlockers({ ...approvedAssignedCamp, executionStatus: 'Refused' })[0])
      .toMatch(/cancelled or refused/i);
  });

  it('blocks camps that are not approved', () => {
    const camp = { status: 'pending_review', assignmentStatus: 'Assigned' };
    expect(canMarkCampExecuted(camp)).toBe(false);
    expect(getExecutionBlockers(camp)[0]).toMatch(/approved/i);
  });

  it('blocks camps without an assigned HCW', () => {
    const camp = { status: 'approved', assignmentStatus: 'Pending', lifecycleStage: 'assignment' };
    expect(canMarkCampExecuted(camp)).toBe(false);
    expect(getExecutionBlockers(camp)[0]).toMatch(/assign a healthcare worker/i);
  });

  it('blocks camps already marked executed', () => {
    const camp = { ...approvedAssignedCamp, status: 'executed' };
    expect(canMarkCampExecuted(camp)).toBe(false);
    expect(getExecutionBlockers(camp)[0]).toMatch(/already marked executed/i);
  });
});
