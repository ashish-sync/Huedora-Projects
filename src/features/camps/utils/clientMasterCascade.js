/**

 * Parse `/client-masters/by-client/:id/divisions` for cascading camp form fields.

 */

import { normalizeCampMethodKey } from '../constants/campNames.js';
import { normalizeHealthcareWorkers } from './healthcareWorkers.js';



function parseAssignedEmails(raw) {
  if (Array.isArray(raw)) {
    return raw.map((item) => String(item || '').trim()).filter(Boolean);
  }
  return String(raw || '')
    .split(/[;,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseAssignedUsersByCamp(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const next = {};
  for (const [campName, emails] of Object.entries(raw)) {
    const key = String(campName || '').trim();
    if (!key) continue;
    next[key] = parseAssignedEmails(emails);
  }
  return next;
}

export function parseClientMasterDivisions(data) {

  const programs = Array.isArray(data?.data)

    ? data.data

      .map((item) => ({

        programName: String(item?.programName || '').trim(),

        campNames: Array.isArray(item?.campNames)

          ? item.campNames.map((name) => String(name || '').trim()).filter(Boolean)

          : [],

        assignedUserEmails: parseAssignedEmails(item?.assignedUserEmails),

        assignedUsersByCamp: parseAssignedUsersByCamp(item?.assignedUsersByCamp),

        isActive: item?.isActive !== false,

      }))

      .filter((item) => item.programName && item.isActive !== false)

    : [];



  const divisions = [...new Set(programs.map((item) => item.programName))];

  const assignedUsers = Array.isArray(data?.assignedUsers)
    ? data.assignedUsers
      .map((item) => ({
        email: String(item?.email || '').trim(),
        name: String(item?.name || '').trim(),
      }))
      .filter((item) => item.email)
    : [];

  return { programs, divisions, assignedUsers };

}

function pushUniqueEmails(target, emails) {
  const seen = new Set(target.map((email) => email.toLowerCase()));
  for (const email of emails || []) {
    const value = String(email || '').trim();
    const key = value.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    target.push(value);
  }
  return target;
}

export function parseOpsBoardFilterCatalog(data = {}) {
  const source = data?.methods ? data : {};
  const methods = Array.isArray(source.methods)
    ? source.methods.map((item) => String(item || '').trim()).filter(Boolean)
    : [];
  const divisionsByMethod = {};
  for (const [method, divisions] of Object.entries(source.divisionsByMethod || {})) {
    const key = String(method || '').trim();
    if (!key) continue;
    divisionsByMethod[key] = (Array.isArray(divisions) ? divisions : [])
      .map((item) => String(item || '').trim())
      .filter(Boolean);
  }
  const parseClients = (rows) => (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      _id: String(row?._id || row?.id || '').trim(),
      name: String(row?.name || '').trim(),
    }))
    .filter((row) => row._id);

  const clientsByMethod = {};
  for (const [method, rows] of Object.entries(source.clientsByMethod || {})) {
    const key = String(method || '').trim();
    if (!key) continue;
    clientsByMethod[key] = parseClients(rows);
  }

  const clientsByMethodDivision = {};
  for (const [method, divisions] of Object.entries(source.clientsByMethodDivision || {})) {
    const methodKey = String(method || '').trim();
    if (!methodKey || !divisions || typeof divisions !== 'object') continue;
    clientsByMethodDivision[methodKey] = {};
    for (const [division, rows] of Object.entries(divisions)) {
      const divisionKey = String(division || '').trim();
      if (!divisionKey) continue;
      clientsByMethodDivision[methodKey][divisionKey] = parseClients(rows);
    }
  }

  const assignedUsers = Array.isArray(source.assignedUsers)
    ? source.assignedUsers
      .map((item) => ({
        email: String(item?.email || '').trim(),
        name: String(item?.name || '').trim(),
      }))
      .filter((item) => item.email)
    : [];

  return {
    methods,
    divisionsByMethod,
    clientsByMethod,
    clientsByMethodDivision,
    assignedUsers,
  };
}

export function divisionsForOpsBoardMethod(catalog, method) {
  const key = String(method || '').trim();
  if (!key) return [];
  return [...(catalog?.divisionsByMethod?.[key] || [])];
}

export function clientsForOpsBoardScope(catalog, { campaign = '', campaignType = '' } = {}) {
  const method = String(campaign || '').trim();
  const division = String(campaignType || '').trim();
  if (!method) return [];
  if (division) {
    return [...(catalog?.clientsByMethodDivision?.[method]?.[division] || [])];
  }
  return [...(catalog?.clientsByMethod?.[method] || [])];
}

/** Assigned User login emails for the selected Client Master scope. */
export function assignedUserEmailsForProgramScope(programs = [], {
  campaignType = '',
  campaign = '',
} = {}) {
  const emails = [];
  const division = String(campaignType || '').trim();
  const method = String(campaign || '').trim();
  const rows = Array.isArray(programs) ? programs : [];

  if (!division) {
    for (const program of rows) pushUniqueEmails(emails, program?.assignedUserEmails);
    return emails;
  }

  const program = rows.find((item) => item?.programName === division);
  if (!program) return [];
  if (!method) {
    pushUniqueEmails(emails, program.assignedUserEmails);
    return emails;
  }
  pushUniqueEmails(emails, program.assignedUsersByCamp?.[method]);
  return emails;
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



/**
 * Resolve a camp's company id for Client Master lookups.
 * Never returns "[object Object]" when `client` is a populated object without _id first.
 */
export function resolveCampClientId(camp = {}) {
  const candidates = [camp?.clientId, camp?.client?._id, camp?.client];
  for (const raw of candidates) {
    if (raw == null || raw === '') continue;
    if (typeof raw === 'object') {
      const nested = raw._id ?? raw.id;
      if (nested != null && nested !== '') return String(nested).trim();
      continue;
    }
    const value = String(raw).trim();
    if (!value || value === '[object Object]' || value === 'undefined') continue;
    return value;
  }
  return '';
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



function recordHealthcareWorkerRoles(record) {
  return normalizeHealthcareWorkers(record?.healthcareWorker);
}

function recordHealthcareWorkerRole(record) {
  return recordHealthcareWorkerRoles(record)[0] || '';
}

/** Union role labels across Client Master rows (multi-GSTIN / multi-select). */
function unionHealthcareWorkerRoles(entries = []) {
  return normalizeHealthcareWorkers(entries.flatMap((entry) => entry.roles || []));
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
 * Healthcare worker role(s) configured on Client Master for this client + division + method.
 * Returns an array (multi-select). Empty when not configured.
 * When several GSTIN rows share the same division + method, roles are unioned.
 */
export function resolveClientMasterHealthcareWorkers(records = [], {
  campaignType = '',
  campaignName = '',
} = {}) {
  const divisionKey = normalizeMasterDivisionKey(campaignType);
  const methodKey = normalizeMasterMethodKey(campaignName);
  const activeRecords = records.filter((record) => record?.isActive !== false);
  const withRole = activeRecords
    .map((record) => ({ record, roles: recordHealthcareWorkerRoles(record) }))
    .filter((entry) => entry.roles.length);

  if (!withRole.length) return [];

  if (divisionKey && methodKey) {
    const exact = withRole.filter(({ record }) => (
      recordMatchesDivision(record, divisionKey)
      && recordMatchesMethod(record, methodKey)
    ));
    if (exact.length) return unionHealthcareWorkerRoles(exact);
  }

  if (divisionKey) {
    const byDivision = withRole.filter(({ record }) => recordMatchesDivision(record, divisionKey));
    if (byDivision.length) return unionHealthcareWorkerRoles(byDivision);
  }

  if (methodKey) {
    const byMethod = withRole.filter(({ record }) => recordMatchesMethod(record, methodKey));
    if (byMethod.length) return unionHealthcareWorkerRoles(byMethod);
  }

  if (withRole.length === 1) return withRole[0].roles;

  const uniqueJoined = [...new Set(withRole.map((entry) => entry.roles.slice().sort().join('\0')))];
  if (uniqueJoined.length === 1) return withRole[0].roles;

  return [];
}

/**
 * Why assignment cannot resolve Client Master HCW roles (for UI diagnostics).
 * @returns {'ok'|'no_records'|'missing_hcw_roles'|'division_method_mismatch'}
 */
export function diagnoseClientMasterHcwGap(records = [], {
  campaignType = '',
  campaignName = '',
} = {}) {
  if (resolveClientMasterHealthcareWorkers(records, { campaignType, campaignName }).length) {
    return 'ok';
  }
  const activeRecords = (Array.isArray(records) ? records : [])
    .filter((record) => record?.isActive !== false);
  if (!activeRecords.length) return 'no_records';
  const anyRoles = activeRecords.some((record) => recordHealthcareWorkerRoles(record).length > 0);
  if (!anyRoles) return 'missing_hcw_roles';
  return 'division_method_mismatch';
}

/**
 * @deprecated Prefer resolveClientMasterHealthcareWorkers (multi). Returns first role or ''.
 */
export function resolveClientMasterHealthcareWorker(records = [], filters = {}) {
  return resolveClientMasterHealthcareWorkers(records, filters)[0] || '';
}

/**
 * Display name from Client Master for client + division + method.
 */
export function resolveClientMasterDisplayName(records = [], {
  campaignType = '',
  campaignName = '',
} = {}) {
  const divisionKey = normalizeMasterDivisionKey(campaignType);
  const methodKey = normalizeMasterMethodKey(campaignName);
  if (!divisionKey || !methodKey) return '';

  const activeRecords = (Array.isArray(records) ? records : []).filter(
    (record) => record?.isActive !== false,
  );
  const exact = activeRecords.filter((record) => (
    recordMatchesDivision(record, divisionKey)
    && recordMatchesMethod(record, methodKey)
  ));
  for (const record of exact) {
    const name = String(record.displayName || '').trim();
    if (name) return name;
  }
  return '';
}

/**
 * Assigned login emails for client + division + method (union across multi-GSTIN rows).
 */
export function resolveClientMasterAssignedUserEmails(records = [], {
  programName = '',
  campName = '',
} = {}) {
  const divisionKey = normalizeMasterDivisionKey(programName);
  const methodKey = normalizeMasterMethodKey(campName);
  if (!divisionKey || !methodKey) return [];

  const activeRecords = (Array.isArray(records) ? records : []).filter(
    (record) => record?.isActive !== false,
  );
  const exact = activeRecords.filter((record) => (
    recordMatchesDivision(record, divisionKey)
    && recordMatchesMethod(record, methodKey)
  ));
  if (!exact.length) return [];

  const seen = new Set();
  const emails = [];
  for (const record of exact) {
    const raw = record?.assignedUserEmails;
    const list = Array.isArray(raw)
      ? raw
      : String(raw || '').split(/[;,\n]/).map((item) => item.trim()).filter(Boolean);
    for (const email of list) {
      const key = String(email || '').trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      emails.push(String(email).trim());
    }
  }
  return emails;
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


