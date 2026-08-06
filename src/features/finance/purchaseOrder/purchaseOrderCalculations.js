import {
  amountInWordsIndian,
  computeInvoiceTotals,
  computeLineItem,
  resolveLineGstRates,
  resolveTaxMode,
  usesIgst,
} from '../invoiceGenerator/invoiceCalculations.js';

export { amountInWordsIndian, usesIgst, resolveTaxMode, computeLineItem };

export function computePurchaseOrderTotals(form) {
  const taxMode = resolveTaxMode(form.vendor?.stateCode, form.company?.stateCode);
  const lineItems = (form.lineItems || []).map((line) => {
    const base = !line.isFoc ? line : { ...line, rate: 0, discount: 0 };
    return { ...base, ...resolveLineGstRates(base, taxMode) };
  });
  const totals = computeInvoiceTotals(lineItems, taxMode, {
    roundOff: form.roundOff ?? form.adjustments?.roundOff,
  });
  return {
    ...totals,
    total: totals.grandTotal,
    taxMode,
  };
}
