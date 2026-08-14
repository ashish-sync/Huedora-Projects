import { describe, expect, it } from 'vitest';
import {
  canVisitLifecycleStage,
  EXECUTION_STATUS,
  getExecutionFinanceBlockers,
  hasReachedLifecycleStage,
  isExecutionCancellationForFinance,
  isExecutionReadyForFinance,
} from '../constants/campLifecycle.js';

describe('camp lifecycle finance transition', () => {
  it('allows visiting financial when execution stage is reached', () => {
    expect(hasReachedLifecycleStage('execution', 'financial')).toBe(false);
    expect(canVisitLifecycleStage('execution', 'financial')).toBe(true);
  });

  it('detects execution ready for finance', () => {
    expect(
      isExecutionReadyForFinance({
        executionStatus: EXECUTION_STATUS.CAMP_COMPLETED,
        chargeableStatus: 'Chargeable',
        inTime: '09:00',
        outTime: '12:00',
        executionDocuments: [
          { docType: 'doctor_form' },
          { docType: 'patient_form' },
        ],
      }),
    ).toBe(true);

    expect(
      getExecutionFinanceBlockers({
        executionStatus: EXECUTION_STATUS.CAMP_COMPLETED,
        chargeableStatus: 'Chargeable',
        inTime: '09:00',
        outTime: '12:00',
        executionDocuments: [{ docType: 'doctor_form' }],
      }),
    ).toEqual(['Upload at least one PF (patient form) document']);
  });

  it('skips execution completion fields for Cancelled by Tylo/Client', () => {
    const cancelledCamp = {
      executionStatus: 'Cancelled by Client',
      chargeableStatus: 'Non-Chargeable',
    };
    expect(isExecutionReadyForFinance(cancelledCamp)).toBe(true);
    expect(getExecutionFinanceBlockers(cancelledCamp)).toEqual([]);
    expect(isExecutionCancellationForFinance(cancelledCamp)).toBe(true);
  });

  it('recognizes legacy cancelled camps from assignment refusal reason', () => {
    const legacy = {
      status: 'cancelled',
      lifecycleStage: 'execution',
      assignmentRefusalReason: 'Cancelled by Tylo',
      executionStatus: 'Camp Ongoing',
    };
    expect(isExecutionCancellationForFinance(legacy)).toBe(true);
    expect(getExecutionFinanceBlockers(legacy)).toEqual([]);
  });
});
