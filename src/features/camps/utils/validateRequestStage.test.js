import { describe, expect, it } from 'vitest';
import { isRequestStageComplete, validateRequestStageForm } from './validateRequestStage.js';

function isoOffset(days) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const validRequest = {
  source: 'Email',
  clientId: 'client-1',
  campaignType: 'Ortho',
  campaignName: 'BMD',
  campDate: isoOffset(0),
  startTime: '09:00',
  endTime: '13:00',
  doctorName: 'Rajesh Kumar',
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

  it('rejects doctor names with Dr prefix', () => {
    const errors = validateRequestStageForm({
      ...validRequest,
      doctorName: 'Dr. Rajesh Kumar',
    });
    expect(errors).toContain('Enter doctor name without Dr or Dr. — use Title Case (e.g. Rajesh Kumar)');
  });

  it('allows historical camp dates for any user', () => {
    const errors = validateRequestStageForm({ ...validRequest, campDate: isoOffset(-5) });
    expect(errors).toEqual([]);
  });

  it('accepts zero expected patients', () => {
    const errors = validateRequestStageForm({
      ...validRequest,
      expectedPatients: 0,
    });
    expect(errors).toEqual([]);
    expect(isRequestStageComplete({ ...validRequest, expectedPatients: '0' })).toBe(true);
  });

  it('blocks request dates in the future', () => {
    const errors = validateRequestStageForm({
      ...validRequest,
      requestDate: isoOffset(1),
    });
    expect(errors).toContain('Request date cannot be in the future');
  });

  it('allows yesterday and T-2 request dates without a future-date error', () => {
    expect(validateRequestStageForm({
      ...validRequest,
      requestDate: isoOffset(-1),
    })).not.toContain('Request date cannot be in the future');
    expect(validateRequestStageForm({
      ...validRequest,
      requestDate: isoOffset(-2),
    })).toEqual([]);
  });

  it('allows historical request dates for any user', () => {
    const errors = validateRequestStageForm({ ...validRequest, requestDate: isoOffset(-5) });
    expect(errors).toEqual([]);
  });

  it('skips PIN, state, zone, district, and city when skipLocation is set', () => {
    const errors = validateRequestStageForm({
      ...validRequest,
      state: '',
      district: '',
      city: '',
      pincode: '',
      zone: '',
    }, { skipLocation: true });
    expect(errors).toEqual([]);
  });
});
