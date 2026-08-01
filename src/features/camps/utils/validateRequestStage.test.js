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
  campDate: '2026-08-01',
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

  it('rejects historical camp dates for non-team-leaders', () => {
    const errors = validateRequestStageForm(
      { ...validRequest, campDate: isoOffset(-5) },
      { canSetHistorical: false },
    );
    expect(errors.some((message) => /Team Leaders/.test(message))).toBe(true);
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
