export function emptyConsumableRow() {
  return {
    productId: '',
    itemName: '',
    quantityUsed: '',
    wastage: '0',
    unit: '',
    uomId: '',
    excluded: false,
    usageManual: false,
  };
}

export function isConsumableQuantityFilled(value) {
  if (value === '' || value === null || value === undefined) return false;
  const number = Number(value);
  return !Number.isNaN(number) && number >= 0;
}

export function isConsumableRowComplete(row = {}) {
  if (row.excluded) return true;
  return isConsumableQuantityFilled(row.quantityUsed)
    && isConsumableQuantityFilled(row.wastage);
}

export function defaultUsageFromPatients(patientsScreened) {
  const count = Number(patientsScreened);
  if (!Number.isFinite(count) || count < 0) return '';
  return String(count);
}

export function applyDefaultUsageToRows(rows = [], patientsScreened) {
  const defaultUsage = defaultUsageFromPatients(patientsScreened);
  return rows.map((row) => {
    if (row.excluded || row.usageManual) return row;
    return {
      ...row,
      quantityUsed: defaultUsage,
      usageAuto: Boolean(defaultUsage),
    };
  });
}

export function mergeConsumablesWithTemplate(mapped = [], existing = [], { patientsScreened } = {}) {
  if (!Array.isArray(mapped) || !mapped.length) {
    return Array.isArray(existing) && existing.length ? existing : [emptyConsumableRow()];
  }
  const existingById = Object.fromEntries(
    (existing || []).map((row) => [String(row.productId), row]),
  );
  const defaultUsage = defaultUsageFromPatients(patientsScreened);
  return mapped.map((item) => {
    const saved = existingById[String(item.productId)] || {};
    const usageManual = saved.usageManual === true;
    const quantityUsed = usageManual
      ? (saved.quantityUsed ?? '')
      : (saved.quantityUsed ?? defaultUsage);
    return {
      productId: item.productId,
      itemName: item.itemName || saved.itemName || '',
      unit: item.unit || saved.unit || '',
      uomId: item.uomId || saved.uomId || '',
      quantityUsed,
      wastage: saved.wastage ?? '0',
      excluded: saved.excluded === true,
      usageManual,
    };
  });
}

/**
 * Consumables Tracking must be filled before Finance.
 * Usage and Wastage require explicit values — enter 0 if none used.
 * - Mapped mode: every non-excluded mapped item must be complete.
 * - Freeform mode: every selected (non-excluded) product row must be complete.
 */
export function getConsumablesCompletionBlockers(mapped = [], rows = []) {
  const list = Array.isArray(rows) ? rows : [];
  const blockers = [];

  if (Array.isArray(mapped) && mapped.length) {
    const byId = Object.fromEntries(
      list.map((row) => [String(row?.productId || ''), row]),
    );
    for (const item of mapped) {
      const productId = String(item?.productId || '');
      if (!productId) continue;
      const row = byId[productId] || {};
      if (row.excluded === true) continue;
      if (!isConsumableRowComplete(row)) {
        const name = String(item.itemName || row.itemName || 'consumable').trim() || 'consumable';
        blockers.push(`Enter Usage and Wastage for ${name} (use 0 if none)`);
      }
    }
    return blockers;
  }

  for (const row of list) {
    if (row?.excluded === true) continue;
    const productId = String(row?.productId || '').trim();
    if (!productId) continue;
    if (!isConsumableRowComplete(row)) {
      const name = String(row.itemName || 'consumable').trim() || 'consumable';
      blockers.push(`Enter Usage and Wastage for ${name} (use 0 if none)`);
    }
  }
  return blockers;
}

export function normalizeConsumablesUsed(rows = [], { requiredProductIds = [] } = {}) {
  if (!Array.isArray(rows)) return [];
  void requiredProductIds;
  return rows
    .filter((row) => !row?.excluded)
    .map((row) => {
      const productId = String(row?.productId || '').trim();
      if (!productId) return null;
      const qtyFilled = isConsumableQuantityFilled(row?.quantityUsed);
      const wasteFilled = isConsumableQuantityFilled(row?.wastage);
      return {
        productId,
        itemName: String(row?.itemName || '').trim(),
        quantityUsed: qtyFilled ? Math.max(0, Number(row.quantityUsed)) : '',
        wastage: wasteFilled ? Math.max(0, Number(row.wastage)) : '',
        unit: String(row?.unit || '').trim(),
        uomId: String(row?.uomId || '').trim(),
      };
    })
    .filter(Boolean);
}

export function formatConsumablesUsedSummary(rows = []) {
  return normalizeConsumablesUsed(rows)
    .map((row) => `${row.itemName} | ${row.quantityUsed} | ${row.wastage}`)
    .join('; ');
}
