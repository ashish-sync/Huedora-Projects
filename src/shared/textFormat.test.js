import { describe, expect, it } from 'vitest';
import { cleanSpaces, formatTextValue, toProperTitleCase } from './textFormat.js';

describe('textFormat', () => {
  it('cleans extra whitespace', () => {
    expect(cleanSpaces('  hello   world  ')).toBe('hello world');
  });

  it('title-cases names', () => {
    expect(toProperTitleCase('demo pharma ltd')).toBe('Demo Pharma Ltd');
    expect(formatTextValue('  ravi kumar  ', 'doctorName')).toBe('Ravi Kumar');
  });

  it('preserves codes and picklists', () => {
    expect(formatTextValue('  sn-1001  ', 'serialNumber')).toBe('SN-1001');
    expect(formatTextValue('  not initiated  ', 'agreementStatus')).toBe('not initiated');
  });
});
