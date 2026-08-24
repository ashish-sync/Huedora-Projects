/** Preview API may return invalid rows flat or nested under `data`. */
export function importInvalidRowView(row = {}, index = 0) {
  const data = row.data && typeof row.data === 'object' ? row.data : row;
  const errors = Array.isArray(row.errors) ? row.errors : [];
  return {
    rowNumber: row.rowNumber ?? data.rowNumber ?? index + 2,
    clientName: data.clientName || '-',
    campDate: data.campDate || '',
    errors,
    duplicateOf: row.duplicateOf || data.duplicateOf || null,
  };
}

export function importPreviewSummary(preview) {
  return {
    total: preview?.summary?.total ?? 0,
    valid: preview?.summary?.valid ?? 0,
    invalid: preview?.summary?.invalid ?? 0,
    duplicates: preview?.summary?.duplicates ?? (preview?.duplicateRows?.length || 0),
  };
}

export function importDuplicateRowView(row = {}, index = 0) {
  const view = importInvalidRowView(row, index);
  const campId = row.duplicateOf?.campId || row.campId || '';
  return {
    ...view,
    campId,
    reason: Array.isArray(view.errors) && view.errors.length
      ? view.errors.join('; ')
      : (campId ? `Duplicate of ${campId}` : 'Duplicate of an existing camp'),
  };
}
