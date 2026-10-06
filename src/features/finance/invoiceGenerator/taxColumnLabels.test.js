import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TAX_COLUMN_LABELS,
  normalizeHsnSacLabel,
  resolveTaxColumnLabels,
} from './invoiceCalculations.js';

describe('taxColumnLabels hsnSacLabel', () => {
  it('always uses SAC / HSN', () => {
    expect(DEFAULT_TAX_COLUMN_LABELS.hsnSacLabel).toBe('SAC / HSN');
    expect(resolveTaxColumnLabels({}).hsnSacLabel).toBe('SAC / HSN');
    expect(normalizeHsnSacLabel('HSN')).toBe('SAC / HSN');
    expect(normalizeHsnSacLabel('SAC')).toBe('SAC / HSN');
    expect(
      resolveTaxColumnLabels({ taxColumnLabels: { hsnSacLabel: 'HSN' } }).hsnSacLabel
    ).toBe('SAC / HSN');
  });
});
