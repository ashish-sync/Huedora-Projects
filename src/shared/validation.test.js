import { describe, expect, it } from 'vitest';
import {
  emailError,
  emailListError,
  isValidEmail,
  isValidPhone,
  normalizePhone,
  phoneError,
} from './validation.js';

describe('normalizePhone', () => {
  it('strips non-digits and normalizes country prefixes', () => {
    expect(normalizePhone('98765 43210')).toBe('9876543210');
    expect(normalizePhone('+91 9876543210')).toBe('9876543210');
    expect(normalizePhone('09876543210')).toBe('9876543210');
  });
});

describe('isValidPhone', () => {
  it('accepts exactly 10 digits', () => {
    expect(isValidPhone('9876543210')).toBe(true);
    expect(isValidPhone('+91 9876543210')).toBe(true);
  });

  it('rejects incomplete or invalid numbers', () => {
    expect(isValidPhone('98765')).toBe(false);
    expect(isValidPhone('abc')).toBe(false);
    expect(isValidPhone('')).toBe(false);
  });
});

describe('phoneError', () => {
  it('returns empty for blank optional values', () => {
    expect(phoneError('')).toBe('');
    expect(phoneError('   ')).toBe('');
  });

  it('returns a clear message for invalid numbers', () => {
    expect(phoneError('12345')).toBe('Mobile number must be exactly 10 digits');
    expect(phoneError('12345', 'SPOC mobile number')).toBe('SPOC mobile number must be exactly 10 digits');
  });
});

describe('isValidEmail', () => {
  it('accepts standard email addresses', () => {
    expect(isValidEmail('user@client.com')).toBe(true);
    expect(isValidEmail('OPS@CLIENT.IN')).toBe(true);
  });

  it('rejects malformed addresses', () => {
    expect(isValidEmail('not-an-email')).toBe(false);
    expect(isValidEmail('missing@domain')).toBe(false);
    expect(isValidEmail('@client.com')).toBe(false);
  });
});

describe('emailError', () => {
  it('returns empty for blank optional values', () => {
    expect(emailError('')).toBe('');
  });

  it('returns a domain suffix hint for invalid emails', () => {
    expect(emailError('bad@domain')).toContain('valid domain suffix');
  });
});

describe('emailListError', () => {
  it('accepts comma-separated valid emails', () => {
    expect(emailListError('a@x.com, b@y.in')).toBe('');
    expect(emailListError('a@x.com; b@y.in')).toBe('');
  });

  it('flags the first invalid entry in a list', () => {
    const message = emailListError('good@x.com, bad@domain, other@z.net', 'Assigned user email');
    expect(message).toContain('bad@domain');
    expect(message).toContain('Assigned user email');
  });
});
