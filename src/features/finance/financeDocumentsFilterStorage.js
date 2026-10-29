import { PAGE_SIZES } from '../../shared/validation.js';
import { COMMERCIAL_DOC_TYPES } from './commercialDocumentConfig.js';
import {
  COMMERCIAL_STAGE_FILTERS,
  commercialStatusFilterOptions,
} from './commercialPaymentStatus.js';

export const SAVED_DOCUMENTS_FILTER_STORAGE_KEY = 'financeOne:savedDocumentsFilters';

const DOC_TYPE_KEYS = new Set(COMMERCIAL_DOC_TYPES.map((t) => t.key));
const STAGE_VALUES = new Set(COMMERCIAL_STAGE_FILTERS.map((opt) => opt.value));
const PAGE_SIZE_SET = new Set(PAGE_SIZES);

const listeners = new Set();

export const EMPTY_SAVED_DOCUMENT_FILTERS = {
  q: '',
  orgProfileId: '',
  documentType: '',
  status: '',
  paymentStatus: '',
  dateFrom: '',
  dateTo: '',
  page: 1,
  limit: 25,
};

function safeParse(raw) {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function allowedOrgId(value) {
  const id = String(value || '').trim();
  if (!id || id.length > 64) return '';
  return /^[A-Za-z0-9_-]+$/.test(id) ? id : '';
}

function allowedIsoDate(value) {
  const day = String(value || '').trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : '';
}

function allowedPage(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 9999) return 1;
  return n;
}

function allowedLimit(value) {
  const n = Number(value);
  return PAGE_SIZE_SET.has(n) ? n : 25;
}

function emitSavedDocumentFilters(next) {
  listeners.forEach((listener) => {
    try {
      listener(next);
    } catch {
      /* ignore listener errors */
    }
  });
}

export function subscribeSavedDocumentFilters(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function normalizeSavedDocumentFilters(raw = {}) {
  const documentType = DOC_TYPE_KEYS.has(String(raw.documentType || '').trim())
    ? String(raw.documentType).trim()
    : '';
  const status = STAGE_VALUES.has(String(raw.status || '').trim())
    ? String(raw.status).trim()
    : '';
  const paymentRaw = String(raw.paymentStatus || '').trim();
  const allowedPay = new Set(commercialStatusFilterOptions(documentType));
  const paymentStatus = allowedPay.has(paymentRaw) ? paymentRaw : '';
  let dateFrom = allowedIsoDate(raw.dateFrom);
  let dateTo = allowedIsoDate(raw.dateTo);
  if (dateFrom && dateTo && dateFrom > dateTo) {
    const swap = dateFrom;
    dateFrom = dateTo;
    dateTo = swap;
  }

  return {
    q: String(raw.q || '').slice(0, 200),
    orgProfileId: allowedOrgId(raw.orgProfileId),
    documentType,
    status,
    paymentStatus,
    dateFrom,
    dateTo,
    page: allowedPage(raw.page),
    limit: allowedLimit(raw.limit),
  };
}

function hasAnyFilter(filters) {
  return Boolean(
    filters.q.trim()
      || filters.orgProfileId
      || filters.documentType
      || filters.status
      || filters.paymentStatus
      || filters.dateFrom
      || filters.dateTo
      || filters.page !== 1
      || filters.limit !== 25,
  );
}

/**
 * Saved Documents search + dropdowns + date range. Survives opening a document
 * and returning until the user changes or clears them.
 */
export function readStoredSavedDocumentFilters() {
  if (typeof window === 'undefined') return { ...EMPTY_SAVED_DOCUMENT_FILTERS };
  const parsed = safeParse(window.sessionStorage.getItem(SAVED_DOCUMENTS_FILTER_STORAGE_KEY));
  if (!parsed || typeof parsed !== 'object') return { ...EMPTY_SAVED_DOCUMENT_FILTERS };
  return normalizeSavedDocumentFilters(parsed);
}

export function writeStoredSavedDocumentFilters(patch = {}) {
  if (typeof window === 'undefined') return;
  try {
    const next = normalizeSavedDocumentFilters({
      ...readStoredSavedDocumentFilters(),
      ...patch,
    });
    if (!hasAnyFilter(next)) {
      window.sessionStorage.removeItem(SAVED_DOCUMENTS_FILTER_STORAGE_KEY);
      emitSavedDocumentFilters({ ...EMPTY_SAVED_DOCUMENT_FILTERS });
      return;
    }
    window.sessionStorage.setItem(SAVED_DOCUMENTS_FILTER_STORAGE_KEY, JSON.stringify(next));
    emitSavedDocumentFilters(next);
  } catch {
    // sessionStorage may be unavailable or full — never break Saved Documents.
  }
}

export function clearStoredSavedDocumentFilters() {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(SAVED_DOCUMENTS_FILTER_STORAGE_KEY);
    emitSavedDocumentFilters({ ...EMPTY_SAVED_DOCUMENT_FILTERS });
  } catch {
    /* ignore */
  }
}

export function savedDocumentsListQuery(filters = readStoredSavedDocumentFilters(), paging = {}) {
  const page = paging.page ?? filters.page;
  const limit = paging.limit ?? filters.limit;
  const params = new URLSearchParams();
  if (paging.includePaging !== false) {
    params.set('page', String(page));
    params.set('limit', String(limit));
  }
  if (filters.q.trim()) params.set('q', filters.q.trim());
  if (filters.orgProfileId) params.set('orgProfileId', filters.orgProfileId);
  if (filters.status) params.set('status', filters.status);
  if (filters.paymentStatus) params.set('paymentStatus', filters.paymentStatus);
  if (filters.documentType) params.set('documentType', filters.documentType);
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) params.set('dateTo', filters.dateTo);
  return params;
}
