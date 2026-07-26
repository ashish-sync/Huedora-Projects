export function computePurchaseOrderTotals(lineItems, taxRate) {
  const rate = Number(taxRate) || 0;
  const lines = (lineItems || []).map((line) => {
    const qty = Number(line.qty) || 0;
    const unitRate = line.isFoc ? 0 : Number(line.rate) || 0;
    const amount = qty * unitRate;
    return { amount };
  });
  const subtotal = lines.reduce((sum, line) => sum + line.amount, 0);
  const tax = (subtotal * rate) / 100;
  return {
    subtotal,
    tax,
    total: subtotal + tax,
    lines,
  };
}
