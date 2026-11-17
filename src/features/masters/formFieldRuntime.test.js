import { describe, expect, it } from 'vitest';
import {
  applyFieldFormat,
  compilePattern,
  evaluateShowWhen,
  getFormMasterCampDateErrors,
  normalizeFormSettings,
  validateFieldValue,
  validateFormMasterValues,
} from './formFieldRuntime.js';

describe('formFieldRuntime (client)', () => {
  it('applies format and pattern validation', () => {
    expect(applyFieldFormat('mh-01', 'uppercase')).toBe('MH-01');
    expect(compilePattern('^[A-Z0-9-]+$').ok).toBe(true);
    expect(compilePattern('(').ok).toBe(false);
    expect(
      validateFieldValue(
        { key: 'doctorCode', label: 'Doctor Code', required: true, pattern: '^[A-Z0-9-]+$' },
        'MH-01',
      ),
    ).toBe('');
    expect(
      validateFieldValue(
        { key: 'doctorCode', label: 'Doctor Code', required: true, pattern: '^[A-Z0-9-]+$' },
        'mh 01',
      ),
    ).toMatch(/invalid/i);
  });

  it('honours showWhen and form settings', () => {
    expect(evaluateShowWhen({ field: 'x', operator: 'eq', value: '1' }, { x: '1' })).toBe(true);
    const settings = normalizeFormSettings({ allowExcelUpload: false }, 'PUBLIC_CAMP_REQUEST');
    expect(settings.allowExcelUpload).toBe(false);
    expect(getFormMasterCampDateErrors({ campDate: '2001-01-01' }).length).toBeGreaterThan(0);
    expect(
      validateFormMasterValues(
        [{ key: 'doctorCode', label: 'Doctor Code', required: true, pattern: '^[A-Z]+$' }],
        { doctorCode: '12' },
      ).length,
    ).toBeGreaterThan(0);
  });
});
