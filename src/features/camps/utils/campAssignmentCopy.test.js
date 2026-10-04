import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  assignmentCopySourceFromCamp,
  copyCampAssignmentDetailsFromRecord,
  formatCampAssignmentDetails,
  toShortActivityFormUrl,
} from './campAssignmentCopy.js';
import { campApi } from '../campOpsApi.js';

vi.mock('../campOpsApi.js', () => ({
  campApi: {
    mintExecutionLink: vi.fn(),
  },
  clientMasterApi: {
    listByClient: vi.fn(),
  },
}));

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

  it('appends short Activity Form link at the end when provided', () => {
    const text = formatCampAssignmentDetails({
      displayName: 'Viva BMD Program',
      doctorName: 'Dr. Demo',
      campDate: '2026-08-10',
      startTime: '09:00',
      endTime: '12:00',
      fieldPersonName: 'Amit Sharma',
      fieldPersonPhone: '7559133770',
      hcwName: 'Ravi',
      hcwContact: '9999999999',
    }, {
      activityFormUrl: 'https://app.example.com/camp-execute/tok_abc123',
    });

    expect(text.trimEnd().endsWith('*Activity Form:* https://app.example.com/e/tok_abc123')).toBe(true);
  });
});

describe('toShortActivityFormUrl', () => {
  it('rewrites camp-execute paths to /e/:token', () => {
    expect(toShortActivityFormUrl('https://qa.example.com/camp-execute/abc.def')).toBe(
      'https://qa.example.com/e/abc.def',
    );
    expect(toShortActivityFormUrl('https://qa.example.com/e/abc.def')).toBe(
      'https://qa.example.com/e/abc.def',
    );
  });
});

describe('copyCampAssignmentDetailsFromRecord', () => {
  beforeEach(() => {
    vi.mocked(campApi.mintExecutionLink).mockReset();
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it('mints and appends Activity Form for assigned list rows', async () => {
    vi.mocked(campApi.mintExecutionLink).mockResolvedValue({
      data: { data: { url: 'http://localhost:5173/e/AbCdEfGh12', token: 'AbCdEfGh12' } },
    });

    const result = await copyCampAssignmentDetailsFromRecord({
      _id: 'camp-mongo-id-1',
      displayName: 'Viva BMD',
      doctorName: 'Dr. Demo',
      campDate: '2026-10-22',
      startTime: '09:00',
      endTime: '12:00',
      campAddress: '12 MG Road',
      expectedPatients: 50,
      fieldPersonName: 'Amit Sharma',
      fieldPersonPhone: '9876543210',
      hcwName: 'Ravi Technician',
      hcwContact: '9123456780',
      assignmentStatus: 'Assigned',
    });

    expect(campApi.mintExecutionLink).toHaveBeenCalledWith('camp-mongo-id-1');
    expect(result.copied).toBe(true);
    expect(result.activityFormUrl).toContain('/e/AbCdEfGh12');
    expect(result.activityFormError).toBe('');
    expect(result.text).toContain('*Activity Form:* http://localhost:5173/e/AbCdEfGh12');
  });

  it('returns server expiry reason when Activity Form mint is blocked', async () => {
    vi.mocked(campApi.mintExecutionLink).mockRejectedValue(
      new Error('Activity Form link is disabled — more than 72 hours after camp start'),
    );

    const result = await copyCampAssignmentDetailsFromRecord({
      _id: 'camp-mongo-id-2',
      campId: '26-09-0003',
      doctorName: 'Dr. Demo',
      campDate: '2026-09-03',
      startTime: '09:00',
      hcwName: 'Ravi',
      assignmentStatus: 'Assigned',
    });

    expect(result.copied).toBe(true);
    expect(result.activityFormUrl).toBe('');
    expect(result.activityFormError).toMatch(/72 hours after camp start/i);
    expect(result.text).not.toContain('*Activity Form:*');
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
