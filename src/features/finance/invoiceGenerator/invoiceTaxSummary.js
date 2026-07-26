/**
 * Aggregate line-level GST into rate-wise summary rows for the tax summary table.
 */

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

export function aggregateTaxByRate(lines = [], taxMode = 'igst') {
  const map = new Map();

  for (const line of lines) {
    const taxable = Number(line.taxableAmount) || 0;
    if (taxable <= 0) continue;

    if (taxMode === 'igst') {
      const rate = Number(line.igstRate) || Number(line.gstRate) || 0;
      const key = `igst-${rate}`;
      const entry = map.get(key) || {
        hsnSac: line.hsnSac || '—',
        taxable: 0,
        igstRate: rate,
        igstAmount: 0,
        cgstRate: 0,
        cgstAmount: 0,
        sgstRate: 0,
        sgstAmount: 0,
        totalTax: 0,
      };
      entry.taxable += taxable;
      entry.igstAmount += Number(line.igstAmount) || Number(line.taxAmount) || 0;
      entry.totalTax += Number(line.igstAmount) || Number(line.taxAmount) || 0;
      map.set(key, entry);
    } else {
      const cgstRate = Number(line.cgstRate) || 0;
      const sgstRate = Number(line.sgstRate) || 0;
      const key = `cgst-${cgstRate}-sgst-${sgstRate}`;
      const entry = map.get(key) || {
        hsnSac: line.hsnSac || '—',
        taxable: 0,
        igstRate: 0,
        igstAmount: 0,
        cgstRate,
        cgstAmount: 0,
        sgstRate,
        sgstAmount: 0,
        totalTax: 0,
      };
      entry.taxable += taxable;
      entry.cgstAmount += Number(line.cgstAmount) || 0;
      entry.sgstAmount += Number(line.sgstAmount) || 0;
      entry.totalTax += (Number(line.cgstAmount) || 0) + (Number(line.sgstAmount) || 0);
      map.set(key, entry);
    }
  }

  return [...map.values()].map((row) => ({
    ...row,
    taxable: round2(row.taxable),
    igstAmount: round2(row.igstAmount),
    cgstAmount: round2(row.cgstAmount),
    sgstAmount: round2(row.sgstAmount),
    totalTax: round2(row.totalTax),
  }));
}

export function sumLineDiscounts(lines = []) {
  return round2(lines.reduce((s, l) => s + (Number(l.discount) || 0), 0));
}
