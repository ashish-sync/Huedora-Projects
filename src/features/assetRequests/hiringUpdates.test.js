import { describe, expect, it } from 'vitest';
import {
  canCreatorEditHiringDetails,
  hasOpenClarification,
  hiringProgressLabel,
  hiringProgressOptionsForType,
  hiringUpdateKindLabel,
  requestDisplayStatus,
} from './hiringUpdates.js';

describe('hiringUpdates client helpers', () => {
  it('labels progress and kinds', () => {
    expect(hiringProgressLabel('OPEN')).toBe('Requested');
    expect(hiringProgressLabel('IN_PROGRESS')).toBe('Accepted');
    expect(hiringProgressLabel('AWAITING_INFO')).toBe('Clarification');
    expect(hiringProgressLabel('HCW_EXISTS')).toBe('HCW Exists');
    expect(hiringProgressLabel('FULFILLED')).toBe('Assigned');
    expect(hiringUpdateKindLabel('CLARIFICATION')).toBe('Clarification');
  });

  it('adds HCW Exists only for Hiring Update status options', () => {
    expect(hiringProgressOptionsForType('TRAINING').map((o) => o.value)).toEqual([
      'IN_PROGRESS',
      'AWAITING_INFO',
      'ON_HOLD',
    ]);
    expect(hiringProgressOptionsForType('HIRING').map((o) => o.value)).toEqual([
      'IN_PROGRESS',
      'AWAITING_INFO',
      'ON_HOLD',
      'HCW_EXISTS',
    ]);
  });

  it('shows a single display status for hiring and other rows', () => {
    expect(
      requestDisplayStatus({
        requestType: 'HIRING',
        status: 'REQUESTED',
        hiringProgress: 'OPEN',
      }).label
    ).toBe('Requested');
    expect(
      requestDisplayStatus({
        requestType: 'HIRING',
        status: 'REQUESTED',
        hiringProgress: 'ON_HOLD',
      }).label
    ).toBe('On hold');
    expect(
      requestDisplayStatus({
        requestType: 'HIRING',
        status: 'REJECTED',
        hiringProgress: 'AWAITING_INFO',
      }).label
    ).toBe('Refused');
    expect(
      requestDisplayStatus({
        requestType: 'HIRING',
        status: 'COMPLETED',
        hiringProgress: 'FULFILLED',
      }).label
    ).toBe('Assigned');
    expect(
      requestDisplayStatus({
        requestType: 'HIRING',
        status: 'COMPLETED',
        hiringProgress: 'HCW_EXISTS',
      }).label
    ).toBe('HCW Exists');
    expect(
      requestDisplayStatus({
        requestType: 'OTHER',
        status: 'REQUESTED',
        hiringProgress: 'AWAITING_INFO',
      }).label
    ).toBe('Clarification');
    expect(
      requestDisplayStatus({
        requestType: 'TRAINING',
        status: 'COMPLETED',
        hiringProgress: 'FULFILLED',
      }).label
    ).toBe('Closed');
  });

  it('detects open clarification for requestor reply window', () => {
    const row = {
      requestType: 'OTHER',
      status: 'REQUESTED',
      hiringProgress: 'OPEN',
      hiringUpdates: [
        {
          id: '1',
          kind: 'CLARIFICATION',
          requiresReply: true,
          resolvedAt: null,
          message: 'Need pin',
        },
      ],
    };
    expect(hasOpenClarification(row)).toBe(true);
    expect(canCreatorEditHiringDetails(row)).toBe(true);
    expect(
      canCreatorEditHiringDetails({
        ...row,
        hiringProgress: 'IN_PROGRESS',
        hiringUpdates: [{ ...row.hiringUpdates[0], resolvedAt: '2026-01-01' }],
      })
    ).toBe(false);
  });
});
