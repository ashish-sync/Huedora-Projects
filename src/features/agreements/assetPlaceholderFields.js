/** Map Document One template placeholders to Asset Registry fields. */

function normToken(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\s_-]+/g, ' ')
    .trim();
}

export function placeholderAssetField(placeholder) {
  const key = normToken(placeholder?.key);
  const label = normToken(placeholder?.label);

  const haystack = `${key} ${label}`;
  if (
    haystack.includes('serial number') ||
    haystack === 'serial' ||
    /\bserial\b/.test(haystack)
  ) {
    return 'serialNumber';
  }
  if (
    haystack.includes('ownership type') ||
    haystack.includes('ownership')
  ) {
    return 'ownershipType';
  }
  if (
    haystack.includes('product type') ||
    haystack.includes('asset type')
  ) {
    return 'productType';
  }
  if (
    haystack.includes('model') ||
    haystack.includes('variant') ||
    haystack.includes('brand model')
  ) {
    return 'model';
  }
  if (
    haystack.includes('display name') ||
    haystack.includes('asset name') ||
    haystack.includes('device name') ||
    (haystack.includes('asset') && haystack.includes('name'))
  ) {
    return 'assetName';
  }
  return null;
}

export function isAssetRegistryPlaceholder(placeholder) {
  return Boolean(placeholderAssetField(placeholder));
}

/**
 * Apply Asset Registry snapshot values into placeholder form state.
 * @param {Array} placeholders
 * @param {object} snapshot
 * @param {object} prev placeholderValues
 */
export function applyAssetSnapshotToPlaceholders(placeholders, snapshot, prev = {}) {
  if (!snapshot) return prev;
  const next = { ...prev };
  for (const p of placeholders || []) {
    const field = placeholderAssetField(p);
    if (!field) continue;
    const value = snapshot[field];
    if (value != null && String(value).trim()) {
      next[p.key] = String(value).trim();
    }
  }
  return next;
}

export function applyAssetSnapshotToLineRows(tables, snapshot, prev = {}) {
  if (!snapshot || !tables?.length) return prev;
  const next = { ...prev };
  for (const table of tables) {
    const columns = table.columns || [];
    if (!columns.length) continue;
    const rows = Array.isArray(next[table.id]) && next[table.id].length
      ? next[table.id].map((row) => ({ ...row }))
      : [
          columns.reduce((acc, col) => {
            acc[col.key] = '';
            return acc;
          }, {}),
        ];
    const row = { ...rows[0] };
    for (const col of columns) {
      const field = placeholderAssetField(col);
      if (!field) continue;
      const value = snapshot[field];
      if (value != null && String(value).trim() && !String(row[col.key] || '').trim()) {
        row[col.key] = String(value).trim();
      }
    }
    rows[0] = row;
    next[table.id] = rows;
  }
  return next;
}

export function assetSearchLabel(asset) {
  const name = asset?.deviceNameSnapshot || asset?.assetName || 'Asset';
  const serial = asset?.serialNumber ? ` · ${asset.serialNumber}` : '';
  const tag = asset?.assetTag && !asset?.serialNumber ? ` · ${asset.assetTag}` : '';
  return `${name}${serial}${tag}`;
}
