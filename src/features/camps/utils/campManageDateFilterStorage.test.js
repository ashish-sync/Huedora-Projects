import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  readStoredManageDateFilter,
  writeStoredManageDateFilter,
  clearStoredManageDateFilter,
  readStoredManageFilters,
  writeStoredManageFilters,
  clearStoredManageFilters,
} from './campManageDateFilterStorage.js';

describe('campManageDateFilterStorage', () => {
  beforeEach(() => {
    const store = new Map();
    vi.stubGlobal('sessionStorage', {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => { store.set(key, String(value)); },
      removeItem: (key) => { store.delete(key); },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns empty when nothing stored', () => {
    expect(readStoredManageDateFilter()).toEqual({ dateFrom: '', dateTo: '' });
  });

  it('persists and reads a date range', () => {
    writeStoredManageDateFilter({ dateFrom: '2026-08-01', dateTo: '2026-08-12' });
    expect(readStoredManageDateFilter()).toEqual({
      dateFrom: '2026-08-01',
      dateTo: '2026-08-12',
    });
  });

  it('clears storage when writing an empty range', () => {
    writeStoredManageDateFilter({ dateFrom: '2026-08-01', dateTo: '2026-08-12' });
    writeStoredManageDateFilter({ dateFrom: '', dateTo: '' });
    expect(readStoredManageDateFilter()).toEqual({ dateFrom: '', dateTo: '' });
  });

  it('clearStoredManageDateFilter removes dates but keeps other filters', () => {
    writeStoredManageFilters({
      search: 'nutri',
      dateFrom: '2026-08-01',
      dateTo: '',
      statusByStage: { request: 'review_pending' },
    });
    clearStoredManageDateFilter();
    expect(readStoredManageDateFilter()).toEqual({ dateFrom: '', dateTo: '' });
    expect(readStoredManageFilters().search).toBe('nutri');
    expect(readStoredManageFilters().statusByStage.request).toBe('review_pending');
  });

  it('persists typed search and per-stage status until cleared', () => {
    writeStoredManageFilters({
      search: '1702',
      statusByStage: { request: 'review_pending', assignment: 'Assigned' },
      client: 'Acme',
    });
    expect(readStoredManageFilters()).toMatchObject({
      search: '1702',
      statusByStage: {
        request: 'review_pending',
        assignment: 'Assigned',
        execution: '',
        financial: '',
      },
      client: 'Acme',
    });
    clearStoredManageFilters();
    expect(readStoredManageFilters().search).toBe('');
    expect(readStoredManageFilters().statusByStage.request).toBe('');
  });
});
