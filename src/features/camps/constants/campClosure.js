export const CAMP_CLOSURE_TYPES = [
  'Cancelled by TCPL',
  'Refused',
  'Cancelled by Client',
];

export const CAMP_CLOSURE_REASON_CODES = ['1', '2', '3', '4', '5'];

export function buildClosureDetails() {
  return {
    closureType: '',
    reasonCode: '',
  };
}

export function isClosureDetailsReady(details = {}) {
  return Boolean(
    CAMP_CLOSURE_TYPES.includes(details.closureType)
    && CAMP_CLOSURE_REASON_CODES.includes(String(details.reasonCode)),
  );
}

export function formatClosureSummary(camp = {}) {
  if (!camp.closureReasonCode && !camp.cancellationReason) return '';
  const type = camp.assignmentRefusalReason || camp.cancellationReason || '';
  const code = camp.closureReasonCode ? `Reason ${camp.closureReasonCode}` : '';
  return [type, code].filter(Boolean).join(' · ');
}
