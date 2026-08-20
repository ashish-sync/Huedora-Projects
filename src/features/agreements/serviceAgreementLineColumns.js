/** Canonical labels for Service Agreement line-item table columns (UI display). */

const LINE_COLUMN_LABEL_ALIASES = {
  'display name': 'Device Name',
  'device name': 'Device Name',
  'asset name': 'Device Name',
  'serial no': 'Serial Number',
  'serial no.': 'Serial Number',
  'serial number': 'Serial Number',
  'per camp amt': 'Per Camp (INR)',
  'per camp (inr)': 'Per Camp (INR)',
  'per camp inr': 'Per Camp (INR)',
  'round trip covered': 'Distance Covered (Km)',
  'kms covered': 'Distance Covered (Km)',
  'distance covered (km)': 'Distance Covered (Km)',
  'distance covered': 'Distance Covered (Km)',
  remarks: 'Additional Remarks',
  'additional remarks': 'Additional Remarks',
};

export function displayLineColumnLabel(col) {
  const raw = String(col?.label || col?.inner || col?.key || '')
    .replace(/\b(Additional\s+)+/gi, 'Additional ')
    .replace(/\s+/g, ' ')
    .trim();
  return LINE_COLUMN_LABEL_ALIASES[raw.toLowerCase()] || raw;
}

export function lineColumnClass(col) {
  const hay = `${col?.key || ''} ${displayLineColumnLabel(col)}`.toLowerCase();
  if (hay.includes('serial')) return 'ph-line-col-serial';
  if (hay.includes('camp') || hay.includes('inr') || hay.includes('amt')) return 'ph-line-col-amount';
  if (hay.includes('distance') || hay.includes('kms') || hay.includes('round trip') || /\bkm\b/.test(hay)) {
    return 'ph-line-col-distance';
  }
  if (hay.includes('remark')) return 'ph-line-col-remarks';
  if (hay.includes('device') || hay.includes('display') || hay.includes('name')) return 'ph-line-col-name';
  return 'ph-line-col';
}
