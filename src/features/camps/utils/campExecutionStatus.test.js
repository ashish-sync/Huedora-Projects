import { describe, expect, it } from 'vitest';
import {
  EXECUTION_STATUS,
  executionStatusAdminValue,
  isCampExecutedForPayout,
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

  it('maps stored execution statuses onto the Admin select', () => {
    expect(executionStatusAdminValue(EXECUTION_STATUS.CAMP_SCHEDULED)).toBe(EXECUTION_STATUS.CAMP_SCHEDULED);
    expect(executionStatusAdminValue(EXECUTION_STATUS.CAMP_COMPLETED)).toBe(EXECUTION_STATUS.MARKED_EXECUTED);
    expect(executionStatusAdminValue('Cancelled by Client')).toBe('Cancelled by Client');
  });

  it('auto-picks Camp Payout only when Execution Status is Executed', () => {
    expect(isCampExecutedForPayout({ executionStatus: EXECUTION_STATUS.MARKED_EXECUTED })).toBe(true);
    expect(isCampExecutedForPayout({ executionStatus: EXECUTION_STATUS.CAMP_COMPLETED })).toBe(true);
    expect(isCampExecutedForPayout({ executionStatus: 'Executed' })).toBe(true);
    expect(isCampExecutedForPayout({ executionStatus: EXECUTION_STATUS.CAMP_SCHEDULED })).toBe(false);
    expect(isCampExecutedForPayout({ executionStatus: 'Cancelled by Tylo' })).toBe(false);
    expect(isCampExecutedForPayout({ executionStatus: 'Cancelled by Client' })).toBe(false);
    expect(isCampExecutedForPayout({ status: 'executed', executionStatus: 'Cancelled by Tylo' })).toBe(false);
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
