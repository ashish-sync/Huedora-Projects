import { describe, expect, it } from 'vitest';
import { formatInr, inrTypingValue, parseInrAmount } from './invoiceCalculations.js';

describe('INR grouping', () => {
  it('formats hundreds and thousands like Taxable Value', () => {
    expect(formatInr(1000)).toBe('1,000.00');
    expect(formatInr(100000)).toBe('1,00,000.00');
    expect(formatInr('2500')).toBe('2,500.00');
  });

  it('parses grouped amounts', () => {
    expect(parseInrAmount('1,000.00')).toBe(1000);
    expect(parseInrAmount('1,00,000.5')).toBe(100000.5);
    expect(parseInrAmount('')).toBe('');
  });

  it('keeps typing as a plain decimal', () => {
    expect(inrTypingValue('1,00,000.50')).toBe('100000.50');
    expect(inrTypingValue('12a3')).toBe('123');
  });
});
