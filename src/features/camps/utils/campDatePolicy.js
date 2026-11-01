/** Dates more than this many days before today need Reporting Manager approval. */
export const CAMP_HISTORICAL_DATE_THRESHOLD_DAYS = 2;

const ADMIN_DESIGNATION_KEYS = new Set(['admin', 'administrator']);
const ADMIN_ROLE_KEYS = new Set(['admin', 'administrator']);

export function normalizeDesignationKey(designation) {
  return String(designation || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function isTeamLeaderDesignation(designation) {
  return normalizeDesignationKey(designation) === 'team leader';
}

export function isAdminDesignation(designation) {
  return ADMIN_DESIGNATION_KEYS.has(normalizeDesignationKey(designation));
}

function userRoleNames(user) {
  const names = [];
  if (user?.role) names.push(String(user.role));
  if (user?.roleName) names.push(String(user.roleName));
  if (Array.isArray(user?.roles)) {
    for (const role of user.roles) {
      if (typeof role === 'string') names.push(role);
      else if (role?.name) names.push(String(role.name));
    }
  }
  return names.map((name) => normalizeDesignationKey(name)).filter(Boolean);
}

export function isAdminUser(user) {
  if (!user) return false;
  if (isAdminDesignation(user.designation)) return true;
  if (userRoleNames(user).some((name) => ADMIN_ROLE_KEYS.has(name))) return true;
  if (user.permissions instanceof Set && user.permissions.has('*')) return true;
  if (Array.isArray(user.permissions) && user.permissions.includes('*')) return true;
  return false;
}

function localDateFromIso(value) {
  const raw = String(value || '').slice(0, 10);
  if (!raw) return null;
  const [year, month, day] = raw.split('-').map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function daysFromToday(dateValue, now = new Date()) {
  const target = localDateFromIso(dateValue);
  if (!target) return 0;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

export function isHistoricalCampDate(dateValue) {
  return daysFromToday(dateValue) < -CAMP_HISTORICAL_DATE_THRESHOLD_DAYS;
}

export function isRequestDateFarFromToday(dateValue) {
  return Math.abs(daysFromToday(dateValue)) > CAMP_HISTORICAL_DATE_THRESHOLD_DAYS;
}

export const FUTURE_REQUEST_DATE_ERROR = 'Request date cannot be in the future';
export const REQUEST_DATE_APPROVAL_REASON = 'request_date_historical';
export const CAMP_DATE_APPROVAL_REASON = 'camp_date_historical';

export function isFutureRequestDate(dateValue) {
  if (!dateValue) return false;
  return daysFromToday(dateValue) > 0;
}

export function getFutureRequestDateError(dateValue) {
  return isFutureRequestDate(dateValue) ? FUTURE_REQUEST_DATE_ERROR : '';
}

export function localTodayIso(now = new Date()) {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isRequestDateNeedingApproval(dateValue) {
  return isHistoricalCampDate(dateValue);
}

export function isCampDateNeedingApproval(dateValue) {
  return isHistoricalCampDate(dateValue);
}

export function campCreateApprovalReasons({ campDate, requestDate } = {}) {
  const reasons = [];
  if (isHistoricalCampDate(requestDate)) reasons.push(REQUEST_DATE_APPROVAL_REASON);
  if (isHistoricalCampDate(campDate)) reasons.push(CAMP_DATE_APPROVAL_REASON);
  return reasons;
}

export function canSetHistoricalCampDates(user) {
  if (!user) return false;
  return isTeamLeaderDesignation(user.designation) || isAdminUser(user);
}

export function minAllowedCampDateIso() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - CAMP_HISTORICAL_DATE_THRESHOLD_DAYS);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getHistoricalCampDateErrors() {
  return [];
}
