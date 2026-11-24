import { describe, it, expect } from 'vitest';
import {
  approvalRuleLabel,
  canApproveRequestType,
  requiredApproverKeysForType,
} from './requestApproval.js';

describe('requestApproval (client)', () => {
  const can = (perm) => perm === '*';
  const canNone = () => false;

  it('keeps type-matrix helpers for renamed designations', () => {
    expect(canApproveRequestType({ designation: 'Manager' }, canNone, 'REPAIR')).toBe(true);
    expect(canApproveRequestType({ designation: 'Ops Support Team' }, canNone, 'MAINTENANCE')).toBe(
      true
    );
    expect(canApproveRequestType({ designation: 'Operations Leader' }, canNone, 'REPAIR')).toBe(
      true
    );
    expect(canApproveRequestType({ designation: 'Product Manager' }, can, 'REPAIR')).toBe(true);
  });

  it('Option A label is Reporting Manager based', () => {
    expect(approvalRuleLabel('HIRING')).toMatch(/Reporting Manager/);
    expect(approvalRuleLabel('TRAINING')).toMatch(/Business Head/);
    expect(requiredApproverKeysForType('LOGISTICS')).toEqual(['manager']);
  });
});
