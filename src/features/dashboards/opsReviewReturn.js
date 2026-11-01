import { MODULE_PATH } from '../../shared/moduleRoutes.js';

export const OPS_REVIEW_RETURN_PARAM = 'returnTo';

const DASHBOARD_PATH = MODULE_PATH.DASHBOARD;

function pathOnly(value) {
  return String(value || '').split('?')[0].split('#')[0];
}

/** Accept only in-app Operations Dashboard locations (no open redirects). */
export function safeOpsReviewReturnTo(raw) {
  if (!raw) return '';
  const value = String(raw).trim();
  if (!value.startsWith(DASHBOARD_PATH)) return '';
  if (value.startsWith('//') || /:\/\//.test(value)) return '';
  if (pathOnly(value) !== DASHBOARD_PATH) return '';
  return value;
}

/** Rebuild the Camp One module-review URL so Back can restore filters and tab. */
export function buildOpsReviewReturnTo({
  from = '',
  to = '',
  preset = '',
  client = '',
  campaign = '',
  campaignType = '',
  assignedUser = '',
} = {}) {
  const params = new URLSearchParams();
  params.set('tab', 'drilldown');
  params.set('module', 'camps');
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  if (preset) params.set('preset', preset);
  if (client) params.set('client', client);
  if (campaign) params.set('campaign', campaign);
  if (campaignType) params.set('campaignType', campaignType);
  if (assignedUser) params.set('assignedUser', assignedUser);
  return `${DASHBOARD_PATH}?${params.toString()}`;
}

export function withOpsReviewReturnTo(params, returnTo) {
  const safe = safeOpsReviewReturnTo(returnTo);
  if (!safe) return params;
  params.set(OPS_REVIEW_RETURN_PARAM, safe);
  return params;
}

export function readOpsReviewReturnTo(searchParams, locationState) {
  return safeOpsReviewReturnTo(
    searchParams?.get?.(OPS_REVIEW_RETURN_PARAM) || locationState?.returnTo || '',
  );
}
