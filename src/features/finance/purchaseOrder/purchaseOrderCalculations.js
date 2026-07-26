import {
  amountInWordsIndian,
  computeInvoiceTotals,
  computeLineItem,
  usesIgst,
} from '../invoiceGenerator/invoiceCalculations.js';

export { amountInWordsIndian, usesIgst, computeLineItem };

export function computePurchaseOrderTotals(form) {
  const taxMode = usesIgst(form.vendor?.stateCode, form.company?.stateCode) ? 'igst' : 'cgst_sgst';
  const lineItems = (form.lineItems || []).map((line) => {
    if (!line.isFoc) return line;
    return { ...line, rate: 0, discount: 0 };
  });
  const totals = computeInvoiceTotals(lineItems, taxMode, {});
  return {
    ...totals,
    total: totals.grandTotal,
    taxMode,
  };
}
