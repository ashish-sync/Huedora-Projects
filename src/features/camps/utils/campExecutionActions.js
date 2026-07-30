import { campStatusLabel, isExecutionClosedOut } from '../constants/campLifecycle.js';

function isCampAssigned(camp = {}) {
  if (camp.assignmentStatus === 'Assigned') return true;
  if (camp.lifecycleStage === 'execution' && camp.assignmentDecision === 'assign') return true;
  return false;
}

export function getExecutionBlockers(camp = {}) {
  const blockers = [];

  if (['cancelled', 'rejected'].includes(camp.status)) {
    blockers.push(`Camp is ${campStatusLabel(camp.status)} and cannot be marked executed.`);
    return blockers;
  }

  if (camp.executionStatus === 'Cancelled' || isExecutionClosedOut(camp.executionStatus)) {
    blockers.push('Camp execution is cancelled or refused.');
    return blockers;
  }

  if (camp.status === 'executed') {
    blockers.push('This camp is already marked executed.');
    return blockers;
  }

  if (camp.status !== 'approved') {
    blockers.push('Camp must be approved before it can be marked executed.');
    return blockers;
  }

  if (!isCampAssigned(camp)) {
    blockers.push('Assign a healthcare worker before marking this camp executed.');
  }

  return blockers;
}

export function canMarkCampExecuted(camp = {}) {
  return getExecutionBlockers(camp).length === 0;
}
