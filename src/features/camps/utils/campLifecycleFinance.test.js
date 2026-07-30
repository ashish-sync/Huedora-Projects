import { describe, expect, it } from 'vitest';
import {
  canVisitLifecycleStage,
  EXECUTION_STATUS,
  getExecutionFinanceBlockers,
  hasReachedLifecycleStage,
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
});
