import { describe, it, expect } from 'vitest';
import {
  canActorApproveSubject,
  isApprovalAuthorityExempt,
  isApprovalExemptDesignation,
} from './approvalAuthority.js';

describe('approvalAuthority (client Option A)', () => {
  it('exempts Director, Business Head, and Manager titles', () => {
    expect(isApprovalExemptDesignation('Director')).toBe(true);
    expect(isApprovalExemptDesignation('Business Head')).toBe(true);
    expect(isApprovalExemptDesignation('Senior Manager')).toBe(true);
    expect(isApprovalExemptDesignation('Operations Leader')).toBe(false);
    expect(isApprovalExemptDesignation('Operations Head')).toBe(false);
  });

  it('allows RM or exempt; blocks self for non-exempt', () => {
    const subject = { _id: 'u1', reportingManagerId: 'm1' };
    const canNone = () => false;
    expect(
      canActorApproveSubject({ id: 'u1', designation: 'IC' }, subject, canNone)
    ).toBe(false);
    expect(
      canActorApproveSubject({ id: 'm1', designation: 'IC' }, subject, canNone)
    ).toBe(true);
    expect(
      canActorApproveSubject({ id: 'u1', designation: 'Director' }, subject, canNone)
    ).toBe(true);
    expect(
      canActorApproveSubject({ id: 'other', designation: 'Operations Leader' }, subject, canNone)
    ).toBe(false);
    expect(isApprovalAuthorityExempt({ designation: 'Manager' }, canNone)).toBe(true);
    expect(isApprovalAuthorityExempt({ designation: 'IC' }, (p) => p === '*')).toBe(true);
  });
});
