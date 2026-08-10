/**
 * Client Master pricing → Camp One revenue (mirrors server campOps.clientMasterPricing).
 */

import { normalizeCampMethodKey } from '../constants/campNames.js';

function trimStr(value) {
  return String(value ?? '').trim();
}

function normalizeDivisionKey(value) {
  return trimStr(value)
    .toLowerCase()
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\s+/g, ' ');
}

function normalizeMethodKey(value) {
  return normalizeDivisionKey(normalizeCampMethodKey(value) || value);
}

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function roundMoney(value) {
  return Math.round(num(value) * 100) / 100;
}

/** Parse Client Master Camp Duration (`4:00`, `4:30`, `3 Hours`) to decimal hours. */
export function parseCampDurationToHours(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return 0;
  const clock = raw.match(/^(\d{1,2}):([0-5]\d)$/);
  if (clock) {
    return Math.round((Number(clock[1]) + Number(clock[2]) / 60) * 100) / 100;
  }
  const hoursOnly = raw.match(/^(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)?$/i);
  if (hoursOnly) return num(hoursOnly[1]);
  const n = num(raw, NaN);
  return Number.isFinite(n) ? n : 0;
}

function normalizeExecutionStatus(executionStatus) {
  const value = trimStr(executionStatus);
  if (value === 'Rejected') return 'Refused';
  return value;
}

export function extractClientMasterPricingUnits(record = {}) {
  if (!record) return null;
  return {
    executedCampUnit: num(record.executedCampUnit),
    cancelledCampUnit: num(record.cancelledCampUnit),
    otUnit: num(record.otUnit),
    minimumPatientCovered: num(record.minimumPatientCovered),
    minimumKmsCovered: num(record.minimumKmsCovered),
    extPatientUnit: num(record.extPatientUnit),
    kmsUnit: num(record.kmsUnit),
    campDuration: trimStr(record.campDuration),
    clientMasterId: record._id ? String(record._id) : '',
    programName: trimStr(record.programName || record.drugTherapyName),
    campName: trimStr(record.campName),
  };
}

export function resolveClientMasterPricingFromRecords(
  records = [],
  { campaignType = '', campaignName = '' } = {},
) {
  const divisionKey = normalizeDivisionKey(campaignType);
  const methodKey = normalizeMethodKey(campaignName);
  const activeRecords = (records || []).filter((record) => record?.isActive !== false && !record?.isDeleted);

  if (divisionKey && methodKey) {
    const exact = activeRecords.find((record) => (
      normalizeDivisionKey(record.programName || record.drugTherapyName) === divisionKey
      && normalizeMethodKey(record.campName) === methodKey
    ));
    if (exact) return extractClientMasterPricingUnits(exact);
  }

  if (divisionKey) {
    const byDivision = activeRecords.find((record) => (
      normalizeDivisionKey(record.programName || record.drugTherapyName) === divisionKey
    ));
    if (byDivision) return extractClientMasterPricingUnits(byDivision);
  }

  if (activeRecords.length === 1) {
    return extractClientMasterPricingUnits(activeRecords[0]);
  }

  return null;
}

export function isCampExecutedForRevenue(camp = {}) {
  const status = trimStr(camp.status).toLowerCase();
  if (status === 'executed') return true;
  const exec = normalizeExecutionStatus(camp.executionStatus);
  return exec === 'Camp Completed' || exec === 'Marked Executed';
}

export function isCampCancelledForRevenue(camp = {}) {
  const status = trimStr(camp.status).toLowerCase();
  if (status === 'cancelled') return true;
  const exec = normalizeExecutionStatus(camp.executionStatus);
  return exec === 'Cancelled' || exec === 'Refused';
}

export function isCampChargeable(camp = {}) {
  const value = trimStr(camp.chargeableStatus);
  if (!value) return false;
  if (/^non[-\s]?chargeable$/i.test(value)) return false;
  return true;
}

export function computeCampRevenueFromPricing(camp = {}, pricing = null) {
  const empty = {
    campRevenue: 0,
    overtimeRevenue: 0,
    otherRevenuePatients: 0,
    otherRevenueDistance: 0,
    otherRevenue: 0,
    totalRevenue: 0,
  };
  if (!pricing) return empty;

  let campRevenue = 0;
  if (!isCampChargeable(camp)) {
    campRevenue = 0;
  } else if (isCampCancelledForRevenue(camp)) {
    campRevenue = num(pricing.cancelledCampUnit);
  } else if (isCampExecutedForRevenue(camp)) {
    campRevenue = num(pricing.executedCampUnit);
  }

  const totalHours = num(camp.totalHours, NaN);
  const campDurationHours = parseCampDurationToHours(pricing.campDuration) || num(camp.durationHours, 0);
  let overtimeHours = 0;
  if (Number.isFinite(totalHours) && campDurationHours > 0) {
    overtimeHours = Math.max(0, Math.round((totalHours - campDurationHours) * 100) / 100);
  }
  const overtimeRevenue = roundMoney(overtimeHours * num(pricing.otUnit));

  const patientsScreened = num(
    camp.actualPatients != null && camp.actualPatients !== ''
      ? camp.actualPatients
      : camp.patientsCount,
  );
  const kmRoundTrip = num(camp.kmRoundTrip);
  const otherRevenuePatients = roundMoney(
    Math.max(0, patientsScreened - num(pricing.minimumPatientCovered)) * num(pricing.extPatientUnit),
  );
  const otherRevenueDistance = roundMoney(
    Math.max(0, kmRoundTrip - num(pricing.minimumKmsCovered)) * num(pricing.kmsUnit),
  );
  const otherRevenue = roundMoney(otherRevenuePatients + otherRevenueDistance);
  const totalRevenue = roundMoney(campRevenue + overtimeRevenue + otherRevenue);

  return {
    campRevenue: roundMoney(campRevenue),
    overtimeRevenue,
    otherRevenuePatients,
    otherRevenueDistance,
    otherRevenue,
    totalRevenue,
  };
}
