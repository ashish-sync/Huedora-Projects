import { describe, expect, it } from 'vitest';
import {
  buildOpsReviewReturnTo,
  readOpsReviewReturnTo,
  safeOpsReviewReturnTo,
  withOpsReviewReturnTo,
} from './opsReviewReturn.js';

describe('opsReviewReturn', () => {
  it('builds the Camp One module-review location with filters', () => {
    expect(buildOpsReviewReturnTo({
      from: '2026-10-01',
      to: '2026-10-31',
      preset: 'month',
      client: 'client-1',
      campaign: 'BMD',
      campaignType: 'Oncology',
      assignedUser: 'ops@tylo.test',
    })).toBe(
      '/dashboard?tab=drilldown&module=camps&from=2026-10-01&to=2026-10-31&preset=month&client=client-1&campaign=BMD&campaignType=Oncology&assignedUser=ops%40tylo.test',
    );
  });

  it('rejects off-dashboard or absolute return targets', () => {
    expect(safeOpsReviewReturnTo('/camp-one/manage')).toBe('');
    expect(safeOpsReviewReturnTo('https://evil.test/dashboard')).toBe('');
    expect(safeOpsReviewReturnTo('//evil.test')).toBe('');
    expect(safeOpsReviewReturnTo('/dashboard/extra')).toBe('');
    expect(safeOpsReviewReturnTo('/dashboard?tab=drilldown&module=camps')).toBe(
      '/dashboard?tab=drilldown&module=camps',
    );
  });

  it('preserves a safe returnTo on manage query params', () => {
    const params = withOpsReviewReturnTo(
      new URLSearchParams('stage=execution&status=planned'),
      '/dashboard?tab=drilldown&module=camps&preset=month',
    );
    expect(params.get('returnTo')).toBe('/dashboard?tab=drilldown&module=camps&preset=month');
    expect(readOpsReviewReturnTo(params, null)).toBe(
      '/dashboard?tab=drilldown&module=camps&preset=month',
    );
  });
});
