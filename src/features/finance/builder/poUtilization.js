/** Client Master PO utilization helpers for Billing Center. */

export function formatPoInr(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '₹0';
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export function utilizationTone(pct, remaining) {
  if (remaining <= 0 || pct >= 100) return 'danger';
  if (pct >= 80) return 'warn';
  return 'ok';
}

/**
 * Prefer taxable/subtotal against PO net value (tax is not added to PO ceiling).
 */
export function invoiceAmountAgainstPo(totals) {
  if (!totals) return 0;
  const subtotal = Number(totals.taxableTotal ?? totals.subtotal ?? totals.taxableAmount);
  if (Number.isFinite(subtotal) && subtotal > 0) return Math.round(subtotal * 100) / 100;
  const grand = Number(totals.grandTotal);
  return Number.isFinite(grand) ? Math.round(grand * 100) / 100 : 0;
}

export function projectPoUtilization(poRow, thisAmount = 0) {
  if (!poRow) return null;
  const totalValue = Number(poRow.totalValue ?? poRow.poNetValue) || 0;
  const billedAmount = Number(poRow.billedAmount) || 0;
  const remainingBalance = Math.max(0, Math.round((totalValue - billedAmount) * 100) / 100);
  const amount = Math.max(0, Number(thisAmount) || 0);
  const remainingAfter = Math.round((remainingBalance - amount) * 100) / 100;
  const projectedBilled = Math.round((billedAmount + amount) * 100) / 100;
  const utilizationPct =
    totalValue > 0
      ? Math.round((projectedBilled / totalValue) * 10000) / 100
      : projectedBilled > 0
        ? 100
        : 0;
  return {
    totalValue,
    billedAmount,
    remainingBalance,
    thisAmount: amount,
    remainingAfter,
    utilizationPct,
    exceeds: amount > remainingBalance + 0.009,
  };
}
