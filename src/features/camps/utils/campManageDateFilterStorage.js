const DATE_STORAGE_KEY = 'campOps:manageDateFilter';
const FILTER_STORAGE_KEY = 'campOps:manageFilters';

const EMPTY_DATES = { dateFrom: '', dateTo: '' };

const EMPTY_FILTERS = {
  search: '',
  statusByStage: {
    request: '',
    assignment: '',
    execution: '',
    financial: '',
  },
  dateFrom: '',
  dateTo: '',
  client: '',
  campaign: '',
  campaignType: '',
};

function safeParse(raw) {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Persist Manage Camps date filter across edit/new navigation.
 * Cleared only when the user clears dates (or Clear all).
 */
export function readStoredManageDateFilter() {
  const all = readStoredManageFilters();
  return {
    dateFrom: all.dateFrom,
    dateTo: all.dateTo,
  };
}

export function writeStoredManageDateFilter({ dateFrom = '', dateTo = '' } = {}) {
  const current = readStoredManageFilters();
  writeStoredManageFilters({
    ...current,
    dateFrom,
    dateTo,
  });
}

export function clearStoredManageDateFilter() {
  const current = readStoredManageFilters();
  writeStoredManageFilters({
    ...current,
    dateFrom: '',
    dateTo: '',
  });
}

function normalizeStatusByStage(raw = {}) {
  return {
    request: String(raw.request || '').trim(),
    assignment: String(raw.assignment || '').trim(),
    execution: String(raw.execution || '').trim(),
    financial: String(raw.financial || '').trim(),
  };
}

/**
 * Full Manage Camps filter bag (search text, per-stage status, dates, chips).
 * Survives stage switches and edit navigation until the user clears manually.
 */
export function readStoredManageFilters() {
  if (typeof window === 'undefined') return { ...EMPTY_FILTERS, statusByStage: { ...EMPTY_FILTERS.statusByStage } };

  const fromFilters = safeParse(window.sessionStorage.getItem(FILTER_STORAGE_KEY));
  const fromDates = safeParse(window.sessionStorage.getItem(DATE_STORAGE_KEY));

  const dateFrom = String(fromFilters?.dateFrom || fromDates?.dateFrom || '').trim();
  const dateTo = String(fromFilters?.dateTo || fromDates?.dateTo || '').trim();

  return {
    search: String(fromFilters?.search || '').trim(),
    statusByStage: normalizeStatusByStage(fromFilters?.statusByStage),
    dateFrom,
    dateTo,
    client: String(fromFilters?.client || '').trim(),
    campaign: String(fromFilters?.campaign || '').trim(),
    campaignType: String(fromFilters?.campaignType || '').trim(),
  };
}

export function writeStoredManageFilters(patch = {}) {
  if (typeof window === 'undefined') return;
  try {
    const current = readStoredManageFilters();
    const next = {
      search: patch.search !== undefined ? String(patch.search || '').trim().slice(0, 200) : current.search,
      statusByStage: normalizeStatusByStage(
        patch.statusByStage !== undefined ? patch.statusByStage : current.statusByStage
      ),
      dateFrom: patch.dateFrom !== undefined ? String(patch.dateFrom || '').trim() : current.dateFrom,
      dateTo: patch.dateTo !== undefined ? String(patch.dateTo || '').trim() : current.dateTo,
      client: patch.client !== undefined ? String(patch.client || '').trim().slice(0, 120) : current.client,
      campaign: patch.campaign !== undefined ? String(patch.campaign || '').trim().slice(0, 120) : current.campaign,
      campaignType:
        patch.campaignType !== undefined
          ? String(patch.campaignType || '').trim().slice(0, 80)
          : current.campaignType,
    };

    const hasAny =
      next.search
      || next.dateFrom
      || next.dateTo
      || next.client
      || next.campaign
      || next.campaignType
      || Object.values(next.statusByStage).some(Boolean);

    if (!hasAny) {
      window.sessionStorage.removeItem(FILTER_STORAGE_KEY);
      window.sessionStorage.removeItem(DATE_STORAGE_KEY);
      return;
    }

    window.sessionStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(next));
    // Keep legacy date key in sync for older readers.
    if (next.dateFrom || next.dateTo) {
      window.sessionStorage.setItem(
        DATE_STORAGE_KEY,
        JSON.stringify({ dateFrom: next.dateFrom, dateTo: next.dateTo })
      );
    } else {
      window.sessionStorage.removeItem(DATE_STORAGE_KEY);
    }
  } catch {
    // sessionStorage may be unavailable or full — never break Manage Camps.
  }
}

export function clearStoredManageFilters() {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(FILTER_STORAGE_KEY);
    window.sessionStorage.removeItem(DATE_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export { EMPTY_DATES, EMPTY_FILTERS, FILTER_STORAGE_KEY, DATE_STORAGE_KEY };
