import { describe, expect, it } from 'vitest';
import {
  categoryLabel,
  isApprovalRequestNotification,
  notificationEntityPath,
  priorityLabel,
} from './notificationLinks.js';

describe('notificationLinks', () => {
  it('deep-links camp entities to manage edit', () => {
    expect(
      notificationEntityPath({
        entityType: 'camp_ops_camp',
        entityId: 'abc123',
      }),
    ).toBe('/camp-one/manage/abc123/edit');
  });

  it('deep-links bulk camp summaries to manage list', () => {
    expect(
      notificationEntityPath({
        type: 'CAMP_BULK_SUCCESS',
        meta: { deepLinkHint: 'camp_manage' },
      }),
    ).toBe('/camp-one/manage');
  });

  it('labels categories and severity', () => {
    expect(categoryLabel({ type: 'CAMP_BULK_PARTIAL', module: 'camp' })).toBe('Bulk action');
    expect(categoryLabel({ type: 'CAMP_REVIEW_OVERDUE', module: 'camp' })).toBe('Approval');
    expect(categoryLabel({ type: 'CAMP_APPROVED', module: 'camp' })).toBe('Camp');
    expect(priorityLabel('critical')).toBe('Critical');
  });

  it('deep-links picklist suggestions to Master One approvals', () => {
    expect(
      notificationEntityPath({
        entityType: 'PicklistSuggestion',
        entityId: 'sug1',
      }),
    ).toBe('/master-one?scope=document&entity=picklist-approvals');
  });

  it('separates approval requests from status updates', () => {
    expect(
      isApprovalRequestNotification({
        type: 'CAMP_REVIEW',
        title: 'Camp 1702 needs review',
      }),
    ).toBe(true);
    expect(
      isApprovalRequestNotification({
        type: 'ASSET_REQUEST_APPROVAL',
        title: 'Hiring request HR-1 needs approval',
      }),
    ).toBe(true);
    expect(
      isApprovalRequestNotification({
        type: 'ASSET_REQUEST_APPROVAL',
        title: 'Hiring request HR-1 approved',
        meta: { kind: 'update' },
      }),
    ).toBe(false);
    expect(
      isApprovalRequestNotification({
        type: 'ASSET_REQUEST_APPROVAL',
        title: 'Weird title without cue',
        meta: { kind: 'approval' },
      }),
    ).toBe(true);
    expect(
      isApprovalRequestNotification({
        type: 'MOVEMENT_APPROVAL',
        title: 'Movement M-9 approved',
      }),
    ).toBe(false);
    expect(
      isApprovalRequestNotification({
        type: 'PICKLIST_SUGGESTION',
        title: 'New dropdown value needs approval',
      }),
    ).toBe(true);
  });
});
