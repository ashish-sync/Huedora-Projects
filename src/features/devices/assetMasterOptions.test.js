import { describe, expect, it } from 'vitest';
import { contactMatchesCustody, custodyRequiresCustodianContact } from './assetMasterOptions.js';

describe('contactMatchesCustody', () => {
  it('requires Healthcare Worker type to match Individual vs Service Provider', () => {
    const individual = { contactCategory: 'Healthcare Worker', resourceType: 'Individual' };
    const serviceProvider = {
      contactCategory: 'Healthcare Worker',
      resourceType: 'Service Provider',
    };
    const fullTime = { contactCategory: 'Healthcare Worker', resourceType: 'Full-Time' };

    expect(custodyRequiresCustodianContact('Individual')).toBe(true);
    expect(contactMatchesCustody(individual, 'Individual')).toBe(true);
    expect(contactMatchesCustody(serviceProvider, 'Service Provider')).toBe(true);
    expect(contactMatchesCustody(serviceProvider, 'Individual')).toBe(false);
    expect(contactMatchesCustody(fullTime, 'Individual')).toBe(false);
  });
});
