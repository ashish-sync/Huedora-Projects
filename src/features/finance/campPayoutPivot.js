import { financePaymentStatusLabel } from '../camps/constants/campLifecycle.js';

export const PAYOUT_PIVOT_DIMENSIONS = [
  {
    id: 'client',
    label: 'Client',
    getKey: (row) => String(row.clientName || '').trim() || '—',
    getLabel: (key) => key,
  },
  {
    id: 'method',
    label: 'Method',
    getKey: (row) => String(row.campaignName || '').trim() || '—',
    getLabel: (key) => key,
  },
  {
    id: 'role',
    label: 'HCW Role',
    getKey: (row) => String(row.hcwCategory || '').trim() || '—',
    getLabel: (key) => key,
  },
  {
    id: 'hcw',
    label: 'Payee',
    getKey: (row) => String(row.payeeName || row.hcwName || '').trim() || '—',
    getLabel: (key) => key,
  },
  {
    id: 'status',
    label: 'Payment status',
    getKey: (row) => String(row.financePaymentStatus || 'under_review').trim() || 'under_review',
    getLabel: (key) => financePaymentStatusLabel(key),
  },
  {
    id: 'month',
    label: 'Camp month',
    getKey: (row) => {
      if (row.campMonth) return row.campMonth;
      const raw = String(row.campDate || '').slice(0, 7);
      return /^\d{4}-\d{2}$/.test(raw) ? raw : '—';
    },
    getLabel: (key) => {
      if (!key || key === '—') return '—';
      const [year, month] = key.split('-');
      const date = new Date(Number(year), Number(month) - 1, 1);
      if (Number.isNaN(date.getTime())) return key;
      return date.toLocaleString('en-IN', { month: 'short', year: 'numeric' });
    },
  },
  {
    id: 'division',
    label: 'Division',
    getKey: (row) => String(row.campaignType || '').trim() || '—',
    getLabel: (key) => key,
  },
];

export function getPivotDimension(id) {
  return PAYOUT_PIVOT_DIMENSIONS.find((dim) => dim.id === id) || PAYOUT_PIVOT_DIMENSIONS[0];
}

function sumPayout(rows = []) {
  return Math.round(
    rows.reduce((sum, row) => sum + (Number(row.totalPayout) || 0), 0) * 100,
  ) / 100;
}

function unpaidRows(rows = []) {
  return rows.filter((row) => String(row.financePaymentStatus || '') !== 'paid');
}

/**
 * Build Excel-style pivot groups (1 or 2 levels).
 */
export function buildPayoutPivotGroups(rows = [], primaryId = 'client', secondaryId = '') {
  const primary = getPivotDimension(primaryId);
  const secondary = secondaryId && secondaryId !== primaryId
    ? getPivotDimension(secondaryId)
    : null;

  const primaryMap = new Map();
  for (const row of rows) {
    const key = primary.getKey(row);
    if (!primaryMap.has(key)) primaryMap.set(key, []);
    primaryMap.get(key).push(row);
  }

  const groups = Array.from(primaryMap.entries())
    .map(([key, groupRows]) => {
      const sortedRows = [...groupRows].sort((a, b) =>
        String(b.submittedToFinanceAt || '').localeCompare(String(a.submittedToFinanceAt || '')),
      );
      const unpaid = unpaidRows(sortedRows);
      const children = secondary
        ? buildSecondaryGroups(sortedRows, secondary)
        : null;

      return {
        id: `${primary.id}:${key}`,
        key,
        label: primary.getLabel(key),
        dimensionId: primary.id,
        rows: sortedRows,
        children,
        campCount: sortedRows.length,
        unpaidCount: unpaid.length,
        totalPayout: sumPayout(sortedRows),
        unpaidPayout: sumPayout(unpaid),
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));

  return {
    primary,
    secondary,
    groups,
    totals: {
      campCount: rows.length,
      unpaidCount: unpaidRows(rows).length,
      totalPayout: sumPayout(rows),
      unpaidPayout: sumPayout(unpaidRows(rows)),
    },
  };
}

function buildSecondaryGroups(rows, secondary) {
  const map = new Map();
  for (const row of rows) {
    const key = secondary.getKey(row);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }
  return Array.from(map.entries())
    .map(([key, groupRows]) => {
      const unpaid = unpaidRows(groupRows);
      return {
        id: `${secondary.id}:${key}`,
        key,
        label: secondary.getLabel(key),
        dimensionId: secondary.id,
        rows: groupRows,
        campCount: groupRows.length,
        unpaidCount: unpaid.length,
        totalPayout: sumPayout(groupRows),
        unpaidPayout: sumPayout(unpaid),
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
}

export function formatInr(amount) {
  const value = Number(amount) || 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value);
}
