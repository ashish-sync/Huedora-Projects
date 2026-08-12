import { describe, expect, it } from 'vitest';
import {
  applyDefaultUsageToRows,
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
      {
        productId: 'p1',
        itemName: 'Test Strip',
        unit: 'Strip',
        uomId: 'u1',
        quantityUsed: '20',
        wastage: '2',
        excluded: false,
        usageManual: false,
      },
      {
        productId: 'p2',
        itemName: 'Device Battery',
        unit: 'Watt',
        uomId: 'u2',
        quantityUsed: '',
        wastage: '0',
        excluded: false,
        usageManual: false,
      },
    ]);
  });

  it('defaults usage from patients screened when merging mapped rows', () => {
    expect(
      mergeConsumablesWithTemplate(mapped, [], { patientsScreened: 42 }),
    ).toEqual([
      expect.objectContaining({ productId: 'p1', quantityUsed: '42', wastage: '0' }),
      expect.objectContaining({ productId: 'p2', quantityUsed: '42', wastage: '0' }),
    ]);
  });

  it('syncs usage when patients screened changes for auto rows', () => {
    expect(
      applyDefaultUsageToRows([
        { productId: 'p1', quantityUsed: '10', usageManual: false, wastage: '0' },
        { productId: 'p2', quantityUsed: '5', usageManual: true, wastage: '0' },
      ], 25),
    ).toEqual([
      expect.objectContaining({ productId: 'p1', quantityUsed: '25' }),
      expect.objectContaining({ productId: 'p2', quantityUsed: '5', usageManual: true }),
    ]);
  });

  it('flags incomplete mapped consumables but skips excluded rows', () => {
    expect(
      getConsumablesCompletionBlockers(mapped, [
        { productId: 'p1', quantityUsed: '20', wastage: '2' },
        { productId: 'p2', quantityUsed: '', wastage: '', excluded: true },
      ]),
    ).toEqual([]);
  });

  it('still flags incomplete active mapped consumables', () => {
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
        { productId: 'p3', itemName: 'Removed', quantityUsed: 5, wastage: 0, excluded: true },
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
      wastage: '0',
      unit: '',
      uomId: '',
      excluded: false,
      usageManual: false,
    });
  });

  it('accepts zero values as complete rows', () => {
    expect(isConsumableRowComplete({ quantityUsed: 0, wastage: 0 })).toBe(true);
  });

  it('treats excluded rows as complete', () => {
    expect(isConsumableRowComplete({ quantityUsed: '', wastage: '', excluded: true })).toBe(true);
  });
});
