import { describe, expect, it } from 'vitest';

describe('RequirePermission route permission keys', () => {
  it('uses namespaced permission strings', () => {
    const keys = [
      'users:read',
      'users:write',
      'assets:read',
      'finance:read',
      'finance:verify',
      'finance:approve',
      'finance:pay',
      'camps:read',
      'agreements:read',
      'logistics:read',
    ];
    for (const key of keys) {
      expect(key).toMatch(/^[a-z0-9-]+:[a-z0-9-]+$/);
    }
  });
});
