import { describe, expect, it } from 'vitest';
import {
  ASSIGNMENT_WORKFLOW_STATUSES,
  EXECUTION_WORKFLOW_STATUSES,
  FINANCIAL_WORKFLOW_STATUSES,
  REQUEST_WORKFLOW_STATUSES,
  financialWorkflowStatus,
} from '../constants/campWorkflowStatuses.js';
import { executionStatusLabel } from '../constants/campLifecycle.js';
import { REQUEST_STATUS_OPTIONS } from '../components/CampsFilters.jsx';

describe('Camp One Stage/Status vocabulary', () => {
  it('exposes only the allowed Request statuses', () => {
    expect(REQUEST_WORKFLOW_STATUSES.map((r) => r.label)).toEqual([
      'Review Pending',
      'Review Overdue',
      'Refused',
      'Info Requested',
    ]);
    expect(REQUEST_STATUS_OPTIONS.map((r) => r.label)).toEqual([
      'Review Pending',
      'Review Overdue',
      'Refused',
      'Info Requested',
    ]);
  });

  it('exposes only Unassigned and Hiring Requested for Assignment', () => {
    expect(ASSIGNMENT_WORKFLOW_STATUSES.map((r) => r.label)).toEqual([
      'Unassigned',
      'Hiring Requested',
    ]);
  });

  it('exposes only Planned, Executed, Cancelled by Tylo/Client for Execution', () => {
    expect(EXECUTION_WORKFLOW_STATUSES.map((r) => r.label)).toEqual([
      'Planned',
      'Executed',
      'Cancelled by Tylo',
      'Cancelled by Client',
    ]);
    expect(executionStatusLabel('Camp Scheduled')).toBe('Planned');
    expect(executionStatusLabel('Marked Executed')).toBe('Executed');
    expect(executionStatusLabel('Cancelled by Tylo')).toBe('Cancelled by Tylo');
    expect(executionStatusLabel('Cancelled by Client')).toBe('Cancelled by Client');
  });

  it('exposes only the four Financial statuses and maps Payment Done from Finance', () => {
    expect(FINANCIAL_WORKFLOW_STATUSES.map((r) => r.label)).toEqual([
      'Pending Confirmation',
      'Confirmed Payment',
      'Hold',
      'Payment Done',
    ]);
    expect(financialWorkflowStatus({ paymentSubmitStatus: '' }).label).toBe('Pending Confirmation');
    expect(financialWorkflowStatus({ paymentSubmitStatus: 'payment_confirmed' }).label).toBe('Confirmed Payment');
    expect(financialWorkflowStatus({ paymentSubmitStatus: 'payment_hold' }).label).toBe('Hold');
    expect(financialWorkflowStatus({ financePaymentStatus: 'paid' }).label).toBe('Payment Done');
  });
});
