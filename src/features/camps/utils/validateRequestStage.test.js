import { describe, expect, it } from 'vitest';
import { isRequestStageComplete, validateRequestStageForm } from './validateRequestStage.js';

const validRequest = {
  source: 'Email',
  clientId: 'client-1',
  campaignType: 'Ortho',
  campaignName: 'BMD',
  campDate: '2026-08-01',
  startTime: '09:00',
  endTime: '13:00',
  doctorName: 'Dr Smith',
  doctorCode: 'DOC001',
  campAddress: '12 Main Street',
  state: 'Maharashtra',
  district: 'Mumbai',
  city: 'Mumbai',
  pincode: '400001',
  hq: 'Mumbai HQ',
  zone: 'West Zone',
  expectedPatients: 25,
  contactPersonLevel: 'Territory Manager',
  fieldPersonName: 'Ravi Kumar',
  fieldPersonPhone: '9876543210',
  contactPersons: [{ level: 'Territory Manager', name: 'Ravi Kumar', phone: '9876543210' }],
};

describe('validateRequestStageForm', () => {
  it('returns no errors for a complete request', () => {
    expect(validateRequestStageForm(validRequest)).toEqual([]);
    expect(isRequestStageComplete(validRequest)).toBe(true);
  });

  it('requires a 10-digit contact person number', () => {
    const errors = validateRequestStageForm({
      ...validRequest,
      fieldPersonPhone: '12345',
      contactPersons: [{ level: 'Territory Manager', name: 'Ravi Kumar', phone: '12345' }],
    });
    expect(errors).toContain('Contact person number must be exactly 10 digits');
    expect(isRequestStageComplete({
      ...validRequest,
      fieldPersonPhone: '12345',
      contactPersons: [{ level: 'Territory Manager', name: 'Ravi Kumar', phone: '12345' }],
    })).toBe(false);
  });

  it('accepts normalized phone values with country prefix', () => {
    const errors = validateRequestStageForm({
      ...validRequest,
      fieldPersonPhone: '+91 9876543210',
    });
    expect(errors).not.toContain('Contact person number must be exactly 10 digits');
  });

  it('accepts zero expected patients', () => {
    const errors = validateRequestStageForm({
      ...validRequest,
      expectedPatients: 0,
    });
    expect(errors).toEqual([]);
    expect(isRequestStageComplete({ ...validRequest, expectedPatients: '0' })).toBe(true);
  });
});
