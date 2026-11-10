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

  it('maps finance, permissions, and sign-in events to the right module', () => {
    expect(resolveActivityModule('FINANCE.CLIENT_INVOICE.ISSUE').label).toBe('Finance One');
    expect(resolveActivityModule('USER.LOGIN_SUCCESS').label).toBe('Sign-in');
    expect(resolveActivityModule('ROLE.UPDATE').label).toBe('User & Permissions');
    expect(resolveActivityModule('AGREEMENT.SEND').label).toBe('Document Centre');
  });

  it('surfaces severity source and record metadata from stored rows', () => {
    const described = describeActivity({
      _id: 'evt-1',
      action: 'ROLE.DELETE',
      entityType: 'Role',
      entityId: 'role-9',
      actorEmail: 'admin@tylo.test',
      result: 'SUCCESS',
      severity: 'critical',
      source: 'UI',
      activityType: 'cancellation',
      reason: 'Obsolete role',
    });
    expect(described.severityLabel).toBe('Critical');
    expect(described.sourceLabel).toBe('UI');
    expect(described.eventId).toBe('evt-1');
    expect(described.recordId).toBe('role-9');
    expect(described.reason).toBe('Obsolete role');
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
