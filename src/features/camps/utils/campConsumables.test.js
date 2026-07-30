import { describe, expect, it } from 'vitest';
import {
  emptyConsumableRow,
  formatConsumablesUsedSummary,
  getConsumablesCompletionBlockers,
  isConsumableRowComplete,
  mergeConsumablesWithTemplate,
  normalizeConsumablesUsed,
} from './campConsumables.js';

describe('camp consumables', () => {
  const mapped = [
    { productId: 'p1', itemName: 'Test Strip', unit: 'Strip', uomId: 'u1' },
    { productId: 'p2', itemName: 'Device Battery', unit: 'Watt', uomId: 'u2' },
  ];

  it('merges mapped consumables with saved values', () => {
    expect(
      mergeConsumablesWithTemplate(mapped, [
        { productId: 'p1', quantityUsed: '20', wastage: '2' },
      ]),
    ).toEqual([
      { productId: 'p1', itemName: 'Test Strip', unit: 'Strip', uomId: 'u1', quantityUsed: '20', wastage: '2' },
      { productId: 'p2', itemName: 'Device Battery', unit: 'Watt', uomId: 'u2', quantityUsed: '', wastage: '' },
    ]);
  });

  it('flags incomplete mapped consumables', () => {
    expect(
      getConsumablesCompletionBlockers(mapped, [
        { productId: 'p1', quantityUsed: '20', wastage: '2' },
        { productId: 'p2', quantityUsed: '', wastage: '' },
      ]),
    ).toEqual(['Enter usage and wastage for Device Battery']);
  });

  it('normalizes rows with product and quantity', () => {
    expect(
      normalizeConsumablesUsed([
        { productId: 'p1', itemName: 'Test Strip', quantityUsed: '20', wastage: '2', unit: 'Strip' },
        { productId: '', itemName: 'Ignored', quantityUsed: 1, wastage: 0, unit: 'Each' },
        { productId: 'p2', itemName: 'Device Battery', quantityUsed: 0, wastage: 0, unit: 'Watt' },
      ], { requiredProductIds: ['p1'] }),
    ).toEqual([
      { productId: 'p1', itemName: 'Test Strip', quantityUsed: 20, wastage: 2, unit: 'Strip', uomId: '' },
    ]);
  });

  it('formats summary for export display', () => {
    expect(
      formatConsumablesUsedSummary([
        { productId: 'p1', itemName: 'Test Strip', quantityUsed: 20, wastage: 2, unit: 'Strip' },
        { productId: 'p2', itemName: 'Device Battery', quantityUsed: 2, wastage: 0, unit: 'Watt' },
      ]),
    ).toBe('Test Strip | 20 | 2; Device Battery | 2 | 0');
  });

  it('creates an empty row template', () => {
    expect(emptyConsumableRow()).toEqual({
      productId: '',
      itemName: '',
      quantityUsed: '',
      wastage: '',
      unit: '',
      uomId: '',
    });
  });

  it('accepts zero values as complete rows', () => {
    expect(isConsumableRowComplete({ quantityUsed: 0, wastage: 0 })).toBe(true);
  });
});
