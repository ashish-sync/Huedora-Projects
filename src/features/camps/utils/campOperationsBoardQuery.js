/**
 * Shared list/export query for the Camp One operations board.
 * Keep split-screen rows and Excel downloads on the same filters.
 */

import { CAMP_PATH } from '../../../shared/moduleRoutes.js';
import { withOpsReviewReturnTo } from '../../dashboards/opsReviewReturn.js';

/** Manage Camps deep-link used by Operations Board + homepage Camp Pipeline. */
export function buildOperationsBoardManagePath({
  stageId,
  statusValue = '',
  dateFrom = '',
  dateTo = '',
  client = '',
  campaignType = '',
  campaign = '',
  assignedUser = '',
  returnTo = '',
} = {}) {
  const params = new URLSearchParams();
  if (stageId) params.set('stage', stageId);
  if (statusValue) params.set('status', statusValue);
  if (dateFrom) params.set('dateFrom', dateFrom);
  if (dateTo) params.set('dateTo', dateTo);
  if (client) params.set('client', client);
  if (campaignType) params.set('campaignType', campaignType);
  if (campaign) params.set('campaign', campaign);
  if (assignedUser) params.set('assignedUser', assignedUser);
  withOpsReviewReturnTo(params, returnTo);
  const query = params.toString();
  return `${CAMP_PATH.MANAGE}${query ? `?${query}` : ''}`;
}

export function buildOperationsBoardListParams({
  stageId,
  statusValue = '',
  dateFrom = '',
  dateTo = '',
  search = '',
  client = '',
  campaignType = '',
  campaign = '',
  assignedUser = '',
  page = 1,
  includePaging = true,
} = {}) {
  const params = {};

  if (includePaging) {
    params.page = page;
    params.limit = 50;
  }

  if (search) params.search = search;
  if (dateFrom) params.dateFrom = dateFrom;
  if (dateTo) params.dateTo = dateTo;
  if (client) params.client = client;
  if (campaignType) params.campaignType = campaignType;
  if (campaign) params.campaign = campaign;
  if (assignedUser) params.assignedUser = assignedUser;

  if (!statusValue) {
    if (stageId === 'execution') {
      // Active execution + cancelled closures (same partition as the Ops Board card).
      params.boardStage = 'execution';
    } else if (stageId === 'financial') {
      params.lifecycleStage = 'financial';
      // Cancelled closures are board-counted under Execution, not Financial.
      params.excludeBoardCancelled = '1';
    } else if (stageId) {
      params.lifecycleStage = stageId;
    }
    return params;
  }

  if (stageId === 'request') {
    params.lifecycleStage = 'request';
    params.requestReviewStatus = statusValue;
  } else if (stageId === 'assignment') {
    params.lifecycleStage = 'assignment';
    params.assignmentFilter = statusValue;
  } else if (stageId === 'execution') {
    if (statusValue === 'cancelled_by_tylo' || statusValue === 'cancelled_by_client') {
      params.lifecycleStage = 'financial';
      params.executionFilter = statusValue;
    } else {
      params.lifecycleStage = 'execution';
      params.executionFilter = statusValue;
    }
  } else if (stageId === 'financial') {
    params.lifecycleStage = 'financial';
    params.financialFilter = statusValue;
  }

  return params;
}

export function operationsBoardExportPath(options = {}) {
  const params = buildOperationsBoardListParams({
    ...options,
    includePaging: false,
  });
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    qs.set(key, String(value));
  });
  const query = qs.toString();
  return query ? `/camp-ops/camps/export?${query}` : '/camp-ops/camps/export';
}

export function operationsBoardExportFilename({
  stageLabel = '',
  statusLabel = '',
} = {}) {
  const slice = [stageLabel, statusLabel].filter(Boolean).join(' ') || 'Camps';
  const safe = String(slice)
    .replace(/[^\w]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `Camp_One_${safe || 'Camps'}.xlsx`;
}
