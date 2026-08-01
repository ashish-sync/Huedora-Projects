/**

 * Parse `/client-masters/by-client/:id/divisions` for cascading camp form fields.

 */

import { normalizeCampMethodKey } from '../constants/campNames.js';



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

      .filter((item) => item.programName && item.isActive !== false)

    : [];



  const divisions = [...new Set(programs.map((item) => item.programName))];



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



/** Normalize division / therapy labels for loose matching. */

export function normalizeMasterDivisionKey(value) {

  return String(value || '')

    .trim()

    .toLowerCase()

    .replace(/[\u2013\u2014]/g, '-')

    .replace(/\s+/g, ' ');

}



/** Normalize method labels for loose matching (aliases + casing). */

export function normalizeMasterMethodKey(value) {

  const canonical = normalizeCampMethodKey(value);

  return normalizeMasterDivisionKey(canonical || value);

}



export function parseClientMasterListResponse(response) {

  const payload = response?.data;

  if (Array.isArray(payload)) return payload;

  if (Array.isArray(payload?.data)) return payload.data;

  return [];

}



function recordDivision(record) {

  return String(record?.programName || record?.drugTherapyName || '').trim();

}



function recordMethod(record) {

  return String(record?.campName || '').trim();

}



function recordHealthcareWorkerRole(record) {

  return String(record?.healthcareWorker || '').trim();

}



function recordMatchesDivision(record, divisionKey) {

  if (!divisionKey) return true;

  const keys = [recordDivision(record), record?.drugTherapyName]

    .map((value) => normalizeMasterDivisionKey(value))

    .filter(Boolean);

  return keys.includes(divisionKey);

}



function recordMatchesMethod(record, methodKey) {

  if (!methodKey) return true;

  const keys = [recordMethod(record), normalizeCampMethodKey(recordMethod(record))]

    .map((value) => normalizeMasterMethodKey(value))

    .filter(Boolean);

  return keys.includes(methodKey);

}



/**

 * Healthcare worker role configured on Client Master for this client + division + method.

 */

export function resolveClientMasterHealthcareWorker(records = [], {

  campaignType = '',

  campaignName = '',

} = {}) {

  const divisionKey = normalizeMasterDivisionKey(campaignType);

  const methodKey = normalizeMasterMethodKey(campaignName);

  const activeRecords = records.filter((record) => record?.isActive !== false);

  const withRole = activeRecords

    .map((record) => ({ record, role: recordHealthcareWorkerRole(record) }))

    .filter((entry) => entry.role);



  if (!withRole.length) return '';



  if (divisionKey && methodKey) {

    const exact = withRole.find(({ record }) => (

      recordMatchesDivision(record, divisionKey)

      && recordMatchesMethod(record, methodKey)

    ));

    if (exact) return exact.role;

  }



  if (divisionKey) {

    const byDivision = withRole.find(({ record }) => recordMatchesDivision(record, divisionKey));

    if (byDivision) return byDivision.role;

  }



  if (methodKey) {

    const byMethod = withRole.find(({ record }) => recordMatchesMethod(record, methodKey));

    if (byMethod) return byMethod.role;

  }



  const uniqueRoles = [...new Set(withRole.map((entry) => entry.role))];

  if (uniqueRoles.length === 1) return uniqueRoles[0];

  if (withRole.length === 1) return withRole[0].role;



  return '';

}



/**

 * When a client has a single division and/or method, auto-select them.

 * Preserves current values when they remain valid for the chosen client.

 */

export function applyClientMasterCascade({

  programs = [],

  currentDivision = '',

  currentMethod = '',

} = {}) {

  const activePrograms = programs.filter((program) => program.isActive !== false);

  const divisions = [...new Set(

    activePrograms.map((program) => program.programName).filter(Boolean),

  )];



  const division = String(currentDivision || '').trim();

  let campaignType = division && divisions.includes(division) ? division : '';

  if (!campaignType) {

    campaignType = pickSingleOption(divisions);

  }



  const methodOptions = campNamesForDivision(activePrograms, campaignType);

  const method = String(currentMethod || '').trim();

  let campaignName = method && methodOptions.includes(method) ? method : '';

  if (!campaignName) {

    campaignName = pickSingleOption(methodOptions);

  }



  return {

    programs: activePrograms,

    divisions,

    campaignType,

    campaignName,

  };

}


