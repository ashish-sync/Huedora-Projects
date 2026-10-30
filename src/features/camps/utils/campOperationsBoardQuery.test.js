import { describe, expect, it } from 'vitest';
import {
  buildOperationsBoardListParams,
  operationsBoardExportFilename,
  operationsBoardExportPath,
} from './campOperationsBoardQuery.js';

const SECTIONS = [
  {
    stageId: 'request',
    statusValue: 'review_pending',
    expected: { lifecycleStage: 'request', requestReviewStatus: 'review_pending' },
  },
  {
    stageId: 'request',
    statusValue: 'review_overdue',
    expected: { lifecycleStage: 'request', requestReviewStatus: 'review_overdue' },
  },
  {
    stageId: 'request',
    statusValue: 'request_rejected',
    expected: { lifecycleStage: 'request', requestReviewStatus: 'request_rejected' },
  },
  {
    stageId: 'request',
    statusValue: 'information_requested',
    expected: { lifecycleStage: 'request', requestReviewStatus: 'information_requested' },
  },
  {
    stageId: 'assignment',
    statusValue: 'unassigned',
    expected: { lifecycleStage: 'assignment', assignmentFilter: 'unassigned' },
  },
  {
    stageId: 'assignment',
    statusValue: 'hiring_requested',
    expected: { lifecycleStage: 'assignment', assignmentFilter: 'hiring_requested' },
  },
  {
    stageId: 'execution',
    statusValue: 'planned',
    expected: { lifecycleStage: 'execution', executionFilter: 'planned' },
  },
  {
    stageId: 'execution',
    statusValue: 'executed',
    expected: { lifecycleStage: 'execution', executionFilter: 'executed' },
  },
  {
    stageId: 'execution',
    statusValue: 'cancelled_by_tylo',
    expected: { lifecycleStage: 'financial', executionFilter: 'cancelled_by_tylo' },
  },
  {
    stageId: 'execution',
    statusValue: 'cancelled_by_client',
    expected: { lifecycleStage: 'financial', executionFilter: 'cancelled_by_client' },
  },
  {
    stageId: 'financial',
    statusValue: 'payment_not_checked',
    expected: { lifecycleStage: 'financial', financialFilter: 'payment_not_checked' },
  },
  {
    stageId: 'financial',
    statusValue: 'payment_confirmed',
    expected: { lifecycleStage: 'financial', financialFilter: 'payment_confirmed' },
  },
  {
    stageId: 'financial',
    statusValue: 'payment_hold',
    expected: { lifecycleStage: 'financial', financialFilter: 'payment_hold' },
  },
  {
    stageId: 'financial',
    statusValue: 'payment_done',
    expected: { lifecycleStage: 'financial', financialFilter: 'payment_done' },
  },
];

describe('campOperationsBoardQuery', () => {
  it('maps all 14 operations board sections to the same filters as the split-screen list', () => {
    expect(SECTIONS).toHaveLength(14);
    for (const section of SECTIONS) {
      expect(buildOperationsBoardListParams({
        ...section,
        includePaging: false,
      })).toEqual(section.expected);
    }
  });

  it('keeps date range and search on exports so downloads match the displayed slice', () => {
    const path = operationsBoardExportPath({
      stageId: 'request',
      statusValue: 'review_pending',
      dateFrom: '2026-10-01',
      dateTo: '2026-10-29',
      search: 'Acme',
    });
    const url = new URL(path, 'http://local.test');
    expect(url.pathname).toBe('/camp-ops/camps/export');
    expect(url.searchParams.get('lifecycleStage')).toBe('request');
    expect(url.searchParams.get('requestReviewStatus')).toBe('review_pending');
    expect(url.searchParams.get('dateFrom')).toBe('2026-10-01');
    expect(url.searchParams.get('dateTo')).toBe('2026-10-29');
    expect(url.searchParams.get('search')).toBe('Acme');
    expect(url.searchParams.get('page')).toBeNull();
    expect(url.searchParams.get('limit')).toBeNull();
  });

  it('keeps client, division, method, and assigned user filters on exports', () => {
    const path = operationsBoardExportPath({
      stageId: 'execution',
      statusValue: 'planned',
      client: 'client-1',
      campaignType: 'Oncology',
      campaign: 'BMD',
      assignedUser: 'ops@tylo.test',
    });
    const url = new URL(path, 'http://local.test');
    expect(url.searchParams.get('client')).toBe('client-1');
    expect(url.searchParams.get('campaignType')).toBe('Oncology');
    expect(url.searchParams.get('campaign')).toBe('BMD');
    expect(url.searchParams.get('assignedUser')).toBe('ops@tylo.test');
  });

  it('names the workbook after the selected section', () => {
    expect(operationsBoardExportFilename({
      stageLabel: 'Request',
      statusLabel: 'Review Pending',
    })).toBe('Camp_One_Request_Review_Pending.xlsx');
  });
});
