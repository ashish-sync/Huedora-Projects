import { describe, expect, it } from 'vitest';
import {
  formatFinanceAmountValue,
  parseFinanceAmount,
  sanitizeFinanceAmountInput,
} from './campFinanceAmounts.js';

describe('campFinanceAmounts', () => {
  it('allows free decimal typing without resetting to 0', () => {
    expect(sanitizeFinanceAmountInput('')).toBe('');
    expect(sanitizeFinanceAmountInput('12.')).toBe('12.');
    expect(sanitizeFinanceAmountInput('12.5a')).toBe('12.5');
    expect(sanitizeFinanceAmountInput('1.2.3')).toBe('1.23');
  });

  it('formats and parses amount values', () => {
    expect(formatFinanceAmountValue(0)).toBe('0');
    expect(formatFinanceAmountValue('')).toBe('');
    expect(parseFinanceAmount('')).toBe(0);
    expect(parseFinanceAmount('12.50')).toBe(12.5);
  });
});
