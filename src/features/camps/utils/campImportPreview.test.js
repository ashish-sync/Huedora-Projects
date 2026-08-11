import { describe, expect, it } from 'vitest';
import { importInvalidRowView, importPreviewSummary } from './campImportPreview';

describe('campImportPreview', () => {
  it('reads flat invalid rows from import preview API', () => {
    const view = importInvalidRowView({
      rowNumber: 3,
      clientName: 'Acme',
      campDate: '2026-08-01',
      errors: ['Camp date is required'],
    });
    expect(view.clientName).toBe('Acme');
    expect(view.errors).toEqual(['Camp date is required']);
  });

  it('reads nested invalid rows', () => {
    const view = importInvalidRowView({
      rowNumber: 5,
      data: { clientName: 'Beta', campDate: '2026-08-02' },
      errors: ['PIN Code is required'],
    });
    expect(view.clientName).toBe('Beta');
    expect(view.campDate).toBe('2026-08-02');
  });

  it('defaults missing errors to empty array', () => {
    const view = importInvalidRowView({ clientName: 'Gamma' });
    expect(view.errors).toEqual([]);
  });

  it('summarizes preview counts safely', () => {
    expect(importPreviewSummary(null)).toEqual({ total: 0, valid: 0, invalid: 0 });
    expect(importPreviewSummary({ summary: { total: 10, valid: 7, invalid: 3 } })).toEqual({
      total: 10,
      valid: 7,
      invalid: 3,
    });
  });
});
