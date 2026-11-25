import { describe, expect, it } from 'vitest';
import {
  canShowProcessAction,
  emptyProcessForm,
  processActionForType,
} from './requestProcessActions.js';

describe('requestProcessActions', () => {
  it('maps labels and when by type', () => {
    expect(processActionForType('MASTER_ADD')).toMatchObject({
      label: 'Add',
      when: 'REQUESTED',
      usesApprove: true,
    });
    expect(processActionForType('REIMBURSEMENT').label).toBe('Process');
    expect(processActionForType('TRAINING').label).toBe('Schedule');
    expect(processActionForType('LOGISTICS').label).toBe('Issue');
    expect(processActionForType('REPAIR').label).toBe('Assign');
    expect(processActionForType('OTHER').label).toBe('Complete');
    expect(processActionForType('HIRING')).toBeNull();
  });

  it('shows Master Add on REQUESTED for approvers', () => {
    expect(
      canShowProcessAction(
        { requestType: 'MASTER_ADD', status: 'REQUESTED' },
        { mayApprove: true }
      )
    ).toBe(true);
    expect(
      canShowProcessAction(
        { requestType: 'MASTER_ADD', status: 'REQUESTED' },
        { mayApprove: false }
      )
    ).toBe(false);
  });

  it('shows type process actions on APPROVED for processors', () => {
    expect(
      canShowProcessAction(
        { requestType: 'OTHER', status: 'APPROVED' },
        { mayProcess: true }
      )
    ).toBe(true);
    expect(
      canShowProcessAction(
        { requestType: 'OTHER', status: 'REQUESTED' },
        { mayProcess: true, mayApprove: true }
      )
    ).toBe(false);
  });

  it('pre-fills logistics delivery mode and AWB on Issue form', () => {
    const form = emptyProcessForm({
      requestType: 'LOGISTICS',
      transportMode: 'Courier',
      awbNumber: '',
    });
    expect(form.transportMode).toBe('Courier');
    expect(form.awbNumber).toBe('');
  });
});
