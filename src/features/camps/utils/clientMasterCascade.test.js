import { describe, expect, it } from 'vitest';
import {
  applyClientMasterCascade,
  parseClientMasterDivisions,
  pickSingleOption,
  resolveClientMasterHealthcareWorker,
  resolveClientMasterHealthcareWorkers,
} from './clientMasterCascade.js';

describe('parseClientMasterDivisions', () => {
  it('ignores inactive programs when building division list', () => {
    const { programs, divisions } = parseClientMasterDivisions({
      data: [
        { programName: 'Ortho', campNames: ['BMD'], isActive: true },
        { programName: 'Legacy', campNames: ['Old'], isActive: false },
      ],
      divisions: ['Ortho', 'Legacy'],
    });

    expect(programs).toHaveLength(1);
    expect(divisions).toEqual(['Ortho']);
  });
});

describe('applyClientMasterCascade', () => {
  const programs = [
    { programName: 'Screening', campNames: ['BMD'], isActive: true },
  ];

  it('auto-selects a single division and method', () => {
    expect(applyClientMasterCascade({ programs })).toEqual({
      programs,
      divisions: ['Screening'],
      campaignType: 'Screening',
      campaignName: 'BMD',
    });
  });

  it('auto-selects method when division is already chosen', () => {
    expect(applyClientMasterCascade({
      programs,
      currentDivision: 'Screening',
    })).toMatchObject({
      campaignType: 'Screening',
      campaignName: 'BMD',
    });
  });

  it('keeps valid existing values on edit', () => {
    expect(applyClientMasterCascade({
      programs,
      currentDivision: 'Screening',
      currentMethod: 'BMD',
    })).toMatchObject({
      campaignType: 'Screening',
      campaignName: 'BMD',
    });
  });

  it('clears invalid values then auto-selects when only one option exists', () => {
    expect(applyClientMasterCascade({
      programs,
      currentDivision: 'Other Division',
      currentMethod: 'Other Method',
    })).toMatchObject({
      campaignType: 'Screening',
      campaignName: 'BMD',
    });
  });
});

describe('pickSingleOption', () => {
  it('returns the only option', () => {
    expect(pickSingleOption(['BMD'])).toBe('BMD');
    expect(pickSingleOption(['A', 'B'])).toBe('');
  });
});

describe('resolveClientMasterHealthcareWorker', () => {
  const records = [
    {
      programName: 'Ortho',
      campName: 'BMD',
      healthcareWorker: 'Technician',
      isActive: true,
    },
    {
      programName: 'Cardio',
      campName: 'Screening',
      healthcareWorker: 'Phlebotomist',
      isActive: true,
    },
    {
      programName: 'NT-proBNP - Coronus',
      campName: 'Diagnostics',
      healthcareWorker: 'Phlebotomist',
      campType: 'HCW',
      isActive: true,
    },
  ];

  it('resolves the exact client master role for division and method', () => {
    expect(resolveClientMasterHealthcareWorker(records, {
      campaignType: 'Ortho',
      campaignName: 'BMD',
    })).toBe('Technician');
  });

  it('falls back to division role when method is missing', () => {
    expect(resolveClientMasterHealthcareWorker(records, {
      campaignType: 'Cardio',
      campaignName: '',
    })).toBe('Phlebotomist');
  });

  it('matches division and method with loose normalization', () => {
    expect(resolveClientMasterHealthcareWorker(records, {
      campaignType: 'NT-proBNP — Coronus',
      campaignName: 'diagnostics',
    })).toBe('Phlebotomist');
  });

  it('falls back to method-only match when division differs', () => {
    expect(resolveClientMasterHealthcareWorker(records, {
      campaignType: 'Unknown Division',
      campaignName: 'Diagnostics',
    })).toBe('Phlebotomist');
  });

  it('reads division from drugTherapyName when programName is empty', () => {
    expect(resolveClientMasterHealthcareWorker([
      {
        drugTherapyName: 'Cardio',
        campName: 'Screening',
        healthcareWorker: 'Phlebotomist',
        isActive: true,
      },
    ], {
      campaignType: 'Cardio',
      campaignName: 'Screening',
    })).toBe('Phlebotomist');
  });

  it('returns multiple healthcare worker roles from Client Master', () => {
    expect(resolveClientMasterHealthcareWorkers([
      {
        programName: 'Ortho',
        campName: 'BMD',
        healthcareWorker: ['Technician', 'Phlebotomist'],
        isActive: true,
      },
    ], {
      campaignType: 'Ortho',
      campaignName: 'BMD',
    })).toEqual(['Technician', 'Phlebotomist']);
  });

  it('normalizes legacy comma-separated healthcare worker strings', () => {
    expect(resolveClientMasterHealthcareWorkers([
      {
        programName: 'Ortho',
        campName: 'BMD',
        healthcareWorker: 'Technician, Phlebotomist',
        isActive: true,
      },
    ], {
      campaignType: 'Ortho',
      campaignName: 'BMD',
    })).toEqual(['Technician', 'Phlebotomist']);
  });
});
