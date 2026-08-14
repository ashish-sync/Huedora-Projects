import { describe, expect, it } from 'vitest';
import {
  CAMP_TERMS,
  buildCampTermsPayload,
  createEmptyPurchaseOrder,
} from './clientMasterPo.js';

describe('clientMasterPo', () => {
  it('agreement save omits empty PO placeholders so server can keep existing POs', () => {
    const payload = buildCampTermsPayload({
      campTerms: CAMP_TERMS.AGREEMENT_BASED,
      purchaseOrders: [createEmptyPurchaseOrder()],
      campTermsFiles: [],
      agreementStartDate: '2024-06-01',
      agreementEffectiveDate: '2024-06-15',
      agreementEndDate: '2025-06-01',
    });

    expect(payload.campTerms).toBe(CAMP_TERMS.AGREEMENT_BASED);
    expect(payload.agreementStartDate).toBe('2024-06-01');
    expect(payload.agreementEffectiveDate).toBe('2024-06-15');
    expect(payload.agreementEndDate).toBe('2025-06-01');
    expect(Object.prototype.hasOwnProperty.call(payload, 'purchaseOrders')).toBe(false);
  });

  it('PO save includes meaningful purchase orders and agreement dates', () => {
    const payload = buildCampTermsPayload({
      campTerms: CAMP_TERMS.PO_BASED,
      purchaseOrders: [
        {
          ...createEmptyPurchaseOrder({ id: 'po-1' }),
          poNumber: 'PO-99',
          poNetValue: 4661.02,
          poApplyGst18: true,
          poGstAmount: 838.98,
          poGrossValue: 5500,
          poIssueDate: '2024-07-01',
          poExpiryDate: '2025-07-01',
        },
      ],
      campTermsFiles: [],
      agreementStartDate: '2024-01-01',
      agreementEffectiveDate: '2024-01-01',
      agreementEndDate: '2024-12-31',
    });

    expect(payload.purchaseOrders).toHaveLength(1);
    expect(payload.purchaseOrders[0].poNumber).toBe('PO-99');
    expect(payload.agreementStartDate).toBe('2024-01-01');
    expect(payload.agreementEndDate).toBe('2024-12-31');
  });
});
