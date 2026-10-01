import { describe, expect, it } from 'vitest';
import {
  daysSinceDocumentApproved,
  displayCommercialStage,
  netReceivableFromPreGst,
  normalizeCommercialStage,
  paymentStatusFromAgeingDays,
  paymentStatusPillClass,
  resolveCommercialDisplayStatus,
} from './commercialPaymentStatus.js';

describe('commercialPaymentStatus', () => {
  it('computes Net Receivable as 90% of pre-GST', () => {
    expect(netReceivableFromPreGst(100)).toBe(90);
    expect(netReceivableFromPreGst(0)).toBeNull();
  });

  it('maps Stage display labels with legacy aliases', () => {
    expect(displayCommercialStage('Draft')).toBe('Drafting');
    expect(displayCommercialStage('Uploaded')).toBe('Drafting');
    expect(displayCommercialStage('Approved')).toBe('Issued');
    expect(displayCommercialStage('Issued')).toBe('Issued');
    expect(normalizeCommercialStage('Uploaded')).toBe('Draft');
    expect(normalizeCommercialStage('Approved')).toBe('Issued');
  });

  it('maps ageing buckets to Unpaid under/over 30D', () => {
    expect(paymentStatusFromAgeingDays(0)).toBe('Unpaid under 30D');
    expect(paymentStatusFromAgeingDays(30)).toBe('Unpaid under 30D');
    expect(paymentStatusFromAgeingDays(31)).toBe('Unpaid over 30D');
  });

  it('resolves Tax Invoice Status from payment or 30D ageing', () => {
    const row = {
      documentType: 'client_invoice',
      status: 'Issued',
      approvedAt: '2026-07-01T10:00:00.000Z',
      paymentStatus: 'Unpaid',
    };
    expect(resolveCommercialDisplayStatus(row, new Date('2026-07-15T00:00:00.000Z'))).toBe(
      'Unpaid under 30D'
    );
    expect(resolveCommercialDisplayStatus(row, new Date('2026-08-05T00:00:00.000Z'))).toBe(
      'Unpaid over 30D'
    );
    expect(
      resolveCommercialDisplayStatus(
        { ...row, paymentStatus: 'Paid' },
        new Date('2026-08-20T00:00:00.000Z')
      )
    ).toBe('Paid');
    expect(
      resolveCommercialDisplayStatus(
        { ...row, paymentStatus: 'Partially Paid' },
        new Date('2026-08-20T00:00:00.000Z')
      )
    ).toBe('Partially Paid');
  });

  it('resolves Debit Note unpaid as Pending Collection', () => {
    expect(
      resolveCommercialDisplayStatus({
        documentType: 'debit_note',
        status: 'Issued',
        paymentStatus: 'Unpaid',
      })
    ).toBe('Pending Collection');
  });

  it('resolves manual Status with defaults for Issued docs', () => {
    expect(
      resolveCommercialDisplayStatus({
        documentType: 'quotation',
        status: 'Issued',
        paymentStatus: 'Unpaid',
      })
    ).toBe('Sent');
    expect(
      resolveCommercialDisplayStatus({
        documentType: 'purchase_order',
        status: 'Issued',
        paymentStatus: 'Open',
      })
    ).toBe('Open');
    expect(
      resolveCommercialDisplayStatus({
        documentType: 'credit_note',
        status: 'Draft',
        paymentStatus: 'Pending Adjustment',
      })
    ).toBe('');
  });

  it('maps pill classes for Status colours', () => {
    expect(paymentStatusPillClass('Unpaid under 30D')).toContain('unpaid-under-30d');
    expect(paymentStatusPillClass('Unpaid over 30D')).toContain('unpaid-over-30d');
    expect(paymentStatusPillClass('Paid')).toContain('paid');
    expect(paymentStatusPillClass('Pending Collection')).toContain('pending-collection');
  });

  it('uses issuedAt when approvedAt is missing', () => {
    const days = daysSinceDocumentApproved(
      { issuedAt: '2026-07-01T00:00:00.000Z' },
      new Date('2026-07-16T00:00:00.000Z')
    );
    expect(days).toBe(15);
  });
});
