import { describe, expect, it } from 'vitest';
import { applyClientMasterServerTouch, buildSectionPayload } from './clientMasterSections.js';

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

describe('buildSectionPayload billing', () => {
  it('sends extra billing address lines on Billing & Tax save', () => {
    const payload = buildSectionPayload('billing', {
      clientId: 'c1',
      updatedAt: '2026-01-02T00:00:00.000Z',
      billingAddress: 'Pune HQ\n3rd Floor, Extra Landmark',
      billingGstin: '27AABCU9603R1ZM',
      billingPan: 'AABCU9603R',
      billingStateName: 'Maharashtra',
      billingStateCode: '27',
    });
    expect(payload.billingAddress).toBe('Pune HQ\n3rd Floor, Extra Landmark');
    expect(payload.billing.address).toBe('Pune HQ\n3rd Floor, Extra Landmark');
  });
});
