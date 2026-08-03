import { campStatusLabel, isExecutionClosedOut } from '../constants/campLifecycle.js';
import { getCampStartDateTime } from './campSchedule.js';

/** Mark executed is allowed only after this many minutes past camp start time. */
export const MARK_EXECUTED_MINUTES_AFTER_START = 30;

function isCampAssigned(camp = {}) {
  if (camp.assignmentStatus === 'Assigned') return true;
  if (camp.lifecycleStage === 'execution' && camp.assignmentDecision === 'assign') return true;
  return false;
}

function hasFilled(value) {
  return Boolean(String(value || '').trim());
}

export function isMarkExecutedTimingOpen(camp = {}, now = new Date()) {
  const start = getCampStartDateTime(camp);
  if (!start) return false;
  const earliest = start.getTime() + MARK_EXECUTED_MINUTES_AFTER_START * 60 * 1000;
  return now.getTime() >= earliest;
}

export function getExecutionBlockers(camp = {}, now = new Date()) {
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

  if (!hasFilled(camp.chargeableStatus)) {
    blockers.push('Select Chargeable Status');
  }
  if (!hasFilled(camp.inTime)) {
    blockers.push('Enter In Time');
  }
  if (!hasFilled(camp.attire)) {
    blockers.push('Select Attire');
  }

  if (!isMarkExecutedTimingOpen(camp, now)) {
    blockers.push(
      `Camp can be marked executed only after ${MARK_EXECUTED_MINUTES_AFTER_START} minutes from start time`,
    );
  }

  return blockers;
}

export function canMarkCampExecuted(camp = {}, now = new Date()) {
  return getExecutionBlockers(camp, now).length === 0;
}
