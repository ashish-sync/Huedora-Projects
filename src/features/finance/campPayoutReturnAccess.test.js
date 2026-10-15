/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import { canReturnCampFromPayoutQueue } from './campPayoutReturnAccess.js';

describe('canReturnCampFromPayoutQueue', () => {
  it('allows Admin wildcard', () => {
    expect(canReturnCampFromPayoutQueue({ permissions: ['*'] })).toBe(true);
  });

  it('allows Accounts role and designation', () => {
    expect(canReturnCampFromPayoutQueue({
      permissions: ['finance:write'],
      roles: [{ name: 'Accounts' }],
    })).toBe(true);
    expect(canReturnCampFromPayoutQueue({
      permissions: ['finance:write'],
      designation: 'Accounts',
    })).toBe(true);
  });

  it('allows Lead Technology designation with en-dash', () => {
    expect(canReturnCampFromPayoutQueue({
      permissions: ['finance:write'],
      designation: 'Lead – Technology & Process Implementation',
    })).toBe(true);
  });

  it('allows Zohra by email', () => {
    expect(canReturnCampFromPayoutQueue({
      permissions: ['finance:write'],
      email: 'zohra@tylocare.com',
      fullName: 'Zohra Sawant',
    })).toBe(true);
  });

  it('denies Camp Coordinator with only finance:write', () => {
    expect(canReturnCampFromPayoutQueue({
      permissions: ['finance:write'],
      roles: [{ name: 'Camp Coordinator' }],
      designation: 'Healthcare Camp Coordinator',
    })).toBe(false);
  });
});
