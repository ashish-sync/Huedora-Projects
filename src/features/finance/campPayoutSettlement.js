/**
 * Payout Queue settlement: status is derived from Paid Amount vs Total Payout.
 * Maps to Finance One codes: paid | under_review (partial) | not_paid.
 */

export const PAYOUT_SETTLEMENT_LABELS = {
  paid: 'Paid in Full',
  under_review: 'Partially Paid',
  not_paid: 'Not Paid',
};

export function toMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

/**
 * @returns {'paid'|'under_review'|'not_paid'}
 */
export function derivePayoutSettlementStatus(paidAmount, totalPayout) {
  const paid = toMoney(paidAmount);
  const total = toMoney(totalPayout);
  if (paid <= 0) return 'not_paid';
  // Allow tiny float noise when comparing full payment.
  if (total > 0 && paid + 0.009 < total) return 'under_review';
  return 'paid';
}

export function payoutSettlementLabel(status) {
  return PAYOUT_SETTLEMENT_LABELS[status] || PAYOUT_SETTLEMENT_LABELS.not_paid;
}

/** True when any money was recorded — UTR + Payment Date required. */
export function settlementRequiresPaymentProof(status) {
  return status === 'paid' || status === 'under_review';
}

/**
 * Split a combined paid amount across camps by each camp's total payout share.
 * Rounding remainder is applied to the last camp so the sum matches.
 */
export function allocateBulkPaidAmounts(campTotals, combinedPaidAmount) {
  const totals = campTotals.map((t) => toMoney(t));
  const combinedTotal = toMoney(totals.reduce((sum, t) => sum + t, 0));
  const paid = toMoney(combinedPaidAmount);
  const status = derivePayoutSettlementStatus(paid, combinedTotal);

  if (status === 'not_paid') {
    return { status, amounts: totals.map(() => 0), combinedTotal };
  }
  if (status === 'paid' || combinedTotal <= 0) {
    return { status: combinedTotal <= 0 && paid > 0 ? 'paid' : status, amounts: [...totals], combinedTotal };
  }

  const amounts = [];
  let allocated = 0;
  for (let i = 0; i < totals.length; i += 1) {
    if (i === totals.length - 1) {
      amounts.push(toMoney(paid - allocated));
      break;
    }
    const share = combinedTotal > 0 ? toMoney((totals[i] / combinedTotal) * paid) : 0;
    amounts.push(share);
    allocated = toMoney(allocated + share);
  }
  return { status, amounts, combinedTotal };
}
