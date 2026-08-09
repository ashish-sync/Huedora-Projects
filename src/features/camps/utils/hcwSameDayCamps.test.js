import { describe, expect, it } from 'vitest';
import { buildHcwSameDayCampRows, formatCampTimeLabel } from './hcwSameDayCamps.js';

describe('formatCampTimeLabel', () => {
  it('formats morning and afternoon times', () => {
    expect(formatCampTimeLabel('08:00')).toBe('8:00 AM');
    expect(formatCampTimeLabel('14:00')).toBe('2:00 PM');
    expect(formatCampTimeLabel('15:30')).toBe('3:30 PM');
  });
});

describe('buildHcwSameDayCampRows', () => {
  const camps = [
    {
      _id: 'a',
      campId: 'CAMP-A',
      hcwContactId: 'hcw-1',
      assignmentDecision: 'assign',
      status: 'approved',
      startTime: '14:00',
      endTime: '17:00',
      pincode: '560001',
    },
    {
      _id: 'b',
      campId: 'CAMP-B',
      hcwContactId: 'hcw-1',
      assignmentDecision: 'assign',
      status: 'approved',
      startTime: '08:00',
      endTime: '14:00',
      pincode: '641045',
    },
    {
      _id: 'c',
      campId: 'CAMP-C',
      hcwContactId: 'other',
      assignmentDecision: 'assign',
      status: 'approved',
      startTime: '09:00',
      endTime: '12:00',
      pincode: '110001',
    },
    {
      _id: 'd',
      campId: 'CAMP-D',
      hcwContactId: 'hcw-1',
      assignmentDecision: 'assign',
      status: 'cancelled',
      startTime: '10:00',
      endTime: '12:00',
      pincode: '400001',
    },
  ];

  it('returns sorted active camps for the HCW with start, end, and PIN', () => {
    const rows = buildHcwSameDayCampRows(camps, {
      hcwContactId: 'hcw-1',
      excludeCampId: 'current',
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      campId: 'CAMP-B',
      startLabel: '8:00 AM',
      endLabel: '2:00 PM',
      pincode: '641045',
    });
    expect(rows[1]).toMatchObject({
      campId: 'CAMP-A',
      startLabel: '2:00 PM',
      endLabel: '5:00 PM',
      pincode: '560001',
    });
  });

  it('excludes the camp being assigned', () => {
    const rows = buildHcwSameDayCampRows(camps, {
      hcwContactId: 'hcw-1',
      excludeCampId: 'b',
    });
    expect(rows.map((row) => row.campId)).toEqual(['CAMP-A']);
  });
});
