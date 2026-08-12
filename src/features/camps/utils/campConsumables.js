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

export function getConsumablesCompletionBlockers(mapped = [], rows = []) {
  if (!Array.isArray(mapped) || !mapped.length) return [];
  const rowsById = Object.fromEntries((rows || []).map((row) => [String(row.productId), row]));
  return mapped
    .filter((item) => {
      const row = rowsById[String(item.productId)] || {};
      return !row.excluded && !isConsumableRowComplete(row);
    })
    .map((item) => `Enter usage and wastage for ${item.itemName || 'consumable'}`);
}

export function normalizeConsumablesUsed(rows = [], { requiredProductIds = [] } = {}) {
  if (!Array.isArray(rows)) return [];
  const required = new Set((requiredProductIds || []).map(String));
  return rows
    .filter((row) => !row?.excluded)
    .map((row) => ({
      productId: String(row?.productId || '').trim(),
      itemName: String(row?.itemName || '').trim(),
      quantityUsed: Math.max(0, Number(row?.quantityUsed) || 0),
      wastage: Math.max(0, Number(row?.wastage) || 0),
      unit: String(row?.unit || '').trim(),
      uomId: String(row?.uomId || '').trim(),
    }))
    .filter((row) => {
      if (!row.productId) return false;
      if (required.has(row.productId)) return isConsumableRowComplete(row);
      return row.quantityUsed > 0 || row.wastage > 0;
    });
}

export function formatConsumablesUsedSummary(rows = []) {
  return normalizeConsumablesUsed(rows)
    .map((row) => `${row.itemName} | ${row.quantityUsed} | ${row.wastage}`)
    .join('; ');
}
