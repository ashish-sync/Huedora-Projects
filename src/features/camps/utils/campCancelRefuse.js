export function isCampClosed(camp = {}) {
  return ['cancelled', 'rejected'].includes(camp.status);
}

export function isCampInFinancialStage(camp = {}) {
  return String(camp.lifecycleStage || '').trim() === 'financial';
}

export function canCancelOrRefuseCamp(camp = {}, { hasPermission, canRejectCamps }) {
  if (isCampClosed(camp)) return false;
  if (isCampInFinancialStage(camp)) return false;
  if (camp.status === 'pending_review') {
    return Boolean(canRejectCamps);
  }
  return hasPermission('camps:cancel') || hasPermission('camps:approve');
}

export function resolveCancelOrRefuseAction(camp = {}) {
  if (camp.status === 'pending_review') return 'reject';
  return 'closeCamp';
}

export function cancelOrRefuseLabel(camp = {}) {
  if (camp.status === 'pending_review') return 'Reject camp';
  return 'Cancel or refuse camp';
}
