import { daysFromToday } from './campDatePolicy.js';

/** Assigned camps move into Execution immediately after assignment. */
export const EXECUTION_ADVANCE_DAYS_BEFORE = 0;

export function isCampAssigned(camp = {}) {
  if (camp.assignmentStatus === 'Assigned') return true;
  if (camp.lifecycleStage === 'execution' && camp.assignmentDecision === 'assign') return true;
  return false;
}

export function isCampDateDueForExecution(camp = {}, now = new Date()) {
  if (String(camp?.lifecycleStage || '').trim() === 'execution') return true;
  if (!isCampAssigned(camp)) return false;
  const campDate = String(camp?.campDate || '').trim();
  if (!campDate) return true;
  return daysFromToday(campDate, now) <= EXECUTION_ADVANCE_DAYS_BEFORE;
}

export function getAssignmentBlockers(camp = {}) {
  const blockers = [];

  if (['cancelled', 'rejected'].includes(camp.status)) {
    blockers.push(`Camp is ${String(camp.status).replaceAll('_', ' ')} and cannot be assigned.`);
    return blockers;
  }

  if (camp.status !== 'approved') {
    blockers.push('Camp must be approved before a resource can be assigned.');
    return blockers;
  }

  if (camp.submittedToFinanceAt) {
    blockers.push('HCW cannot be changed after the camp was submitted to Finance.');
  }

  return blockers;
}

/** First-time assign or change HCW after assignment (unless finance-locked / terminal). */
export function canAssignCamp(camp = {}) {
  return getAssignmentBlockers(camp).length === 0;
}

export function canReassignCamp(camp = {}) {
  return isCampAssigned(camp) && canAssignCamp(camp);
}
