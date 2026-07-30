import { describe, expect, it } from 'vitest';
import {
  EXPORT_PRESET_TEMPLATES,
  columnKeysForPreset,
  columnKeysForSections,
} from './campExportPresets.js';

const SECTIONS = [
  {
    id: 'overview',
    columns: [{ key: 'campId' }, { key: 'status' }],
  },
  {
    id: 'finance',
    columns: [{ key: 'campRevenue' }, { key: 'totalPayout' }],
  },
];

describe('campExportPresets', () => {
  it('includes operations, finance, and management presets', () => {
    expect(EXPORT_PRESET_TEMPLATES.map((preset) => preset.label)).toEqual([
      'Operations',
      'Finance',
      'Management',
      'All fields',
    ]);
  });

  it('selects columns by section for finance preset', () => {
    expect(columnKeysForPreset(SECTIONS, 'finance')).toEqual(['campId', 'status', 'campRevenue', 'totalPayout']);
  });

  it('selects all columns for full preset', () => {
    expect(columnKeysForPreset(SECTIONS, 'full')).toEqual(['campId', 'status', 'campRevenue', 'totalPayout']);
  });

  it('filters columns by section ids', () => {
    expect(columnKeysForSections(SECTIONS, ['finance'])).toEqual(['campRevenue', 'totalPayout']);
  });
});
