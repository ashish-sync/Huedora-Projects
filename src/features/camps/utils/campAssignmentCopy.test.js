import { describe, expect, it } from 'vitest';
import {
  assignmentCopySourceFromCamp,
  formatCampAssignmentDetails,
} from './campAssignmentCopy.js';

describe('formatCampAssignmentDetails', () => {
  it('formats assigned camp details for sharing', () => {
    const text = formatCampAssignmentDetails({
      doctorName: 'Dr. Demo ASGN',
      campDate: '2026-08-10',
      campAddress: '12 MG Road, Pune, Maharashtra 411001',
      startTime: '09:00',
      endTime: '12:00',
      fieldPersonName: 'Amit Sharma',
      fieldPersonPhone: '9876543210',
      hcwName: 'Ravi Technician',
      hcwContact: '9123456780',
    });

    expect(text).toContain('Doctor Name: Dr. Demo ASGN');
    expect(text).toContain('Clinic Date: 10-08-2026');
    expect(text).toContain('Clinic Address: 12 MG Road, Pune, Maharashtra 411001');
    expect(text).toContain('Clinic Timing: 09:00 – 12:00');
    expect(text).toContain('Contact Person: Amit Sharma');
    expect(text).toContain('Contact Number: 9876543210');
    expect(text).toContain('HCW Name: Ravi Technician');
    expect(text).toContain('HCW Number: 9123456780');
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
