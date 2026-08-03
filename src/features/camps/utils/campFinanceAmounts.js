/** Allow typing decimals freely without number-input reset-to-0 quirks. */
export function sanitizeFinanceAmountInput(raw) {
  let next = String(raw ?? '').replace(/[^\d.]/g, '');
  const dot = next.indexOf('.');
  if (dot !== -1) {
    next = `${next.slice(0, dot + 1)}${next.slice(dot + 1).replace(/\./g, '')}`;
  }
  return next;
}

export function formatFinanceAmountValue(value) {
  if (value === null || value === undefined) return '';
  return String(value);
}

export function parseFinanceAmount(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return 0;
  const num = Number(raw);
  return Number.isFinite(num) ? num : 0;
}

export const FINANCE_REVENUE_PART_FIELDS = ['campRevenue', 'overtimeRevenue', 'otherRevenue'];
export const FINANCE_PAYOUT_PART_FIELDS = ['campAmount', 'travelling', 'overtimeExpense', 'otherExpenses'];
