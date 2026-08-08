/** Client Master PO utilization helpers for Billing Center. */

/** Hide POs from Billing PO / WO picker when remaining balance is below this. */
export const MIN_PO_REMAINING_TO_BILL = 1500;

export function formatPoInr(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '₹0';
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export function poRemainingBalance(po) {
  const rem = Number(po?.remainingBalance);
  if (Number.isFinite(rem)) return Math.max(0, Math.round(rem * 100) / 100);
  const total = Number(po?.totalValue ?? po?.poGrossValue ?? po?.poNetValue) || 0;
  const billed = Number(po?.billedAmount) || 0;
  return Math.max(0, Math.round((total - billed) * 100) / 100);
}

/** True when a Client Master PO may be offered on Tax Invoice / Bill of Supply. */
export function isPoSelectableForBilling(po, { selectedPoId = '', minRemaining = MIN_PO_REMAINING_TO_BILL } = {}) {
  if (!po) return false;
  if (selectedPoId && String(po.id) === String(selectedPoId)) return true;
  return poRemainingBalance(po) >= minRemaining;
}

export function utilizationTone(pct, remaining) {
  if (remaining <= 0 || pct >= 100) return 'danger';
  if (pct >= 80) return 'warn';
  return 'ok';
}

/**
 * Use Total Bill Value (grand total incl. tax) against PO balance.
 */
export function invoiceAmountAgainstPo(totals) {
  if (!totals) return 0;
  const grand = Number(totals.grandTotal ?? totals.totalBillValue ?? totals.totalAmount);
  if (Number.isFinite(grand) && grand > 0) return Math.round(grand * 100) / 100;
  const subtotal = Number(totals.taxableTotal ?? totals.subtotal ?? totals.taxableAmount);
  return Number.isFinite(subtotal) ? Math.round(subtotal * 100) / 100 : 0;
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
