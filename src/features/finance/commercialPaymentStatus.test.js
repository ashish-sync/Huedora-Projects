import { describe, expect, it } from 'vitest';
import {
  daysSinceDocumentApproved,
  netReceivableFromPreGst,
  paymentStatusFromAgeingDays,
  paymentStatusPillClass,
  resolveCommercialPaymentDisplayStatus,
} from './commercialPaymentStatus.js';

describe('commercialPaymentStatus', () => {
  it('computes Net Receivable as 90% of pre-GST', () => {
    expect(netReceivableFromPreGst(100)).toBe(90);
    expect(netReceivableFromPreGst(0)).toBeNull();
  });

  it('maps ageing buckets to Status labels', () => {
    expect(paymentStatusFromAgeingDays(0)).toBe('Invoice Sent');
    expect(paymentStatusFromAgeingDays(10)).toBe('Invoice Sent');
    expect(paymentStatusFromAgeingDays(11)).toBe('Invoice Due');
    expect(paymentStatusFromAgeingDays(30)).toBe('Invoice Due');
    expect(paymentStatusFromAgeingDays(31)).toBe('Invoice Overdue');
    expect(paymentStatusFromAgeingDays(45)).toBe('Invoice Overdue');
    expect(paymentStatusFromAgeingDays(46)).toBe('MSME Breach');
  });

  it('resolves Status from payment or approval ageing', () => {
    const row = {
      status: 'Issued',
      approvedAt: '2026-07-01T10:00:00.000Z',
      paymentStatus: 'Unpaid',
    };
    expect(resolveCommercialPaymentDisplayStatus(row, new Date('2026-07-05T00:00:00.000Z'))).toBe(
      'Invoice Sent'
    );
    expect(resolveCommercialPaymentDisplayStatus(row, new Date('2026-07-20T00:00:00.000Z'))).toBe(
      'Invoice Due'
    );
    expect(resolveCommercialPaymentDisplayStatus(row, new Date('2026-08-05T00:00:00.000Z'))).toBe(
      'Invoice Overdue'
    );
    expect(resolveCommercialPaymentDisplayStatus(row, new Date('2026-08-20T00:00:00.000Z'))).toBe(
      'MSME Breach'
    );
    expect(
      resolveCommercialPaymentDisplayStatus(
        { ...row, paymentStatus: 'Paid' },
        new Date('2026-08-20T00:00:00.000Z')
      )
    ).toBe('Paid');
    expect(
      resolveCommercialPaymentDisplayStatus(
        { ...row, paymentStatus: 'Partially Paid' },
        new Date('2026-08-20T00:00:00.000Z')
      )
    ).toBe('Partially Paid');
  });

  it('maps pill classes for Status colours', () => {
    expect(paymentStatusPillClass('Invoice Sent')).toContain('invoice-sent');
    expect(paymentStatusPillClass('Invoice Due')).toContain('invoice-due');
    expect(paymentStatusPillClass('Invoice Overdue')).toContain('invoice-overdue');
    expect(paymentStatusPillClass('MSME Breach')).toContain('msme-breach');
    expect(paymentStatusPillClass('Paid')).toContain('paid');
    expect(paymentStatusPillClass('Partially Paid')).toContain('partially-paid');
  });

  it('uses issuedAt when approvedAt is missing', () => {
    const days = daysSinceDocumentApproved(
      { issuedAt: '2026-07-01T00:00:00.000Z' },
      new Date('2026-07-16T00:00:00.000Z')
    );
    expect(days).toBe(15);
  });
});
