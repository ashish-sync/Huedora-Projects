import { describe, expect, it } from 'vitest';
import {
  formatCompanyLetterhead,
  resolveHeaderDisplayKeys,
  sanitizeHeaderDisplayKeys,
} from './companyLetterhead.js';

const company = {
  legalName: 'Tylo Care Private Limited',
  registeredOffice: 'Mumbai',
  gstin: '27AANCT2428H1Z4',
  cin: 'U86909MH2026PTC472417',
  udyam: 'UDYAM-MH-19-0446179',
  email: 'growth@tylocare.com',
  website: 'https://tylocare.com/',
};

describe('header display picks', () => {
  it('defaults to all header fields when unset', () => {
    expect(resolveHeaderDisplayKeys({})).toEqual(['gstin', 'cin', 'udyam', 'email', 'website']);
    const letterhead = formatCompanyLetterhead(company);
    expect(letterhead.line2).toContain('GSTIN:');
    expect(letterhead.line2).toContain('CIN:');
    expect(letterhead.line2).toContain('Udyam:');
    expect(letterhead.line2).toContain('Email:');
    expect(letterhead.line2).toContain('Website: tylocare.com');
  });

  it('keeps only the picked header fields', () => {
    const letterhead = formatCompanyLetterhead({
      ...company,
      headerDisplayKeys: ['gstin', 'cin'],
    });
    expect(letterhead.metaParts).toEqual([
      'GSTIN: 27AANCT2428H1Z4',
      'CIN: U86909MH2026PTC472417',
    ]);
    expect(letterhead.line2).not.toContain('Email:');
  });

  it('shows no line 2 when every optional field is unselected', () => {
    expect(sanitizeHeaderDisplayKeys([])).toEqual([]);
    const letterhead = formatCompanyLetterhead({
      ...company,
      headerDisplayKeys: [],
    });
    expect(letterhead.line2).toBe('');
    expect(letterhead.line1).toContain('Tylo Care Private Limited');
  });
});
