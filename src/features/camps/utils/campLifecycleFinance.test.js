import { describe, expect, it } from 'vitest';
import {
  canEditLifecycleStage,
  canVisitLifecycleStage,
  computeLifecycleDerived,
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

  it('gives Admin super-access to reached stages after Financial / Payment Done', () => {
    const financial = { financePaymentStatus: '' };
    const paid = { financePaymentStatus: 'paid' };
    expect(canEditLifecycleStage('executed', 'request', 'financial', financial, { isAdmin: true })).toBe(true);
    expect(canEditLifecycleStage('executed', 'assignment', 'financial', financial, { isAdmin: true })).toBe(true);
    expect(canEditLifecycleStage('executed', 'execution', 'financial', financial, { isAdmin: true })).toBe(true);
    expect(canEditLifecycleStage('executed', 'execution', 'financial', paid, { isAdmin: true })).toBe(true);
    expect(canEditLifecycleStage('executed', 'request', 'financial', financial, { isAdmin: false })).toBe(false);
    expect(canEditLifecycleStage('executed', 'assignment', 'financial', financial, { isAdmin: false })).toBe(false);
    expect(canEditLifecycleStage('executed', 'execution', 'financial', paid, { isAdmin: false })).toBe(false);
    expect(canEditLifecycleStage('executed', 'financial', 'execution', financial, { isAdmin: true })).toBe(false);
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

  it('recomputes Extra hours for an existing camp from the Client Master snapshot', () => {
    const derived = computeLifecycleDerived({
      inTime: '09:00',
      outTime: '15:00',
      durationHours: 3,
      extraHours: 3,
      clientMasterCampDuration: '4:00',
    });
    expect(derived.totalHours).toBe(6);
    expect(derived.extraHours).toBe(2);
  });

  it('computes Extra hours from Client Master camp duration, not the scheduled slot', () => {
    const pricing = { campDuration: '4:00', otUnit: 400, executedCampUnit: 0 };
    const derived = computeLifecycleDerived({
      inTime: '09:00',
      outTime: '15:00',
      durationHours: 3,
    }, { pricing });
    expect(derived.totalHours).toBe(6);
    expect(derived.extraHours).toBe(2);
  });

  it('recomputes Extra hours when Out Time changes', () => {
    const pricing = { campDuration: '4:00' };
    expect(computeLifecycleDerived({
      inTime: '09:00',
      outTime: '13:00',
      durationHours: 3,
    }, { pricing }).extraHours).toBe(0);
    expect(computeLifecycleDerived({
      inTime: '09:00',
      outTime: '15:00',
      durationHours: 3,
    }, { pricing }).extraHours).toBe(2);
  });
});
