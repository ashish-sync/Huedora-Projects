import {
  getAvailableClosureTypes,
  resolveClosureStage,
} from '../constants/campClosure.js';

export function isCampClosed(camp = {}) {
  return ['cancelled', 'rejected'].includes(camp.status);
}

export function isCampInFinancialStage(camp = {}, stage = '') {
  return resolveClosureStage(camp, stage) === 'financial';
}

export function canCancelOrRefuseCamp(camp = {}, { hasPermission, canRejectCamps }, stage = '') {
  if (isCampClosed(camp)) return false;

  const resolvedStage = resolveClosureStage(camp, stage);
  if (resolvedStage === 'financial') return false;

  if (resolvedStage === 'request') {
    return camp.status === 'pending_review' && Boolean(canRejectCamps);
  }

  if (resolvedStage === 'assignment') {
    if (!['approved', 'pending_review'].includes(camp.status)) return false;
    return Boolean(canRejectCamps)
      || hasPermission('camps:cancel')
      || hasPermission('camps:approve');
  }

  if (resolvedStage === 'execution') {
    if (['cancelled', 'rejected', 'executed'].includes(camp.status)) return false;
    return hasPermission('camps:cancel') || hasPermission('camps:approve');
  }

  return false;
}

export function resolveCancelOrRefuseAction() {
  return 'closeCamp';
}

export function cancelOrRefuseLabel(camp = {}, stage = '') {
  const resolvedStage = resolveClosureStage(camp, stage);
  if (resolvedStage === 'request') return 'Refuse camp';
  if (resolvedStage === 'assignment') return 'Cancel or refuse camp';
  return 'Cancel camp';
}

export function closeCampModalCopy(camp = {}, stage = '') {
  const resolvedStage = resolveClosureStage(camp, stage);

  if (resolvedStage === 'request') {
    return {
      title: 'Refuse camp',
      message: '',
      confirmLabel: 'Refuse',
    };
  }

  if (resolvedStage === 'assignment') {
    return {
      title: 'Close camp',
      message: '',
      confirmLabel: 'Confirm',
    };
  }

  return {
    title: 'Cancel camp',
    message: '',
    confirmLabel: 'Confirm',
  };
}

export { getAvailableClosureTypes, resolveClosureStage };
