export const CAMP_CLOSURE_TYPES = [
  'Cancelled by Client',
  'Refused',
  'Cancelled by TCPL',
];

export const CAMP_CLOSURE_TAXONOMY = {
  'Cancelled by Client': {
    'Client Decision': [
      { value: 'client_cancelled', label: 'Client Cancelled' },
      { value: 'client_rescheduled', label: 'Client Rescheduled' },
    ],
  },
  Refused: {
    'Request Issue': [
      { value: 'other_request_issues', label: 'Other Request Issues' },
      { value: 'duplicate_request', label: 'Duplicate Request' },
      { value: 'delayed_confirmation', label: 'Delayed Confirmation' },
      { value: 'short_notice', label: 'Short Notice' },
      { value: 'non_serviceable_hq', label: 'Non Serviceable HQ' },
    ],
  },
  'Cancelled by TCPL': {
    'Resource Issue': [
      { value: 'hcw_unavailability', label: 'HCW Unavailability' },
      { value: 'hcw_backout', label: 'HCW Backout' },
    ],
    'Operational Issue': [
      { value: 'punctuality', label: 'Punctuality' },
      { value: 'compliance_knowledge', label: 'Compliance & Knowledge' },
      { value: 'grooming_issue', label: 'Grooming Issue' },
    ],
    'Device & Inventory': [
      { value: 'device_failure', label: 'Device Failure' },
      { value: 'inventory_shortage', label: 'Inventory Shortage' },
      { value: 'missing_consumables', label: 'Missing Consumables' },
    ],
    'External Factors': [
      { value: 'adverse_weather', label: 'Adverse Weather' },
      { value: 'force_majeure', label: 'Force Majeure' },
    ],
    Other: [
      { value: 'other_mandatory_remarks', label: 'Other (Mandatory Remarks)' },
    ],
  },
};

export const CAMP_CLOSURE_DESCRIPTIONS = {
  'Cancelled by Client': 'The client requested cancellation.',
  Refused: 'Camp request is refused and will not proceed.',
  'Cancelled by TCPL': 'KHW / TCPL cancelled this camp.',
};

export function isCampHcwAssigned(camp = {}) {
  if (camp.assignmentStatus === 'Assigned') return true;
  if (camp.hcwContactId) return true;
  if (camp.assignmentDecision === 'assign' && (camp.hcwName || camp.hcwContact)) return true;
  if (camp.lifecycleStage === 'execution' && camp.assignmentDecision === 'assign') return true;
  return false;
}

export function resolveClosureStage(camp = {}, explicitStage = '') {
  return String(explicitStage || camp.lifecycleStage || 'request').trim();
}

export function getAvailableClosureTypes(camp = {}, stage = '') {
  const resolvedStage = resolveClosureStage(camp, stage);

  if (resolvedStage === 'financial') return [];

  if (resolvedStage === 'execution') {
    return ['Cancelled by TCPL', 'Cancelled by Client'];
  }

  if (resolvedStage === 'assignment') {
    return ['Refused', 'Cancelled by TCPL', 'Cancelled by Client'];
  }

  return ['Refused'];
}

export function getClosureReasonCategories(closureType, camp = {}, stage = '') {
  const allowedTypes = getAvailableClosureTypes(camp, stage);
  if (!allowedTypes.includes(closureType)) return [];
  const tree = CAMP_CLOSURE_TAXONOMY[closureType];
  return tree ? Object.keys(tree) : [];
}

export function hasSingleClosureReasonCategory(closureType, camp = {}, stage = '') {
  return getClosureReasonCategories(closureType, camp, stage).length === 1;
}

export function resolveClosureReasonCategory(closureType, reasonCategory = '', camp = {}, stage = '') {
  const categories = getClosureReasonCategories(closureType, camp, stage);
  const selected = String(reasonCategory || '').trim();
  if (selected && categories.includes(selected)) return selected;
  if (categories.length === 1) return categories[0];
  return '';
}

export function getClosureSubReasons(closureType, reasonCategory) {
  const tree = CAMP_CLOSURE_TAXONOMY[closureType];
  if (!tree || !reasonCategory) return [];
  return tree[reasonCategory] || [];
}

export function findClosureSubReason(closureType, reasonCategory, subReasonValue) {
  return getClosureSubReasons(closureType, reasonCategory)
    .find((item) => item.value === subReasonValue) || null;
}

export function closureSubReasonRequiresRemarks(subReasonValue) {
  return subReasonValue === 'other_mandatory_remarks';
}

export function buildClosureDetails(camp = {}, stage = '') {
  const availableTypes = getAvailableClosureTypes(camp, stage);
  const closureType = availableTypes.length === 1 ? availableTypes[0] : '';
  return {
    closureType,
    reasonCategory: closureType
      ? resolveClosureReasonCategory(closureType, '', camp, stage)
      : '',
    subReason: '',
    remarks: '',
  };
}

export function isClosureDetailsReady(details = {}, camp = {}, stage = '') {
  const closureType = String(details.closureType || '').trim();
  const reasonCategory = resolveClosureReasonCategory(
    closureType,
    details.reasonCategory,
    camp,
    stage,
  );
  const subReason = String(details.subReason || '').trim();
  if (!getAvailableClosureTypes(camp, stage).includes(closureType)) return false;
  if (!reasonCategory) return false;
  if (!findClosureSubReason(closureType, reasonCategory, subReason)) return false;
  if (closureSubReasonRequiresRemarks(subReason) && !String(details.remarks || '').trim()) {
    return false;
  }
  return true;
}

export function buildClosurePayload(details = {}) {
  const reasonCategory = resolveClosureReasonCategory(
    details.closureType,
    details.reasonCategory,
  );
  const subReasonMeta = findClosureSubReason(
    details.closureType,
    reasonCategory,
    details.subReason,
  );
  return {
    closureType: details.closureType,
    reasonCategory,
    subReason: details.subReason,
    reasonCode: details.subReason,
    closureReasonCode: details.subReason,
    closureRemarks: String(details.remarks || '').trim(),
    subReasonLabel: subReasonMeta?.label || '',
  };
}

export function formatClosureSummary(camp = {}) {
  const type = camp.assignmentRefusalReason || camp.closureType || '';
  const category = camp.closureReasonCategory || '';
  const subReason = camp.closureSubReasonLabel
    || findClosureSubReason(type, category, camp.closureReasonCode || camp.closureSubReason)?.label
    || camp.closureReasonCode
    || '';
  if (!type && !subReason && !camp.cancellationReason) return '';
  return [type, category, subReason].filter(Boolean).join(' · ');
}
