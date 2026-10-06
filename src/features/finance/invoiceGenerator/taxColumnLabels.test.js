import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TAX_COLUMN_LABELS,
  normalizeHsnSacLabel,
  resolveTaxColumnLabels,
} from './invoiceCalculations.js';

describe('taxColumnLabels hsnSacLabel', () => {
  it('defaults to SAC', () => {
    expect(resolveTaxColumnLabels({}).hsnSacLabel).toBe('SAC');
    expect(DEFAULT_TAX_COLUMN_LABELS.hsnSacLabel).toBe('SAC');
  });

  it('accepts HSN or SAC only', () => {
    expect(normalizeHsnSacLabel('hsn')).toBe('HSN');
    expect(normalizeHsnSacLabel('SAC')).toBe('SAC');
    expect(normalizeHsnSacLabel('HSN/SAC')).toBe('SAC');
    expect(normalizeHsnSacLabel('')).toBe('SAC');
  });

  it('reads hsnSacLabel from form.taxColumnLabels', () => {
    expect(
      resolveTaxColumnLabels({ taxColumnLabels: { hsnSacLabel: 'HSN' } }).hsnSacLabel
    ).toBe('HSN');
  });
});
