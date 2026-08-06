const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigits(n) {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return `${TENS[t]}${o ? ` ${ONES[o]}` : ''}`;
}

function threeDigits(n) {
  if (n < 100) return twoDigits(n);
  const h = Math.floor(n / 100);
  const rest = n % 100;
  return `${ONES[h]} Hundred${rest ? ` ${twoDigits(rest)}` : ''}`;
}

export function amountInWordsIndian(amount) {
  const value = Math.round(Number(amount) * 100) / 100;
  if (!Number.isFinite(value) || value === 0) return 'Zero Only';

  const rupees = Math.floor(Math.abs(value));
  const paise = Math.round((Math.abs(value) - rupees) * 100);

  const parts = [];
  const crore = Math.floor(rupees / 10000000);
  const lakh = Math.floor((rupees % 10000000) / 100000);
  const thousand = Math.floor((rupees % 100000) / 1000);
  const hundred = rupees % 1000;

  if (crore) parts.push(`${threeDigits(crore)} Crore`);
  if (lakh) parts.push(`${threeDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${threeDigits(thousand)} Thousand`);
  if (hundred) parts.push(threeDigits(hundred));

  let words = parts.join(' ').trim() || 'Zero';
  if (paise) words += ` and ${twoDigits(paise)} Paise`;
  return `${words} Only`;
}

