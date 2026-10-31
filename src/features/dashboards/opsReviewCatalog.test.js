import { describe, expect, it } from 'vitest';
import {
  importKindLabel,
  importOutcomeSummary,
  importStatusLabel,
  notificationModuleLabel,
  personRoleLabel,
  personStatusLabel,
} from './opsReviewCatalog.js';

describe('opsReviewCatalog', () => {
  it('describes people without technical flags', () => {
    expect(personStatusLabel({ isActive: true })).toBe('Active');
    expect(personStatusLabel({ isActive: false })).toBe('Not signing in');
    expect(personRoleLabel({ designation: 'Camp Coordinator' })).toBe('Camp Coordinator');
    expect(personRoleLabel({ roles: [{ name: 'Viewer' }] })).toBe('Viewer');
  });

  it('describes uploads in business language', () => {
    expect(importKindLabel({ type: 'INVENTORY', mode: 'COMMIT' })).toBe('Saved asset register rows');
    expect(importKindLabel({ type: 'VERIFICATION', mode: 'DRY_RUN' })).toBe('Checked a verification file');
    expect(importStatusLabel('SUCCEEDED')).toBe('Completed');
    expect(importStatusLabel('FAILED')).toBe('Needs attention');
    expect(importOutcomeSummary({
      type: 'INVENTORY',
      mode: 'COMMIT',
      status: 'SUCCEEDED',
      totalRows: 10,
      successRows: 8,
      errorRows: 2,
    })).toMatch(/8 of 10 rows are ready; 2 need attention/);
  });

  it('names notification modules for managers', () => {
    expect(notificationModuleLabel('camp')).toBe('Camp One');
    expect(notificationModuleLabel('system')).toBe('Tylo One');
  });
});
