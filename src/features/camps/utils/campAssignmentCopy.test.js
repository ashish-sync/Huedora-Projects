import { describe, expect, it } from 'vitest';
import {
  assignmentCopySourceFromCamp,
  formatCampAssignmentDetails,
} from './campAssignmentCopy.js';

describe('formatCampAssignmentDetails', () => {
  it('formats assigned camp details with display name first and expected patients before contact person', () => {
    const text = formatCampAssignmentDetails({
      displayName: 'Viva BMD Program',
      doctorName: 'Dr. balkrishna patil',
      campDate: '2026-08-10',
      campAddress: 'guru krupa clinic, shop no. 10, rustomjee, global city virar west palghar',
      startTime: '09:00',
      endTime: '12:00',
      expectedPatients: 40,
      fieldPersonName: 'vishal gupta',
      fieldPersonPhone: '7559133770',
      hcwName: 'mahesh',
      hcwContact: '9999999999',
    });

    expect(text).toBe(
      [
        '*Viva BMD Program*',
        '*Doctor Name:* Balkrishna Patil',
        '*Clinic Date:* 10-08-2026',
        '*Clinic Timing:* 09:00 – 12:00',
        '*Clinic Address:* Guru Krupa Clinic, Shop No. 10, Rustomjee, Global City Virar West Palghar',
        '*Expected Patients:* 40',
        '*Contact Person:* Vishal Gupta',
        '*Contact Number:* 7559133770',
        '*HCW Name:* Mahesh',
        '*HCW Number:* 9999999999',
        '',
      ].join('\n'),
    );
  });

  it('omits expected patients when zero or unset', () => {
    const text = formatCampAssignmentDetails({
      displayName: 'Ortho Camps',
      doctorName: 'Dr. Demo',
      campDate: '2026-08-10',
      startTime: '09:00',
      endTime: '12:00',
      expectedPatients: 0,
      fieldPersonName: 'Amit Sharma',
      fieldPersonPhone: '7559133770',
      hcwName: 'Ravi',
      hcwContact: '9999999999',
    });

    expect(text.startsWith('*Ortho Camps*\n')).toBe(true);
    expect(text).not.toContain('Display Name');
    expect(text).not.toContain('Expected Patients');
    expect(text).toContain('*Contact Person:* Amit Sharma');
  });

  it('resolves display name from client master records when not on the form', () => {
    const text = formatCampAssignmentDetails({
      campaignType: 'Ortho',
      campaignName: 'BMD',
      doctorName: 'Dr. Demo',
      campDate: '2026-08-10',
      startTime: '09:00',
      endTime: '12:00',
      fieldPersonName: 'Amit Sharma',
      hcwName: 'Ravi',
      hcwContact: '9999999999',
    }, {
      clientMasterRecords: [{
        programName: 'Ortho',
        campName: 'BMD',
        displayName: 'Ortho BMD Label',
        isActive: true,
      }],
    });

    expect(text.startsWith('*Ortho BMD Label*\n')).toBe(true);
    expect(text).not.toContain('Display Name');
  });
});

describe('assignmentCopySourceFromCamp', () => {
  it('maps camp list records through campToForm', () => {
    const form = assignmentCopySourceFromCamp({
      doctorName: 'Dr. Demo',
      campDate: '2026-08-10',
      fieldPersonName: 'Amit Sharma',
      hcwName: 'Ravi Technician',
      hcwContact: '9123456780',
    });
    expect(form.doctorName).toBe('Dr. Demo');
    expect(form.fieldPersonName).toBe('Amit Sharma');
    expect(form.hcwName).toBe('Ravi Technician');
  });

  it('falls back to hospitalName and contactPersons when list fields are sparse', () => {
    const form = assignmentCopySourceFromCamp({
      doctorName: 'Dr. Demo',
      campDate: '2026-08-10',
      hospitalName: 'City Clinic Virar',
      expectedPatients: 35,
      contactPersons: [{ name: 'vishal gupta', phone: '7559133770', level: 'Territory Manager' }],
      hcwName: 'Mahesh',
      hcwContact: '9999999999',
    });
    expect(form.campAddress).toBe('City Clinic Virar');
    expect(form.fieldPersonName).toMatch(/Vishal/i);
    expect(form.fieldPersonPhone).toBe('7559133770');
    expect(form.expectedPatients).toBe(35);

    const text = formatCampAssignmentDetails(form, { displayName: 'Viva BMD' });
    expect(text).toContain('*Clinic Address:* City Clinic Virar');
    expect(text).toContain('*Expected Patients:* 35');
    expect(text).toContain('*Contact Person:* Vishal Gupta');
  });
});
