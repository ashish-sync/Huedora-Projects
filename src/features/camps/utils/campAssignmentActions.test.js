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

  it('allows changing HCW after assignment', () => {
    const camp = { status: 'approved', assignmentStatus: 'Assigned', assignmentDecision: 'assign' };
    expect(canAssignCamp(camp)).toBe(true);
    expect(getAssignmentBlockers(camp)).toEqual([]);
  });

  it('blocks HCW change after Finance submit', () => {
    const camp = {
      status: 'approved',
      assignmentStatus: 'Assigned',
      submittedToFinanceAt: '2026-08-10T00:00:00.000Z',
    };
    expect(canAssignCamp(camp)).toBe(false);
    expect(getAssignmentBlockers(camp)[0]).toMatch(/finance/i);
  });
});
