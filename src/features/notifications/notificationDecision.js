/** Inbox actions that can be completed without leaving Updates & approvals. */

export function isInboxDecisionSettled(n = {}) {
  return Boolean(n?.meta?.decision || n?.cancelledAt);
}

export function inboxDecisionFor(n = {}) {
  if (!isApprovalRequestNotificationLike(n)) return null;
  if (isInboxDecisionSettled(n)) return null;
  const entityId = String(n.entityId || '').trim();
  if (!entityId) return null;
  const type = String(n.type || '').trim().toUpperCase();

  if (type === 'PICKLIST_SUGGESTION') {
    return {
      approvePath: `/picklists/suggestions/${entityId}/approve`,
      rejectPath: `/picklists/suggestions/${entityId}/reject`,
      rejectLabel: 'Reject',
    };
  }
  if (type === 'CAMP_HCW_GAP_APPROVAL') {
    return {
      approvePath: `/camp-ops/camps/${entityId}/hcw-gap/approve`,
      rejectPath: `/camp-ops/camps/${entityId}/hcw-gap/reject`,
      rejectLabel: 'Refuse',
    };
  }
  if (type === 'CAMP_T2_APPROVAL') {
    return {
      approvePath: `/camp-ops/camps/${entityId}/approve`,
      rejectPath: `/camp-ops/camps/${entityId}/reject`,
      rejectLabel: 'Refuse',
    };
  }
  if (type === 'COMMERCIAL_SUBMIT') {
    return {
      approvePath: `/finance/commercial-documents/${entityId}/approve`,
      rejectPath: `/finance/commercial-documents/${entityId}/reject`,
      rejectLabel: 'Refuse',
    };
  }
  if (type === 'ASSET_REQUEST_APPROVAL' || type === 'MOVEMENT_APPROVAL') {
    return {
      approvePath: `/asset-requests/${entityId}/approve`,
      rejectPath: `/asset-requests/${entityId}/reject`,
      rejectLabel: 'Refuse',
    };
  }
  return null;
}

function isApprovalRequestNotificationLike(n = {}) {
  const type = String(n.type || '').trim().toUpperCase();
  const kind = String(n?.meta?.kind || n?.kind || '').toLowerCase();
  if (kind === 'review' || kind === 'escalate' || kind === 'update') return false;
  if (kind === 'approval') return true;
  return [
    'PICKLIST_SUGGESTION',
    'CAMP_HCW_GAP_APPROVAL',
    'CAMP_T2_APPROVAL',
    'ASSET_CREATE_APPROVAL',
    'COMMERCIAL_SUBMIT',
    'VENDOR_BILL_VERIFIED',
    'ASSET_REQUEST_APPROVAL',
    'MOVEMENT_APPROVAL',
  ].includes(type);
}

export function decisionLabel(decision) {
  const value = String(decision || '').toLowerCase();
  if (value === 'approve' || value === 'approved') return 'Approved';
  if (value === 'reject' || value === 'refuse' || value === 'rejected') return 'Refused';
  return '';
}
