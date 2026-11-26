/** Client helpers for Request One progress + update log (all request types). */

/** Progress values a processor can set from Update status (non-closing). */
export const HIRING_PROGRESS_OPTIONS = [
  { value: 'IN_PROGRESS', label: 'Accepted' },
  { value: 'AWAITING_INFO', label: 'Clarification' },
  { value: 'ON_HOLD', label: 'On hold' },
];

/** Hiring-only close option via Update status (alongside Assign). */
export const HIRING_CLOSE_PROGRESS_OPTION = {
  value: 'HCW_EXISTS',
  label: 'HCW Exists',
};

const HIRING_PROGRESS_LABELS = {
  OPEN: 'Requested',
  IN_PROGRESS: 'Accepted',
  AWAITING_INFO: 'Clarification',
  SHORTLISTING: 'Accepted',
  ON_HOLD: 'On hold',
  HCW_EXISTS: 'HCW Exists',
  FULFILLED: 'Assigned',
};

export const HIRING_UPDATE_KIND_OPTIONS = [
  { value: 'STATUS', label: 'Update status' },
  { value: 'CLARIFICATION', label: 'Ask clarification' },
];

export function hiringProgressOptionsForType(requestType) {
  if (String(requestType || '').toUpperCase() === 'HIRING') {
    return [...HIRING_PROGRESS_OPTIONS, HIRING_CLOSE_PROGRESS_OPTION];
  }
  return HIRING_PROGRESS_OPTIONS;
}

export function hiringProgressLabel(value) {
  const key = String(value || '').toUpperCase();
  return HIRING_PROGRESS_LABELS[key] || value || 'Requested';
}

/**
 * Single Status-column label for Request One rows.
 * Workflow progress drives Accepted / Clarification / On hold;
 * terminal request statuses win (Refused / Assigned / HCW Exists / Closed).
 */
export function requestDisplayStatus(row) {
  const status = String(row?.status || '').toUpperCase();
  if (status === 'REJECTED' || status === 'CANCELLED') {
    return { label: 'Refused', tone: 'danger' };
  }

  const progress = String(row?.hiringProgress || 'OPEN').toUpperCase();
  const isHiring = row?.requestType === 'HIRING';

  if (progress === 'HCW_EXISTS') return { label: 'HCW Exists', tone: 'ok' };
  if (status === 'COMPLETED' || progress === 'FULFILLED') {
    return { label: isHiring ? 'Assigned' : 'Closed', tone: 'ok' };
  }
  if (progress === 'AWAITING_INFO') return { label: 'Clarification', tone: 'warn' };
  if (progress === 'ON_HOLD') return { label: 'On hold', tone: 'warn' };
  if (progress === 'IN_PROGRESS' || progress === 'SHORTLISTING') {
    return { label: 'Accepted', tone: 'info' };
  }
  if (status === 'APPROVED') return { label: 'Accepted', tone: 'info' };
  if (status === 'REQUESTED') return { label: 'Requested', tone: 'neutral' };
  return { label: status || 'Requested', tone: 'neutral' };
}

export function hiringUpdatesOf(row) {
  return Array.isArray(row?.hiringUpdates) ? row.hiringUpdates : [];
}

export function hasOpenClarification(row) {
  return hiringUpdatesOf(row).some(
    (entry) => entry?.kind === 'CLARIFICATION' && entry?.requiresReply && !entry?.resolvedAt
  );
}

/** Requestor may reply (and hiring creators may edit details) while clarification is open. */
export function canCreatorEditHiringDetails(row) {
  if (!row) return false;
  if (!['REQUESTED', 'APPROVED'].includes(row.status)) return false;
  if (String(row.hiringProgress || '').toUpperCase() === 'AWAITING_INFO') return true;
  return hasOpenClarification(row);
}

export function hiringUpdateKindLabel(kind) {
  const map = {
    STATUS: 'Status',
    UPDATE: 'Update',
    CLARIFICATION: 'Clarification',
    REPLY: 'Reply',
  };
  return map[String(kind || '').toUpperCase()] || kind || 'Note';
}
