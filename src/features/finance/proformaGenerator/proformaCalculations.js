import {
  amountInWordsIndian,
  computeLineItem,
  formatDisplayDate,
  formatInr,
  usesIgst,
} from '../invoiceGenerator/invoiceCalculations.js';

export { formatDisplayDate, formatInr, usesIgst };

export function aggregateTax(lines, taxMode = 'igst') {
  const map = new Map();
  for (const row of lines) {
    if (row.type === 'section') continue;
    const rate = Number(row.gstRate) || 0;
    const key = `${taxMode}-${rate}`;
    const entry = map.get(key) || { rate, taxable: 0, igst: 0, cgst: 0, sgst: 0, gstAmount: 0 };
    entry.taxable += Number(row.taxableAmount) || 0;
    entry.gstAmount += Number(row.taxAmount) || 0;
    if (taxMode === 'igst') {
      entry.igst += Number(row.igstAmount) || Number(row.taxAmount) || 0;
    } else {
      entry.cgst += Number(row.cgstAmount) || 0;
      entry.sgst += Number(row.sgstAmount) || 0;
    }
    map.set(key, entry);
  }
  return [...map.values()].map((r) => ({
    ...r,
    taxable: Math.round(r.taxable * 100) / 100,
    igst: Math.round(r.igst * 100) / 100,
    cgst: Math.round(r.cgst * 100) / 100,
    sgst: Math.round(r.sgst * 100) / 100,
    gstAmount: Math.round(r.gstAmount * 100) / 100,
  }));
}

export function computeProformaDocument(rows, taxMode = 'igst', adjustments = {}) {
  let serial = 0;
  const enriched = (rows || []).map((row) => {
    if (row.type === 'section') {
      return { ...row, kind: 'section' };
    }
    serial += 1;
    const computed = computeLineItem(row, taxMode);
    return { ...computed, type: 'line', kind: 'line', serial };
  });

  const lineRows = enriched.filter((r) => r.kind === 'line');
  const subtotal = lineRows.reduce((s, l) => s + l.taxableAmount, 0);
  const taxAmount = lineRows.reduce((s, l) => s + l.taxAmount, 0);
  const totalDiscount = lineRows.reduce((s, l) => s + (Number(l.discount) || 0), 0);
  const rawTotal = subtotal + taxAmount;
  const autoRoundOff = Math.round((Math.round(rawTotal) - rawTotal) * 100) / 100;
  const hasManualRoundOff =
    adjustments.roundOff !== undefined &&
    adjustments.roundOff !== null &&
    String(adjustments.roundOff).trim() !== '';
  const roundOff = hasManualRoundOff
    ? Math.round((Number(adjustments.roundOff) || 0) * 100) / 100
    : autoRoundOff;
  const grandTotal = Math.round((rawTotal + roundOff) * 100) / 100;

  return {
    rows: enriched,
    taxRows: aggregateTax(lineRows, taxMode),
    subtotal: Math.round(subtotal * 100) / 100,
    taxAmount: Math.round(taxAmount * 100) / 100,
    totalDiscount,
    cnAmount: 0,
    dnAmount: 0,
    advanceReceived: 0,
    roundOff,
    grandTotal,
    amountInWords: amountInWordsIndian(grandTotal),
    taxMode,
  };
}
