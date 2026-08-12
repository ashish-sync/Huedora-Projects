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
        '*Display Name:* Viva BMD Program',
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

    expect(text).toContain('*Display Name:* Ortho Camps');
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

    expect(text).toContain('*Display Name:* Ortho BMD Label');
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
});
