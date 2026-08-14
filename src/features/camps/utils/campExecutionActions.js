import { campStatusLabel, isExecutionClosedOut, EXECUTION_STATUS } from '../constants/campLifecycle.js';

function isCampAssigned(camp = {}) {
  if (camp.assignmentStatus === 'Assigned') return true;
  if (camp.lifecycleStage === 'execution' && camp.assignmentDecision === 'assign') return true;
  return Boolean(camp.hcwContactId || camp.hcwName);
}

function hasFilled(value) {
  return Boolean(String(value || '').trim());
}

/** Planned → Executed requires Chargeable + In Time + Attire (no timing gate). */
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

  if (
    camp.executionStatus === EXECUTION_STATUS.MARKED_EXECUTED
    || camp.executionStatus === EXECUTION_STATUS.CAMP_COMPLETED
    || camp.status === 'executed'
  ) {
    blockers.push('Camp is already marked executed.');
    return blockers;
  }

  if (!['approved', 'executed'].includes(camp.status) && camp.lifecycleStage !== 'execution') {
    blockers.push('Camp must be approved before execution.');
    return blockers;
  }

  if (!isCampAssigned(camp)) {
    blockers.push('Assign a healthcare worker before marking this camp executed.');
  }

  if (!hasFilled(camp.chargeableStatus)) {
    blockers.push('Select Chargeable Status');
  }
  if (!hasFilled(camp.inTime)) {
    blockers.push('Enter In Time');
  }
  if (!hasFilled(camp.attire)) {
    blockers.push('Select Attire');
  }

  return blockers;
}

export function canMarkCampExecuted(camp = {}) {
  return getExecutionBlockers(camp).length === 0;
}

/** @deprecated Timing gate removed per lifecycle guide. */
export const MARK_EXECUTED_MINUTES_AFTER_START = 0;

export function isMarkExecutedTimingOpen() {
  return true;
}
