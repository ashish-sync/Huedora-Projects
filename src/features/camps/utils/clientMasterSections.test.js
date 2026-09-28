import { describe, expect, it } from 'vitest';
import { applyClientMasterServerTouch } from './clientMasterSections.js';

describe('applyClientMasterServerTouch', () => {
  it('copies updatedAt from server record after file mutations', () => {
    const next = applyClientMasterServerTouch(
      { updatedAt: '2026-01-01T00:00:00.000Z', campTermsFiles: [] },
      { updatedAt: '2026-01-02T00:00:00.000Z', campTermsFiles: [{ id: 'f1' }] },
    );
    expect(next.updatedAt).toBe('2026-01-02T00:00:00.000Z');
    expect(next.campTermsFiles).toEqual([]);
  });

  it('returns same form reference when updatedAt is unchanged', () => {
    const form = { updatedAt: '2026-01-02T00:00:00.000Z' };
    const next = applyClientMasterServerTouch(form, { updatedAt: '2026-01-02T00:00:00.000Z' });
    expect(next).toBe(form);
  });
});
