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

const TRANSPORT_MODES = ['Courier', 'Porter', 'Hand Delivery'];
const TRANSPORT_MODE_ALIASES = {
  Fragile: 'Courier',
  'Air Delivery': 'Courier',
  'Blue Dart': 'Courier',
  DTDC: 'Courier',
  'Regular Courier': 'Courier',
  'Other Courier': 'Courier',
  'Hand-carry': 'Hand Delivery',
};

export function normalizeProcessTransportMode(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (TRANSPORT_MODES.includes(s)) return s;
  if (TRANSPORT_MODE_ALIASES[s]) return TRANSPORT_MODE_ALIASES[s];
  const aliasHit = Object.entries(TRANSPORT_MODE_ALIASES).find(
    ([k]) => k.toLowerCase() === s.toLowerCase()
  );
  if (aliasHit) return aliasHit[1];
  const canon = TRANSPORT_MODES.find((m) => m.toLowerCase() === s.toLowerCase());
  return canon || '';
}

/** Product lines still waiting on Movement One issue before Request One can close. */
export function logisticsUnfulfilledLineIds(row) {
  const products = Array.isArray(row?.logisticsProducts) ? row.logisticsProducts : [];
  const lineIds = products
    .map((item) => String(item?.lineId || '').trim())
    .filter(Boolean);
  if (!lineIds.length) return [];
  const fulfilled = new Set(
    (Array.isArray(row?.fulfilledLineIds) ? row.fulfilledLineIds : []).map((id) =>
      String(id || '').trim()
    )
  );
  return lineIds.filter((id) => !fulfilled.has(id));
}

export function emptyProcessForm(row) {
  const type = String(row?.requestType || '').toUpperCase();
  const base = {
    processRemark: '',
    processReference: '',
    processAmount: row?.amount != null && row?.amount !== '' ? String(row.amount) : '',
    scheduledAt: '',
    scheduleVenue: '',
    transportMode: normalizeProcessTransportMode(row?.transportMode),
    awbNumber: row?.awbNumber || '',
    assigneeName: '',
    assigneeContact: '',
  };
  if (type === 'REIMBURSEMENT') return base;
  return base;
}
