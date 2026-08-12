import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  readStoredManageDateFilter,
  writeStoredManageDateFilter,
  clearStoredManageDateFilter,
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

  it('clearStoredManageDateFilter removes the key', () => {
    writeStoredManageDateFilter({ dateFrom: '2026-08-01', dateTo: '' });
    clearStoredManageDateFilter();
    expect(readStoredManageDateFilter()).toEqual({ dateFrom: '', dateTo: '' });
  });
});
