import { describe, expect, it } from 'vitest';
import { hydrateProviderEmployeesForForm } from './ServiceProviderProfile.jsx';

describe('hydrateProviderEmployeesForForm', () => {
  it('copies a legacy agency Camp Amount onto employees that have none', () => {
    const next = hydrateProviderEmployeesForForm(
      [
        { id: 'e1', name: 'Karan', mobile: '911', campAmount: '' },
        { id: 'e2', name: 'Neha', mobile: '922', campAmount: 2100 },
      ],
      1500,
    );
    expect(next[0].campAmount).toBe('1500');
    expect(next[1].campAmount).toBe('2100');
  });
});
