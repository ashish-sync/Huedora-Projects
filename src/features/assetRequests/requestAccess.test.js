import { describe, expect, it } from 'vitest';
import {
  canCancelRequest,
  canProcessRequestType,
  canViewRequest,
  cancelRequiresRemark,
  isDirectManagerOfRequestor,
  managePermissionForType,
} from './requestAccess.js';

describe('requestAccess client mirror', () => {
  const canFor = (perms) => (key) => perms.includes('*') || perms.includes(key);

  it('maps hiring and finance to isolated manage keys', () => {
    expect(managePermissionForType('HIRING')).toBe('asset-requests:hiring:manage');
    expect(managePermissionForType('REIMBURSEMENT')).toBe('asset-requests:finance:manage');
    expect(managePermissionForType('MASTER_ADD')).toBeNull();
  });

  it('Scenario 1 / 2 isolation: recruiter ≠ accounts across types', () => {
    const hiring = {
      requestType: 'HIRING',
      requestorId: { _id: 'u-rishu', reportingManagerId: 'u-rm' },
    };
    const finance = {
      requestType: 'REIMBURSEMENT',
      requestorId: { _id: 'u-rasika', reportingManagerId: 'u-rm2' },
    };
    const recruiter = { id: 'u-rasika-hr', systemRole: 'User' };
    const accounts = { id: 'u-accounts', systemRole: 'User' };
    const hireCan = canFor(['asset-requests:hiring:manage']);
    const accountsCan = canFor(['asset-requests:finance:manage']);

    expect(canViewRequest(recruiter, hireCan, hiring)).toBe(true);
    expect(canProcessRequestType(recruiter, hireCan, 'HIRING')).toBe(true);
    expect(canViewRequest(accounts, accountsCan, hiring)).toBe(false);

    expect(canViewRequest(accounts, accountsCan, finance)).toBe(true);
    expect(canProcessRequestType(accounts, accountsCan, 'REIMBURSEMENT')).toBe(true);
    expect(canViewRequest(recruiter, hireCan, finance)).toBe(false);
    expect(canProcessRequestType(recruiter, hireCan, 'REIMBURSEMENT')).toBe(false);
  });

  it('includes Reporting Manager in view, not process/cancel', () => {
    const row = {
      requestType: 'HIRING',
      requestorId: { _id: 'u-rishu', reportingManagerId: 'u-rm' },
    };
    const rm = { id: 'u-rm', systemRole: 'User' };
    const can = canFor(['asset-requests:request']);
    expect(isDirectManagerOfRequestor(rm, row)).toBe(true);
    expect(canViewRequest(rm, can, row)).toBe(true);
    expect(canCancelRequest(rm, can, row)).toBe(false);
    expect(canProcessRequestType(rm, can, 'HIRING')).toBe(false);
  });

  it('requires remark when creator cancels', () => {
    const creator = { id: 'u-1', systemRole: 'User' };
    const row = { requestType: 'HIRING', requestorId: 'u-1' };
    expect(cancelRequiresRemark(creator, row)).toBe(true);
  });

  it('does not let asset-requests:approve process any type', () => {
    const can = canFor(['asset-requests:approve']);
    expect(canProcessRequestType({ id: 'u-1' }, can, 'HIRING')).toBe(false);
    expect(canProcessRequestType({ id: 'u-1' }, can, 'REIMBURSEMENT')).toBe(false);
  });
});
