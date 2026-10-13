import { describe, it, expect } from 'vitest';
import { validateBulkCampAction } from './campBulkActions.js';

const auth = {
  canApproveCamps: () => true,
  canRejectCamps: () => true,
  hasPermission: (perm) => perm === 'camps:execute',
  isSuperAdmin: () => false,
};

const financeAuth = {
  canApproveCamps: () => false,
  canRejectCamps: () => false,
  hasPermission: (perm) => ['finance:write', 'camps:request'].includes(perm),
  isSuperAdmin: () => false,
};

describe('validateBulkCampAction', () => {
  it('allows bulk refuse only for pending_review camps', () => {
    const result = validateBulkCampAction(
      'reject',
      [
        { _id: '1', campId: 'A', status: 'pending_review' },
        { _id: '2', campId: 'B', status: 'approved' },
      ],
      auth,
    );
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/cannot be refused/i);
  });

  it('returns eligible ids for bulk refuse when all pending', () => {
    const result = validateBulkCampAction(
      'reject',
      [
        { _id: '1', campId: 'A', status: 'pending_review' },
        { _id: '2', campId: 'B', status: 'pending_review' },
      ],
      auth,
    );
    expect(result).toEqual({
      ok: true,
      ids: ['1', '2'],
      count: 2,
      skipped: [],
    });
  });

  it('filters confirmPayment to unchecked financial camps only', () => {
    const result = validateBulkCampAction(
      'confirmPayment',
      [
        {
          _id: '1',
          campId: 'A',
          lifecycleStage: 'financial',
          paymentSubmitStatus: 'payment_not_checked',
        },
        {
          _id: '2',
          campId: 'B',
          lifecycleStage: 'financial',
          paymentSubmitStatus: 'payment_confirmed',
        },
        {
          _id: '3',
          campId: 'C',
          lifecycleStage: 'financial',
          paymentSubmitStatus: 'payment_hold',
        },
      ],
      financeAuth,
    );
    expect(result.ok).toBe(true);
    expect(result.ids).toEqual(['1']);
    expect(result.count).toBe(1);
    expect(result.skipped?.length).toBe(2);
  });

  it('allows hold only when not already held or submitted', () => {
    const result = validateBulkCampAction(
      'hold',
      [
        {
          _id: '1',
          campId: 'A',
          lifecycleStage: 'financial',
          paymentSubmitStatus: 'payment_confirmed',
        },
        {
          _id: '2',
          campId: 'B',
          lifecycleStage: 'financial',
          paymentSubmitStatus: 'payment_hold',
        },
      ],
      financeAuth,
    );
    expect(result.ok).toBe(true);
    expect(result.ids).toEqual(['1']);
  });

  it('allows unhold only for camps on hold', () => {
    const result = validateBulkCampAction(
      'unhold',
      [
        {
          _id: '1',
          campId: 'A',
          lifecycleStage: 'financial',
          paymentSubmitStatus: 'payment_hold',
        },
        {
          _id: '2',
          campId: 'B',
          lifecycleStage: 'financial',
          paymentSubmitStatus: 'payment_confirmed',
        },
      ],
      financeAuth,
    );
    expect(result.ok).toBe(true);
    expect(result.ids).toEqual(['1']);
  });

  it('allows submitToFinance only for confirmed unsaved finance camps', () => {
    const result = validateBulkCampAction(
      'submitToFinance',
      [
        {
          _id: '1',
          campId: 'A',
          lifecycleStage: 'financial',
          paymentSubmitStatus: 'payment_confirmed',
        },
        {
          _id: '2',
          campId: 'B',
          lifecycleStage: 'financial',
          paymentSubmitStatus: 'payment_confirmed',
          submittedToFinanceAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      financeAuth,
    );
    expect(result.ok).toBe(true);
    expect(result.ids).toEqual(['1']);
  });

  it('blocks finance bulk without finance:write', () => {
    const result = validateBulkCampAction(
      'confirmPayment',
      [{ _id: '1', campId: 'A', lifecycleStage: 'financial', paymentSubmitStatus: 'payment_not_checked' }],
      auth,
    );
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/permission/i);
  });
});
