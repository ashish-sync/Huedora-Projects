import { describe, it, expect } from 'vitest';
import {
  approvalRuleLabel,
  canApproveRequestType,
  requiredApproverKeysForType,
} from './requestApproval.js';

describe('requestApproval (client)', () => {
  const can = (perm) => perm === '*';
  const canNone = () => false;

  it('lets either ops or training approve Repair & Service once', () => {
    expect(canApproveRequestType({ designation: 'Operations Leader' }, canNone, 'REPAIR')).toBe(
      true
    );
    expect(canApproveRequestType({ designation: 'Training Manager' }, canNone, 'MAINTENANCE')).toBe(
      true
    );
    expect(canApproveRequestType({ designation: 'Manager' }, canNone, 'REPAIR')).toBe(false);
    expect(canApproveRequestType({ designation: 'Manager' }, can, 'REPAIR')).toBe(true);
  });

  it('maps types to rules', () => {
    expect(requiredApproverKeysForType('LOGISTICS')).toEqual(['operations leader']);
    expect(requiredApproverKeysForType('TRAINING')).toEqual(['training manager']);
    expect(approvalRuleLabel('HIRING')).toMatch(/Operations Leader/);
  });
});
