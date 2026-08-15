import { describe, expect, it } from 'vitest';
import {
  CAMP_TERMS,
  buildCampTermsPayload,
  campTermsFieldsFromRecord,
  createEmptyPurchaseOrder,
  mergePoFilesFromServerRecord,
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

  it('does not treat PO attachments as Agreement campTermsFiles', () => {
    const fields = campTermsFieldsFromRecord({
      campTerms: CAMP_TERMS.PO_BASED,
      purchaseOrders: [
        {
          id: 'po-1',
          poNumber: 'PO-1',
          poNetValue: 1000,
          poGrossValue: 1000,
          files: [{ id: 'f1', storedName: 'po.pdf', fileName: 'po.pdf' }],
        },
      ],
      campTermsFiles: [],
      poFile: { id: 'f1', storedName: 'po.pdf', fileName: 'po.pdf' },
      agreementStartDate: '2024-01-01',
    });

    expect(fields.purchaseOrders[0].files).toHaveLength(1);
    expect(fields.campTermsFiles).toEqual([]);
    expect(fields.agreementStartDate).toBe('2024-01-01');
  });

  it('merges PO upload files without clearing local No./Value', () => {
    const local = [
      {
        ...createEmptyPurchaseOrder({ id: 'po-local' }),
        poNumber: 'PO-KEEP',
        poNetValue: 4661.02,
        poApplyGst18: true,
        poGstAmount: 838.98,
        poGrossValue: 5500,
        files: [],
      },
    ];
    const serverRow = {
      campTerms: CAMP_TERMS.PO_BASED,
      purchaseOrders: [
        {
          id: 'po-local',
          poNumber: '',
          poNetValue: 0,
          poGrossValue: 0,
          files: [{ id: 'f2', storedName: 'new.pdf', fileName: 'new.pdf' }],
        },
      ],
      campTermsFiles: [],
    };

    const merged = mergePoFilesFromServerRecord(local, 'po-local', serverRow);
    expect(merged).toHaveLength(1);
    expect(merged[0].poNumber).toBe('PO-KEEP');
    expect(merged[0].poGrossValue).toBe(5500);
    expect(merged[0].files[0].fileName).toBe('new.pdf');
  });
});
