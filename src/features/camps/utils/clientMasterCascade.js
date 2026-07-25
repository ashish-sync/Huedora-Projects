/**
 * Parse `/client-masters/by-client/:id/divisions` for cascading camp form fields.
 */
export function parseClientMasterDivisions(data) {
  const programs = Array.isArray(data?.data)
    ? data.data
      .map((item) => ({
        programName: String(item?.programName || '').trim(),
        campNames: Array.isArray(item?.campNames)
          ? item.campNames.map((name) => String(name || '').trim()).filter(Boolean)
          : [],
        isActive: item?.isActive !== false,
      }))
      .filter((item) => item.programName)
    : [];

  const divisions = Array.isArray(data?.divisions)
    ? data.divisions.map((name) => String(name || '').trim()).filter(Boolean)
    : programs.map((item) => item.programName);

  return { programs, divisions };
}

export function campNamesForDivision(programs, division) {
  const key = String(division || '').trim();
  if (!key) return [];
  const entry = programs.find((item) => item.programName === key);
  return entry?.campNames?.length ? [...entry.campNames] : [];
}

export function resolveCampNameOptions(programs, division, currentValue = '') {
  const fromMaster = campNamesForDivision(programs, division);
  const current = String(currentValue || '').trim();
  if (current && !fromMaster.includes(current)) {
    return [current, ...fromMaster];
  }
  return fromMaster;
}

export function pickSingleOption(options) {
  return options.length === 1 ? options[0] : '';
}
