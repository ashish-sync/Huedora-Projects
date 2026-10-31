import { describe, expect, it } from 'vitest';
import { contactMatchesCustody, custodyRequiresCustodianContact } from './assetMasterOptions.js';

describe('contactMatchesCustody', () => {
  it('accepts any Healthcare Worker for Individual or Service Provider custody', () => {
    const individual = { contactCategory: 'Healthcare Worker', resourceType: 'Individual' };
    const serviceProvider = {
      contactCategory: 'Healthcare Worker',
      resourceType: 'Service Provider',
    };
    const fullTime = { contactCategory: 'Healthcare Worker', resourceType: 'Full-Time' };
    const other = { contactCategory: 'Healthcare Worker', resourceType: 'Other' };
    const client = { contactCategory: 'Client', resourceType: '' };

    expect(custodyRequiresCustodianContact('Individual')).toBe(true);
    expect(contactMatchesCustody(individual, 'Individual')).toBe(true);
    expect(contactMatchesCustody(serviceProvider, 'Service Provider')).toBe(true);
    expect(contactMatchesCustody(serviceProvider, 'Individual')).toBe(true);
    expect(contactMatchesCustody(fullTime, 'Individual')).toBe(true);
    expect(contactMatchesCustody(other, 'Service Provider')).toBe(true);
    expect(contactMatchesCustody(client, 'Individual')).toBe(false);
    expect(contactMatchesCustody(null, 'Individual')).toBe(false);
  });
});