export function formatInr(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return '0.00';
  return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatDisplayDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd} - ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()]} - ${yyyy}`;
}

export function computeLineItem(line, taxMode = 'igst') {
  const qty = Number(line.qty) || 0;
  const rate = Number(line.rate) || 0;
  const discount = Number(line.discount) || 0;
  const taxableAmount = Math.max(qty * rate - discount, 0);
  const { igstRate, cgstRate, sgstRate } = resolveLineGstRates(line, taxMode);

  let igstAmount = 0;
  let cgstAmount = 0;
  let sgstAmount = 0;

  if (taxMode === 'igst') {
    igstAmount = Math.round((taxableAmount * igstRate) / 100 * 100) / 100;
  } else {
    cgstAmount = Math.round((taxableAmount * cgstRate) / 100 * 100) / 100;
    sgstAmount = Math.round((taxableAmount * sgstRate) / 100 * 100) / 100;
  }

  const taxAmount = igstAmount + cgstAmount + sgstAmount;
  const totalAmount = Math.round((taxableAmount + taxAmount) * 100) / 100;
  const gstRate = taxMode === 'igst' ? igstRate : cgstRate + sgstRate;

  return {
    ...line,
    qty,
    rate,
    discount,
    taxableAmount,
    igstRate,
    cgstRate,
    sgstRate,
    igstAmount,
    cgstAmount,
    sgstAmount,
    taxAmount,
    totalAmount,
    gstRate,
  };
}

export function computeInvoiceTotals(lineItems, taxMode = 'igst', adjustments = {}) {
  const lines = lineItems.map((line) => computeLineItem(line, taxMode));
  const subtotal = lines.reduce((s, l) => s + l.taxableAmount, 0);
  const totalDiscount = lines.reduce((s, l) => s + (Number(l.discount) || 0), 0);
  const taxAmount = lines.reduce((s, l) => s + l.taxAmount, 0);
  const cnAmount = Number(adjustments.cnAmount) || 0;
  const dnAmount = Number(adjustments.dnAmount) || 0;
  const advanceReceived = Number(adjustments.advanceReceived) || 0;
  const rawTotal = subtotal + taxAmount + dnAmount - cnAmount - advanceReceived;
  const rounded = Math.round(rawTotal);
  const roundOff = Math.round((rounded - rawTotal) * 100) / 100;
  const grandTotal = Math.round((rawTotal + roundOff) * 100) / 100;

  return {
    lines,
    subtotal: Math.round(subtotal * 100) / 100,
    totalGrossAmount: Math.round(
      lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.rate) || 0), 0) * 100
    ) / 100,
    totalDiscount: Math.round(totalDiscount * 100) / 100,
    totalIgstAmount: Math.round(
      lines.reduce((s, l) => s + (Number(l.igstAmount) || 0), 0) * 100
    ) / 100,
    totalCgstAmount: Math.round(
      lines.reduce((s, l) => s + (Number(l.cgstAmount) || 0), 0) * 100
    ) / 100,
    totalSgstAmount: Math.round(
      lines.reduce((s, l) => s + (Number(l.sgstAmount) || 0), 0) * 100
    ) / 100,
    totalLineAmount: Math.round(lines.reduce((s, l) => s + l.totalAmount, 0) * 100) / 100,
    taxAmount: Math.round(taxAmount * 100) / 100,
    cnAmount,
    dnAmount,
    advanceReceived,
    roundOff,
    grandTotal,
    amountInWords: amountInWordsIndian(grandTotal),
  };
}

/**
 * Intra-state → CGST+SGST; inter-state → IGST.
 * Missing either code defaults to IGST (safer until both are known).
 */
export function usesIgst(recipientStateCode, orgStateCode) {
  const r = String(recipientStateCode || '').trim();
  const o = String(orgStateCode || '').trim();
  if (!r || !o) return true;
  return r !== o;
}

export function resolveTaxMode(recipientStateCode, orgStateCode) {
  return usesIgst(recipientStateCode, orgStateCode) ? 'igst' : 'cgst_sgst';
}

/**
 * Derive CGST/SGST or IGST rates from whichever fields are filled.
 * Same-state: split a combined GST% equally across CGST + SGST.
 * Different-state: use IGST% (or combine CGST+SGST into IGST).
 */
export function resolveLineGstRates(line = {}, taxMode = 'igst') {
  const igstRaw = Number(line.igstRate);
  const cgstRaw = Number(line.cgstRate);
  const sgstRaw = Number(line.sgstRate);
  const gstRaw = Number(line.gstRate);
  const hasIgst = Number.isFinite(igstRaw) && igstRaw > 0;
  const hasSplit =
    (Number.isFinite(cgstRaw) && cgstRaw > 0) || (Number.isFinite(sgstRaw) && sgstRaw > 0);
  const combinedSplit =
    (Number.isFinite(cgstRaw) ? cgstRaw : 0) + (Number.isFinite(sgstRaw) ? sgstRaw : 0);
  const combined =
    hasIgst ? igstRaw : hasSplit ? combinedSplit : Number.isFinite(gstRaw) && gstRaw > 0 ? gstRaw : 0;

  if (taxMode === 'igst') {
    return { igstRate: combined, cgstRate: 0, sgstRate: 0 };
  }

  if (hasSplit) {
    return {
      igstRate: 0,
      cgstRate: Number.isFinite(cgstRaw) ? cgstRaw : 0,
      sgstRate: Number.isFinite(sgstRaw) ? sgstRaw : 0,
    };
  }

  const half = Math.round((combined / 2) * 100) / 100;
  return { igstRate: 0, cgstRate: half, sgstRate: half };
}

/** Default GST column headers — user can rename on the document. */
export const DEFAULT_TAX_COLUMN_LABELS = {
  rateLabel: 'GST %',
  amountLabel: 'GST',
};

export function resolveTaxColumnLabels(form) {
  const custom = form?.taxColumnLabels || {};
  return {
    rateLabel: String(custom.rateLabel ?? '').trim() || DEFAULT_TAX_COLUMN_LABELS.rateLabel,
    amountLabel: String(custom.amountLabel ?? '').trim() || DEFAULT_TAX_COLUMN_LABELS.amountLabel,
  };
}

/** Combined GST rate shown in the single rate column. */
export function getLineGstRateDisplay(line, taxMode = 'igst') {
  const rates = resolveLineGstRates(line, taxMode);
  if (taxMode === 'igst') {
    return rates.igstRate ? String(rates.igstRate) : '';
  }
  const combined = (Number(rates.cgstRate) || 0) + (Number(rates.sgstRate) || 0);
  return combined ? String(combined) : '';
}

/** Map edited GST% to the correct underlying rate fields. */
export function patchLineGstRate(value, taxMode = 'igst') {
  const trimmed = String(value ?? '').trim();
  if (trimmed === '') {
    return taxMode === 'igst'
      ? { igstRate: '' }
      : { cgstRate: '', sgstRate: '' };
  }
  const rate = Number(trimmed);
  if (!Number.isFinite(rate)) {
    return taxMode === 'igst' ? { igstRate: value } : { cgstRate: value, sgstRate: value };
  }
  if (taxMode === 'igst') {
    return { igstRate: trimmed, cgstRate: 0, sgstRate: 0 };
  }
  const half = Math.round((rate / 2) * 100) / 100;
  const halfStr = Number.isInteger(half) ? String(half) : String(half);
  return { cgstRate: halfStr, sgstRate: halfStr, igstRate: 0 };
}

export function formatGstRateDisplay(line, taxMode = 'igst') {
  const raw = getLineGstRateDisplay(line, taxMode);
  if (!raw) return '—';
  return `${raw}%`;
}
