import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  EMPTY_SAVED_DOCUMENT_FILTERS,
  SAVED_DOCUMENTS_FILTER_STORAGE_KEY,
  clearStoredSavedDocumentFilters,
  normalizeSavedDocumentFilters,
  readStoredSavedDocumentFilters,
  savedDocumentsListQuery,
  writeStoredSavedDocumentFilters,
} from './financeDocumentsFilterStorage.js';

describe('financeDocumentsFilterStorage', () => {
  beforeEach(() => {
    const store = new Map();
    vi.stubGlobal('sessionStorage', {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => {
        store.set(key, String(value));
      },
      removeItem: (key) => {
        store.delete(key);
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns empty filters when nothing is stored', () => {
    expect(readStoredSavedDocumentFilters()).toEqual(EMPTY_SAVED_DOCUMENT_FILTERS);
  });

  it('persists search and dropdowns until cleared', () => {
    writeStoredSavedDocumentFilters({
      q: 'RD-BOS',
      orgProfileId: 'org123abc',
      documentType: 'bill_of_supply',
      status: 'Issued',
      paymentStatus: 'Paid',
      page: 2,
      limit: 50,
    });

    expect(readStoredSavedDocumentFilters()).toEqual({
      q: 'RD-BOS',
      orgProfileId: 'org123abc',
      documentType: 'bill_of_supply',
      status: 'Issued',
      paymentStatus: 'Paid',
      dateFrom: '',
      dateTo: '',
      page: 2,
      limit: 50,
    });

    clearStoredSavedDocumentFilters();
    expect(readStoredSavedDocumentFilters()).toEqual(EMPTY_SAVED_DOCUMENT_FILTERS);
    expect(sessionStorage.getItem(SAVED_DOCUMENTS_FILTER_STORAGE_KEY)).toBeNull();
  });

  it('clears storage when writing empty filters', () => {
    writeStoredSavedDocumentFilters({ documentType: 'bill_of_supply', status: 'Issued' });
    writeStoredSavedDocumentFilters(EMPTY_SAVED_DOCUMENT_FILTERS);
    expect(sessionStorage.getItem(SAVED_DOCUMENTS_FILTER_STORAGE_KEY)).toBeNull();
  });

  it('drops invalid document type, stage, and status for the selected type', () => {
    expect(
      normalizeSavedDocumentFilters({
        documentType: 'not-a-type',
        status: 'Approved',
        paymentStatus: 'Paid',
      }),
    ).toMatchObject({
      documentType: '',
      status: '',
      paymentStatus: 'Paid',
    });

    expect(
      normalizeSavedDocumentFilters({
        documentType: 'quotation',
        paymentStatus: 'Paid',
      }).paymentStatus,
    ).toBe('');
  });

  it('keeps a status that is valid for the selected document type', () => {
    expect(
      normalizeSavedDocumentFilters({
        documentType: 'quotation',
        paymentStatus: 'Accepted',
      }).paymentStatus,
    ).toBe('Accepted');
  });

  it('persists a date range until cleared', () => {
    writeStoredSavedDocumentFilters({ dateFrom: '2026-10-01', dateTo: '2026-10-28' });
    expect(readStoredSavedDocumentFilters()).toMatchObject({
      dateFrom: '2026-10-01',
      dateTo: '2026-10-28',
    });
    clearStoredSavedDocumentFilters();
    expect(readStoredSavedDocumentFilters().dateFrom).toBe('');
    expect(readStoredSavedDocumentFilters().dateTo).toBe('');
  });

  it('puts date filters on the list query string', () => {
    const params = savedDocumentsListQuery(
      {
        ...EMPTY_SAVED_DOCUMENT_FILTERS,
        documentType: 'bill_of_supply',
        dateFrom: '2026-10-01',
        dateTo: '2026-10-28',
      },
      { includePaging: false },
    );
    expect(params.get('documentType')).toBe('bill_of_supply');
    expect(params.get('dateFrom')).toBe('2026-10-01');
    expect(params.get('dateTo')).toBe('2026-10-28');
    expect(params.get('page')).toBeNull();
  });
});
