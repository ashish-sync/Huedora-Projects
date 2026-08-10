import { describe, expect, it } from 'vitest';
import { getHcwFinanceBlockers, isHcwReadyForFinance } from './hcwFinanceReadiness.js';

const completeHcw = {
  _id: 'hcw-1',
  name: 'Priya Sharma',
  contact: '9876543210',
  profession: 'Technician',
  city: 'Mumbai',
  state: 'Maharashtra',
  address: '12 Health Street',
  pinCode: '400001',
  panNumber: 'ABCDE1234F',
  ifscCode: 'HDFC0001234',
  bankName: 'HDFC Bank',
  accountNumber: '123456789012',
  passbookCopyUrl: '/uploads/contacts/passbook.pdf',
  panCardCopyUrl: '/uploads/contacts/pan.pdf',
};

describe('hcwFinanceReadiness', () => {
  it('returns blockers when HCW is missing', () => {
    expect(getHcwFinanceBlockers(null)).toContain('Assign a healthcare worker before submitting to Finance');
  });

  it('accepts a complete HCW profile', () => {
    expect(isHcwReadyForFinance(completeHcw)).toBe(true);
    expect(getHcwFinanceBlockers(completeHcw)).toEqual([]);
  });

  it('flags missing banking documents', () => {
    const blockers = getHcwFinanceBlockers({ ...completeHcw, passbookCopyUrl: '' });
    expect(blockers).toContain('HCW bank account proof is not uploaded in Contact Directory');
  });
});
