import { describe, expect, it } from 'vitest';
import { recordToForm, validateClientMasterForm } from './clientMasterValidation.js';

const validBase = {
  programName: 'Wellness Program',
  campType: 'Corporate',
  clientName: 'Acme Health',
  campName: 'BMD',
  spocNumber: '',
  assignedUserEmails: '',
};

describe('validateClientMasterForm', () => {
  it('requires core client master fields', () => {
    const errors = validateClientMasterForm({});
    expect(errors.programName).toBeTruthy();
    expect(errors.campType).toBeTruthy();
    expect(errors.clientName).toBeTruthy();
    expect(errors.campName).toBeTruthy();
  });

  it('rejects partial SPOC mobile numbers', () => {
    const errors = validateClientMasterForm({
      ...validBase,
      spocNumber: '98765',
    });
    expect(errors.spocNumber).toBe('SPOC mobile number must be exactly 10 digits');
  });

  it('accepts a valid 10-digit SPOC number', () => {
    const errors = validateClientMasterForm({
      ...validBase,
      spocNumber: '9876543210',
    });
    expect(errors.spocNumber).toBeUndefined();
  });

  it('rejects invalid SPOC email addresses', () => {
    const errors = validateClientMasterForm({
      ...validBase,
      spocEmail: 'not-an-email',
    });
    expect(errors.spocEmail).toContain('SPOC email address');
  });

  it('accepts a valid SPOC email address', () => {
    const errors = validateClientMasterForm({
      ...validBase,
      spocEmail: 'spoc@client.com',
    });
    expect(errors.spocEmail).toBeUndefined();
  });

  it('accepts comma-separated SPOC email addresses', () => {
    const errors = validateClientMasterForm({
      ...validBase,
      spocEmail: 'spoc@client.com, ops@client.in',
    });
    expect(errors.spocEmail).toBeUndefined();
  });

  it('rejects invalid emails in a SPOC email list', () => {
    const errors = validateClientMasterForm({
      ...validBase,
      spocEmail: 'spoc@client.com, not-an-email',
    });
    expect(errors.spocEmail).toContain('not-an-email');
  });

  it('rejects invalid assigned user email lists', () => {
    const errors = validateClientMasterForm({
      ...validBase,
      assignedUserEmails: 'valid@client.com, not-an-email',
    });
    expect(errors.assignedUserEmails).toContain('not-an-email');
  });

  it('accepts comma-separated assigned user emails', () => {
    const errors = validateClientMasterForm({
      ...validBase,
      assignedUserEmails: 'ops@client.com, user@client.in',
    });
    expect(errors.assignedUserEmails).toBeUndefined();
  });
});

describe('recordToForm billing', () => {
  it('keeps extra address lines from the Client Master row', () => {
    const form = recordToForm({
      billingAddress: 'Pune HQ\n3rd Floor, Extra Landmark',
      billing: { address: 'Pune HQ' },
      clientName: 'Acme',
      programName: 'Wellness',
      campName: 'BMD',
      campType: 'HCW Only',
    });
    expect(form.billingAddress).toBe('Pune HQ\n3rd Floor, Extra Landmark');
  });
});
