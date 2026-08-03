import { describe, expect, it } from 'vitest';
import { buildPayoutPivotGroups, formatInr } from './campPayoutPivot.js';

const rows = [
  {
    _id: '1',
    clientName: 'Acme',
    campaignName: 'BMD',
    campaignType: 'Ortho',
    hcwCategory: 'Technician',
    hcwName: 'Ravi',
    financePaymentStatus: 'under_review',
    totalPayout: 1000,
    campDate: '2026-08-10',
    submittedToFinanceAt: '2026-08-01T10:00:00Z',
  },
  {
    _id: '2',
    clientName: 'Acme',
    campaignName: 'BMD',
    campaignType: 'Ortho',
    hcwCategory: 'Phlebotomist',
    hcwName: 'Neha',
    financePaymentStatus: 'paid',
    totalPayout: 500,
    campDate: '2026-08-12',
    submittedToFinanceAt: '2026-08-02T10:00:00Z',
  },
  {
    _id: '3',
    clientName: 'Beta',
    campaignName: 'Dietician',
    campaignType: 'Metabolic',
    hcwCategory: 'Dietician',
    hcwName: 'Asha',
    financePaymentStatus: 'not_paid',
    totalPayout: 800,
    campDate: '2026-07-05',
    submittedToFinanceAt: '2026-07-20T10:00:00Z',
  },
];

describe('campPayoutPivot', () => {
  it('groups by client with unpaid totals', () => {
    const pivot = buildPayoutPivotGroups(rows, 'client');
    expect(pivot.groups).toHaveLength(2);
    const acme = pivot.groups.find((g) => g.key === 'Acme');
    expect(acme.campCount).toBe(2);
    expect(acme.unpaidCount).toBe(1);
    expect(acme.totalPayout).toBe(1500);
    expect(acme.unpaidPayout).toBe(1000);
  });

  it('supports secondary grouping by role', () => {
    const pivot = buildPayoutPivotGroups(rows, 'client', 'role');
    const acme = pivot.groups.find((g) => g.key === 'Acme');
    expect(acme.children).toHaveLength(2);
    expect(acme.children.map((c) => c.key).sort()).toEqual(['Phlebotomist', 'Technician']);
  });

  it('formats INR amounts', () => {
    expect(formatInr(1000)).toContain('1,000');
  });
});
