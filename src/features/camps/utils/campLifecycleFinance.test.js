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
  it('allows visiting financial only when lifecycle is already financial', () => {
    expect(hasReachedLifecycleStage('execution', 'financial')).toBe(false);
    expect(canVisitLifecycleStage('execution', 'financial')).toBe(false);
    expect(canVisitLifecycleStage('financial', 'financial')).toBe(true);
  });

  it('detects execution ready for finance', () => {
    const completeCamp = {
      executionStatus: EXECUTION_STATUS.MARKED_EXECUTED,
      chargeableStatus: 'Chargeable',
      inTime: '09:00',
      attire: 'No Issues',
      outTime: '12:00',
      kmRoundTrip: 10,
      actualPatients: 5,
      rxCount: 2,
      executionDocuments: [
        { docType: 'doctor_form' },
        { docType: 'patient_form' },
      ],
      consumablesUsed: [
        { productId: 'p1', quantityUsed: 0, wastage: 0 },
      ],
    };
    const mapped = [{ productId: 'p1', itemName: 'Test Strip' }];

    expect(isExecutionReadyForFinance(completeCamp, mapped)).toBe(true);

    expect(
      getExecutionFinanceBlockers({
        ...completeCamp,
        executionDocuments: [{ docType: 'doctor_form' }],
      }, mapped),
    ).toEqual(['Upload at least one PF (patient form) document']);

    expect(
      getExecutionFinanceBlockers(completeCamp, mapped),
    ).toEqual([]);

    expect(
      getExecutionFinanceBlockers({
        ...completeCamp,
        consumablesUsed: [{ productId: 'p1', quantityUsed: '', wastage: '' }],
      }, mapped),
    ).toEqual(['Enter Usage and Wastage for Test Strip (use 0 if none)']);
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
