import { describe, expect, it } from 'vitest';
import {
  assignmentCopySourceFromCamp,
  formatCampAssignmentDetails,
} from './campAssignmentCopy.js';

describe('formatCampAssignmentDetails', () => {
  it('formats assigned camp details for sharing with bold labels and Title Case', () => {
    const text = formatCampAssignmentDetails({
      doctorName: 'Dr. balkrishna patil',
      campDate: '2026-08-10',
      campAddress: 'guru krupa clinic, shop no. 10, rustomjee, global city virar west palghar',
      startTime: '09:00',
      endTime: '12:00',
      fieldPersonName: 'vishal gupta',
      fieldPersonPhone: '7559133770',
      hcwName: 'mahesh',
      hcwContact: '9999999999',
    });

    expect(text).toBe(
      [
        '*Doctor Name:* Balkrishna Patil',
        '*Clinic Date:* 10-08-2026',
        '*Clinic Address:* Guru Krupa Clinic, Shop No. 10, Rustomjee, Global City Virar West Palghar',
        '*Clinic Timing:* 09:00 – 12:00',
        '*Contact Person:* Vishal Gupta',
        '*Contact Number:* 7559133770',
        '*HCW Name:* Mahesh',
        '*HCW Number:* 9999999999',
        '',
      ].join('\n'),
    );
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
