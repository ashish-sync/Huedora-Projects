import { describe, it, expect } from 'vitest';
import { validateBulkCampAction } from './campBulkActions.js';

const auth = {
  canApproveCamps: () => true,
  canRejectCamps: () => true,
  hasPermission: (perm) => perm === 'camps:execute',
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
    });
  });
});
