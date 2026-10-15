import { describe, expect, it } from 'vitest';
import {
  allocateBulkPaidAmounts,
  derivePayoutSettlementStatus,
  payoutSettlementLabel,
  settlementRequiresPaymentProof,
} from './campPayoutSettlement.js';

describe('derivePayoutSettlementStatus', () => {
  it('marks Not Paid when amount is zero or empty', () => {
    expect(derivePayoutSettlementStatus(0, 1000)).toBe('not_paid');
    expect(derivePayoutSettlementStatus('', 1000)).toBe('not_paid');
  });

  it('marks Partially Paid when amount is below total', () => {
    expect(derivePayoutSettlementStatus(500, 1000)).toBe('under_review');
    expect(payoutSettlementLabel('under_review')).toBe('Partially Paid');
  });

  it('marks Paid in Full when amount meets or exceeds total', () => {
    expect(derivePayoutSettlementStatus(1000, 1000)).toBe('paid');
    expect(derivePayoutSettlementStatus(1100, 1000)).toBe('paid');
    expect(payoutSettlementLabel('paid')).toBe('Paid in Full');
  });

  it('requires proof for full and partial only', () => {
    expect(settlementRequiresPaymentProof('paid')).toBe(true);
    expect(settlementRequiresPaymentProof('under_review')).toBe(true);
    expect(settlementRequiresPaymentProof('not_paid')).toBe(false);
  });
});

describe('allocateBulkPaidAmounts', () => {
  it('allocates full payouts when paid in full', () => {
    const { status, amounts } = allocateBulkPaidAmounts([6000, 9000], 15000);
    expect(status).toBe('paid');
    expect(amounts).toEqual([6000, 9000]);
  });

  it('splits partial paid amount by share', () => {
    const { status, amounts } = allocateBulkPaidAmounts([6000, 9000], 7500);
    expect(status).toBe('under_review');
    expect(amounts[0]).toBe(3000);
    expect(amounts[1]).toBe(4500);
  });

  it('zeros amounts when not paid', () => {
    const { status, amounts } = allocateBulkPaidAmounts([6000, 9000], 0);
    expect(status).toBe('not_paid');
    expect(amounts).toEqual([0, 0]);
  });
});
