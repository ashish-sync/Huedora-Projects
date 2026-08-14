import {
  getAvailableClosureTypes,
  resolveClosureStage,
} from '../constants/campClosure.js';
import { EXECUTION_STATUS, normalizeExecutionStatus } from '../constants/campLifecycle.js';

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
    // Allow cancel from Planned and Executed until Mark Complete / Financial.
    if (['cancelled', 'rejected'].includes(camp.status)) return false;
    const exec = normalizeExecutionStatus(camp.executionStatus);
    if (exec === EXECUTION_STATUS.CAMP_COMPLETED || camp.status === 'executed') {
      // HueDora executed + Camp Completed = Mark Complete done → no cancel
      if (exec === EXECUTION_STATUS.CAMP_COMPLETED) return false;
    }
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
  if (resolvedStage === 'assignment') return 'Refuse camp';
  return 'Cancel camp';
}

export function closeCampModalCopy(camp = {}, stage = '') {
  const resolvedStage = resolveClosureStage(camp, stage);

  if (resolvedStage === 'request' || resolvedStage === 'assignment') {
    return {
      title: 'Refuse camp',
      message: '',
      confirmLabel: 'Refuse',
    };
  }

  return {
    title: 'Cancel camp',
    message: '',
    confirmLabel: 'Confirm',
  };
}

export { getAvailableClosureTypes, resolveClosureStage };
