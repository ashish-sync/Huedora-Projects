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

function lineColumnHaystack(col) {
  return `${col?.key || ''} ${col?.label || ''} ${col?.inner || ''} ${displayLineColumnLabel(col)}`
    .toLowerCase()
    .replace(/[\s_.-]+/g, ' ')
    .trim();
}

export function displayLineColumnLabel(col) {
  const raw = String(col?.label || col?.inner || col?.key || '')
    .replace(/\b(Additional\s+)+/gi, 'Additional ')
    .replace(/\s+/g, ' ')
    .trim();
  return LINE_COLUMN_LABEL_ALIASES[raw.toLowerCase()] || raw;
}

/**
 * Detect Per Camp / Round Trip / Remarks-style fields (line-item values).
 * Used to hide duplicate merge fields from the Placeholders form grid.
 */
export function isHiddenLineColumn(col) {
  const hay = lineColumnHaystack(col);
  if (hay.includes('per camp') || (hay.includes('camp') && hay.includes('inr'))) return true;
  if (hay.includes('round trip') || hay.includes('kms covered') || hay.includes('distance covered')) {
    return true;
  }
  if (hay.includes('remark')) return true;
  return false;
}

/** Same detection for scalar template placeholders (not line-table columns). */
export function isHiddenLineValuePlaceholder(placeholder = {}) {
  return isHiddenLineColumn(placeholder);
}

export function visibleLineColumns(columns = []) {
  return (columns || []).filter((col) => !isHiddenLineColumn(col));
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

export function isDeviceNameLineColumn(col) {
  const label = displayLineColumnLabel(col).toLowerCase();
  if (label === 'device name') return true;
  const hay = lineColumnHaystack(col);
  return hay.includes('display name') || hay.includes('device name') || hay.includes('asset name');
}

export function isSerialNumberLineColumn(col) {
  const label = displayLineColumnLabel(col).toLowerCase();
  if (label === 'serial number') return true;
  const hay = lineColumnHaystack(col);
  return hay.includes('serial number') || hay === 'serial' || /\bserial\b/.test(hay);
}

export function findLineColumn(columns = [], predicate) {
  return (columns || []).find((col) => predicate(col)) || null;
}

/** Serials already chosen on other line rows (case-insensitive keys). */
export function collectUsedLineSerials(
  lineRowsByTable = {},
  tables = [],
  { excludeTableId, excludeRowIndex } = {}
) {
  const used = new Set();
  for (const table of tables || []) {
    const serialCol = (table.columns || []).find((col) => isSerialNumberLineColumn(col));
    if (!serialCol) continue;
    const rows = lineRowsByTable[table.id] || [];
    rows.forEach((row, idx) => {
      if (excludeTableId === table.id && excludeRowIndex === idx) return;
      const serial = String(row?.[serialCol.key] || '').trim();
      if (serial) used.add(serial.toLowerCase());
    });
  }
  return used;
}

/**
 * First duplicate serial within line items, or null.
 * @returns {{ serial: string, rowIndex: number, tableId: string } | null}
 */
export function findDuplicateLineSerial(lineRowsByTable = {}, tables = []) {
  const seen = new Map();
  for (const table of tables || []) {
    const serialCol = (table.columns || []).find((col) => isSerialNumberLineColumn(col));
    if (!serialCol) continue;
    const rows = lineRowsByTable[table.id] || [];
    for (let i = 0; i < rows.length; i += 1) {
      const serial = String(rows[i]?.[serialCol.key] || '').trim();
      if (!serial) continue;
      const key = serial.toLowerCase();
      if (seen.has(key)) {
        return { serial, rowIndex: i, tableId: table.id };
      }
      seen.set(key, { tableId: table.id, rowIndex: i });
    }
  }
  return null;
}

/** Unique non-empty serial strings from all line-item tables. */
export function collectLineSerialValues(lineRowsByTable = {}, tables = []) {
  const out = [];
  const seen = new Set();
  for (const table of tables || []) {
    const serialCol = (table.columns || []).find((col) => isSerialNumberLineColumn(col));
    if (!serialCol) continue;
    for (const row of lineRowsByTable[table.id] || []) {
      const serial = String(row?.[serialCol.key] || '').trim();
      if (!serial) continue;
      const key = serial.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(serial);
    }
  }
  return out;
}

function normLineLabel(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\s_.-]+/g, ' ')
    .trim();
}

function canonicalPlaceholderLineLabel(label) {
  const raw = normLineLabel(label);
  return LINE_COLUMN_LABEL_ALIASES[raw] || String(label || '').trim();
}

/**
 * Fill hidden scalar placeholders (Display Name, Per Camp Amt, …) from line-item cells.
 */
export function mergeLineValuesIntoPlaceholders(
  values = {},
  placeholders = [],
  repeatableTables = [],
  lineRows = {}
) {
  const next = { ...(values || {}) };
  for (const p of placeholders || []) {
    const current = next[p.key] ?? next[p.label];
    if (current != null && String(current).trim()) continue;
    const want = canonicalPlaceholderLineLabel(p.label || p.inner || p.key);
    const wantNorm = normLineLabel(want);
    const wantKey = normLineLabel(p.key);
    let found = '';
    for (const table of repeatableTables || []) {
      for (const row of lineRows[table.id] || []) {
        for (const col of table.columns || []) {
          const colCanon = canonicalPlaceholderLineLabel(col.label || col.inner || col.key);
          const colNorm = normLineLabel(colCanon);
          const colKeyNorm = normLineLabel(col.key);
          if (
            colNorm !== wantNorm &&
            colKeyNorm !== wantKey &&
            normLineLabel(col.label) !== wantKey &&
            colNorm !== wantKey
          ) {
            continue;
          }
          const v = row?.[col.key] ?? row?.[col.label] ?? row?.[col.inner];
          if (v != null && String(v).trim()) {
            found = String(v).trim();
            break;
          }
        }
        if (found) break;
      }
      if (found) break;
    }
    if (found) next[p.key] = found;
  }
  return next;
}
