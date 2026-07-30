import { describe, expect, it } from 'vitest';
import {
  EXECUTION_STATUS,
  normalizeExecutionStatus,
  resolveEffectiveExecutionStatus,
  resolveScheduledExecutionStatus,
  syncExecutionStatusForSave,
} from '../constants/campLifecycle.js';

const camp = {
  campDate: '2026-07-30',
  startTime: '10:00',
  endTime: '13:00',
};

describe('execution status lifecycle', () => {
  it('maps legacy statuses to canonical execution labels', () => {
    expect(normalizeExecutionStatus('Pending')).toBe(EXECUTION_STATUS.CAMP_SCHEDULED);
    expect(normalizeExecutionStatus('Yet to Start')).toBe(EXECUTION_STATUS.CAMP_SCHEDULED);
    expect(normalizeExecutionStatus('In Progress')).toBe(EXECUTION_STATUS.CAMP_ONGOING);
    expect(normalizeExecutionStatus('Ongoing')).toBe(EXECUTION_STATUS.CAMP_ONGOING);
    expect(normalizeExecutionStatus('Executed')).toBe(EXECUTION_STATUS.MARKED_EXECUTED);
    expect(normalizeExecutionStatus('Completed')).toBe(EXECUTION_STATUS.CAMP_COMPLETED);
  });

  it('resolves schedule-based statuses from camp time', () => {
    const beforeStart = new Date('2026-07-30T09:00:00');
    const during = new Date('2026-07-30T11:00:00');
    const afterEnd = new Date('2026-07-30T14:00:00');

    expect(resolveScheduledExecutionStatus(camp, beforeStart)).toBe(EXECUTION_STATUS.CAMP_SCHEDULED);
    expect(resolveScheduledExecutionStatus(camp, during)).toBe(EXECUTION_STATUS.CAMP_ONGOING);
    expect(resolveScheduledExecutionStatus(camp, afterEnd)).toBe(EXECUTION_STATUS.MARKED_EXECUTED);
  });

  it('keeps camp completed status over schedule', () => {
    const during = new Date('2026-07-30T11:00:00');
    expect(resolveEffectiveExecutionStatus({
      ...camp,
      executionStatus: EXECUTION_STATUS.CAMP_COMPLETED,
    }, during)).toBe(EXECUTION_STATUS.CAMP_COMPLETED);
    expect(syncExecutionStatusForSave({
      ...camp,
      executionStatus: EXECUTION_STATUS.CAMP_COMPLETED,
    }, during)).toBe(EXECUTION_STATUS.CAMP_COMPLETED);
  });
});
