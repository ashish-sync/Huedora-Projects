/**
 * Type-specific primary process actions for Request One (non-hiring).
 * Hiring Assign stays on the fulfill / Contact Directory path.
 */

export const PROCESS_ACTIONS = {
  MASTER_ADD: {
    label: 'Add',
    when: 'REQUESTED',
    usesApprove: true,
  },
  REIMBURSEMENT: {
    label: 'Process',
    when: 'APPROVED',
    usesApprove: false,
  },
  TRAINING: {
    label: 'Schedule',
    when: 'APPROVED',
    usesApprove: false,
  },
  LOGISTICS: {
    label: 'Issue',
    when: 'APPROVED',
    usesApprove: false,
  },
  REPAIR: {
    label: 'Assign',
    when: 'APPROVED',
    usesApprove: false,
  },
  MAINTENANCE: {
    label: 'Assign',
    when: 'APPROVED',
    usesApprove: false,
  },
  SERVICE: {
    label: 'Assign',
    when: 'APPROVED',
    usesApprove: false,
  },
  OTHER: {
    label: 'Complete',
    when: 'APPROVED',
    usesApprove: false,
  },
};

export function processActionForType(requestType) {
  const key = String(requestType || '').toUpperCase();
  return PROCESS_ACTIONS[key] || null;
}

export function canShowProcessAction(row, { mayApprove = false, mayProcess = false } = {}) {
  if (!row || row.requestType === 'HIRING') return false;
  const action = processActionForType(row.requestType);
  if (!action) return false;
  if (action.when === 'REQUESTED') {
    return Boolean(mayApprove && row.status === 'REQUESTED');
  }
  return Boolean(mayProcess && row.status === 'APPROVED');
}

export function emptyProcessForm(row) {
  const type = String(row?.requestType || '').toUpperCase();
  const base = {
    processRemark: '',
    processReference: '',
    processAmount: row?.amount != null && row?.amount !== '' ? String(row.amount) : '',
    scheduledAt: '',
    scheduleVenue: '',
    transportMode: row?.transportMode || '',
    awbNumber: row?.awbNumber || '',
    assigneeName: '',
    assigneeContact: '',
  };
  if (type === 'REIMBURSEMENT') return base;
  return base;
}
