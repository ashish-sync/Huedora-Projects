import { describe, expect, it } from 'vitest';
import {
  categoryLabel,
  notificationEntityPath,
  priorityLabel,
} from './notificationLinks.js';

describe('notificationLinks', () => {
  it('deep-links camp entities to manage edit', () => {
    expect(
      notificationEntityPath({
        entityType: 'camp_ops_camp',
        entityId: 'abc123',
      }),
    ).toBe('/camp-one/manage/abc123/edit');
  });

  it('deep-links bulk camp summaries to manage list', () => {
    expect(
      notificationEntityPath({
        type: 'CAMP_BULK_SUCCESS',
        meta: { deepLinkHint: 'camp_manage' },
      }),
    ).toBe('/camp-one/manage');
  });

  it('labels categories and severity', () => {
    expect(categoryLabel({ type: 'CAMP_BULK_PARTIAL', module: 'camp' })).toBe('Bulk action');
    expect(categoryLabel({ type: 'CAMP_REVIEW_OVERDUE', module: 'camp' })).toBe('Alert');
    expect(priorityLabel('critical')).toBe('Critical');
  });
});
