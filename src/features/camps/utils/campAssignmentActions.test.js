import { describe, expect, it } from 'vitest';
import { canAssignCamp, getAssignmentBlockers } from './campAssignmentActions.js';

describe('campAssignmentActions', () => {
  it('allows assign for approved unassigned camps', () => {
    const camp = { status: 'approved', assignmentStatus: 'Pending' };
    expect(canAssignCamp(camp)).toBe(true);
    expect(getAssignmentBlockers(camp)).toEqual([]);
  });

  it('blocks assign when camp is not approved', () => {
    const camp = { status: 'pending_review' };
    expect(canAssignCamp(camp)).toBe(false);
    expect(getAssignmentBlockers(camp)[0]).toMatch(/approved/i);
  });

  it('blocks assign when HCW is already assigned', () => {
    const camp = { status: 'approved', assignmentStatus: 'Assigned' };
    expect(canAssignCamp(camp)).toBe(false);
    expect(getAssignmentBlockers(camp)[0]).toMatch(/already assigned/i);
  });
});
