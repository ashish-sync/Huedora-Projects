import { describe, expect, it } from 'vitest';
import {
  activityChanges,
  describeActivity,
  resolveActivityModule,
} from './activityLogCatalog.js';

describe('activityLogCatalog', () => {
  it('turns a camp approval into who / what / where / outcome', () => {
    const described = describeActivity({
      action: 'camp_ops.approve',
      entityType: 'camp_ops_camp',
      actorEmail: 'priya@tylo.test',
      result: 'SUCCESS',
      after: { campId: '26-10-0042', clientName: 'Acme' },
    });
    expect(described.moduleLabel).toBe('Camp One');
    expect(described.title).toBe('Approved a camp');
    expect(described.status).toBe('Completed');
    expect(described.summary).toContain('priya@tylo.test');
    expect(described.summary).toContain('26-10-0042');
    expect(described.summary).not.toContain('camp_ops.approve');
  });

  it('maps finance and sign-in events to the right module', () => {
    expect(resolveActivityModule('FINANCE.CLIENT_INVOICE.ISSUE').label).toBe('Finance One');
    expect(resolveActivityModule('USER.LOGIN_SUCCESS').label).toBe('Sign-in');
  });

  it('lists readable field changes and skips secrets', () => {
    const changes = activityChanges(
      { status: 'pending_review', passwordHash: 'x' },
      { status: 'approved', passwordHash: 'y' },
    );
    expect(changes).toEqual([
      { field: 'status', label: 'Status', from: 'pending_review', to: 'approved' },
    ]);
  });
});
