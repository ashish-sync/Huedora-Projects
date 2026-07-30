import { describe, expect, it } from 'vitest';
import {
  ASSIGNMENT_STAGE_FILTER_OPTIONS,
  EXECUTION_STAGE_FILTER_OPTIONS,
  FINANCIAL_STAGE_FILTER_OPTIONS,
  stageFilterLabel,
} from './campStageFilters.js';
import { REQUEST_REVIEW_FILTER_OPTIONS } from './requestReviewStatus.js';

describe('campStageFilters', () => {
  it('orders request stage filters as specified', () => {
    expect(REQUEST_REVIEW_FILTER_OPTIONS.map((option) => option.label)).toEqual([
      'Camps in Request',
      'Review Pending',
      'Review Overdue',
      'Information Requested',
      'Request Approved',
      'Request Refused',
    ]);
  });

  it('orders assignment stage filters as specified', () => {
    expect(ASSIGNMENT_STAGE_FILTER_OPTIONS.map((option) => option.label)).toEqual([
      'Camps in Assignment',
      'Assigned Camps',
      'Unassigned Camps',
      'Cancelled by TCPL',
      'Cancelled by Client',
    ]);
  });

  it('orders execution stage filters as specified', () => {
    expect(EXECUTION_STAGE_FILTER_OPTIONS.map((option) => option.label)).toEqual([
      'Camps in Execution',
      'Cancelled by TCPL',
      'Cancelled by Client',
      'Camp Ongoing',
      'Camp Scheduled',
      'Camp Completed',
      'Marked Executed',
    ]);
  });

  it('orders financial stage filters as specified', () => {
    expect(FINANCIAL_STAGE_FILTER_OPTIONS.map((option) => option.label)).toEqual([
      'Camps in Financial',
      'Pending Review',
      'Payment Verified',
      'Payment On Hold',
      'Payment Completed',
    ]);
  });

  it('resolves stage filter labels', () => {
    expect(stageFilterLabel('execution', 'yet_to_start')).toBe('Camp Scheduled');
    expect(stageFilterLabel('execution', 'executed')).toBe('Marked Executed');
    expect(stageFilterLabel('financial', 'payment_completed')).toBe('Payment Completed');
  });
});
