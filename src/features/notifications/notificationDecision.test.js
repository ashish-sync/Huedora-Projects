import { describe, expect, it } from 'vitest';
import {
  decisionLabel,
  inboxDecisionFor,
  isInboxDecisionSettled,
} from './notificationDecision.js';

describe('notificationDecision', () => {
  it('exposes approve/refuse for picklist and HCW gap approvals', () => {
    expect(inboxDecisionFor({
      type: 'PICKLIST_SUGGESTION',
      entityId: 'sug-1',
      kind: 'approval',
    })).toEqual({
      approvePath: '/picklists/suggestions/sug-1/approve',
      rejectPath: '/picklists/suggestions/sug-1/reject',
      rejectLabel: 'Reject',
    });
    expect(inboxDecisionFor({
      type: 'CAMP_HCW_GAP_APPROVAL',
      entityId: 'camp-9',
      title: 'Camp 26-10-1779 needs approval — HCW gap under 30 minutes',
    })).toEqual({
      approvePath: '/camp-ops/camps/camp-9/hcw-gap/approve',
      rejectPath: '/camp-ops/camps/camp-9/hcw-gap/reject',
      rejectLabel: 'Refuse',
    });
  });

  it('hides actions after a decision is recorded', () => {
    expect(isInboxDecisionSettled({ meta: { decision: 'approve' } })).toBe(true);
    expect(inboxDecisionFor({
      type: 'PICKLIST_SUGGESTION',
      entityId: 'sug-1',
      meta: { decision: 'approve' },
    })).toBeNull();
    expect(decisionLabel('approve')).toBe('Approved');
    expect(decisionLabel('refuse')).toBe('Refused');
  });
});
