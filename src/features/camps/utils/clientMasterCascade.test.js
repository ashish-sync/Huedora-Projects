import { describe, expect, it } from 'vitest';
import {
  applyClientMasterCascade,
  assignedUserEmailsForProgramScope,
  clientsForOpsBoardScope,
  diagnoseClientMasterHcwGap,
  divisionsForOpsBoardMethod,
  parseClientMasterDivisions,
  parseOpsBoardFilterCatalog,
  pickSingleOption,
  resolveCampClientId,
  resolveClientMasterAssignedUserEmails,
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

  it('keeps assigned users from Client Master for the operations board filter', () => {
    const parsed = parseClientMasterDivisions({
      data: [{
        programName: 'Oncology',
        campNames: ['BMD', 'Dietician'],
        assignedUserEmails: ['ops@tylo.test', 'lead@tylo.test'],
        assignedUsersByCamp: {
          BMD: ['ops@tylo.test'],
          Dietician: ['lead@tylo.test'],
        },
        isActive: true,
      }],
      assignedUsers: [{ email: 'ops@tylo.test', name: 'Ops User' }],
    });
    expect(parsed.assignedUsers).toEqual([{ email: 'ops@tylo.test', name: 'Ops User' }]);
    expect(assignedUserEmailsForProgramScope(parsed.programs)).toEqual([
      'ops@tylo.test',
      'lead@tylo.test',
    ]);
    expect(assignedUserEmailsForProgramScope(parsed.programs, {
      campaignType: 'Oncology',
      campaign: 'BMD',
    })).toEqual(['ops@tylo.test']);
  });
});

describe('ops board filter catalog', () => {
  const catalog = parseOpsBoardFilterCatalog({
    methods: ['BMD', 'Dietician'],
    divisionsByMethod: { BMD: ['Oncology'], Dietician: ['Cardio'] },
    clientsByMethod: {
      BMD: [{ _id: 'client-1', name: 'Acme' }],
      Dietician: [{ _id: 'client-2', name: 'Beta' }],
    },
    clientsByMethodDivision: {
      BMD: { Oncology: [{ _id: 'client-1', name: 'Acme' }] },
    },
    assignedUsers: [{ email: 'ops@tylo.test', name: 'Ops User' }],
  });

  it('lists divisions under the selected method', () => {
    expect(divisionsForOpsBoardMethod(catalog, 'BMD')).toEqual(['Oncology']);
    expect(divisionsForOpsBoardMethod(catalog, '')).toEqual([]);
  });

  it('lists clients for method, then method + division', () => {
    expect(clientsForOpsBoardScope(catalog, { campaign: 'BMD' })).toEqual([
      { _id: 'client-1', name: 'Acme' },
    ]);
    expect(clientsForOpsBoardScope(catalog, { campaign: 'BMD', campaignType: 'Oncology' })).toEqual([
      { _id: 'client-1', name: 'Acme' },
    ]);
    expect(clientsForOpsBoardScope(catalog, { campaign: '' })).toEqual([]);
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

  it('resolves camp client id from clientId before populated client object', () => {
    expect(resolveCampClientId({
      clientId: 'abc123',
      client: { name: 'Acme' },
    })).toBe('abc123');
    expect(resolveCampClientId({
      client: { _id: 'nested-id', name: 'Acme' },
    })).toBe('nested-id');
    expect(resolveCampClientId({
      client: { name: 'Acme' },
    })).toBe('');
  });

  it('unions roles across multi-GSTIN rows for the same division and method', () => {
    expect(resolveClientMasterHealthcareWorkers([
      {
        programName: 'Ortho',
        campName: 'BMD',
        billingGstin: 'GSTIN-A',
        healthcareWorker: ['Technician'],
        isActive: true,
      },
      {
        programName: 'Ortho',
        campName: 'BMD',
        billingGstin: 'GSTIN-B',
        healthcareWorker: ['Phlebotomist'],
        isActive: true,
      },
    ], {
      campaignType: 'Ortho',
      campaignName: 'BMD',
    })).toEqual(['Technician', 'Phlebotomist']);
  });

  it('diagnoses missing Client Master healthcare worker roles', () => {
    expect(diagnoseClientMasterHcwGap([
      { programName: 'Ortho', campName: 'BMD', healthcareWorker: '', isActive: true },
    ], { campaignType: 'Ortho', campaignName: 'BMD' })).toBe('missing_hcw_roles');
  });

  it('unions assigned login emails for the same client + division + method', () => {
    expect(resolveClientMasterAssignedUserEmails([
      {
        programName: 'Ortho',
        campName: 'BMD',
        assignedUserEmails: ['ops@client.com'],
        isActive: true,
      },
      {
        programName: 'Ortho',
        campName: 'BMD',
        assignedUserEmails: 'ops@client.com, user@client.in',
        isActive: true,
      },
    ], {
      programName: 'Ortho',
      campName: 'BMD',
    })).toEqual(['ops@client.com', 'user@client.in']);
  });

  it('returns empty assigned emails when division or method is missing', () => {
    expect(resolveClientMasterAssignedUserEmails([
      {
        programName: 'Ortho',
        campName: 'BMD',
        assignedUserEmails: ['ops@client.com'],
        isActive: true,
      },
    ], {
      programName: '',
      campName: 'BMD',
    })).toEqual([]);
  });
});
