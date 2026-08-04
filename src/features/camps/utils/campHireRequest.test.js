import { describe, expect, it } from 'vitest';
import {
  buildCampHireRequestPath,
  formatLinkedCampSummary,
  mapCampToHiringPrefill,
} from './campHireRequest.js';

describe('campHireRequest', () => {
  const camp = {
    _id: 'camp-1',
    campId: 'CAMP-1001',
    clientName: 'demo pharma',
    doctorName: 'dr. balkrishna patil',
    campaignName: 'BMD',
    campaignType: 'Ortho',
    campType: 'HCW + Device (Light Device)',
    campDate: '2026-08-10',
    startTime: '09:00',
    city: 'virar',
    state: 'maharashtra',
    district: 'palghar',
    campAddress: 'guru krupa clinic',
    pincode: '401303',
  };

  const clientMaster = {
    programName: 'Ortho',
    campName: 'BMD',
    campType: 'HCW + Device (Light Device)',
    healthcareWorker: ['Technician', 'Phlebotomist'],
  };

  it('builds a Request One Hiring Request path with camp record id', () => {
    const path = buildCampHireRequestPath(camp, {
      professions: ['Technician', 'Phlebotomist'],
    });
    expect(path.startsWith('/request-one?')).toBe(true);
    expect(path).toContain('type=HIRING');
    expect(path).toContain('campRecordId=camp-1');
    expect(path).toContain('campId=CAMP-1001');
  });

  it('prefills hiring fields from camp + client master and leaves excluded fields blank', () => {
    const prefill = mapCampToHiringPrefill(camp, clientMaster);
    expect(prefill.requestType).toBe('HIRING');
    expect(prefill.hiringMethod).toBe('BMD');
    expect(prefill.hcwType).toBe('Technician');
    expect(prefill.campType).toBe('Light Device (1-5 KG)');
    expect(prefill.hiringState).toBe('Maharashtra');
    expect(prefill.hiringCity).toBe('Virar');
    expect(prefill.hiringAddress).toBe('Guru Krupa Clinic');
    expect(prefill.hiringType).toBe('');
    expect(prefill.budgetMin).toBe('');
    expect(prefill.budgetMax).toBe('');
    expect(prefill.reason).toBe('');
  });

  it('maps Service Model to Hiring Camp type', () => {
    expect(mapCampToHiringPrefill({}, { campType: 'HCW Only' }).campType).toBe('No Device');
    expect(mapCampToHiringPrefill({}, { campType: 'Rented' }).campType).toBe('No Device');
    expect(
      mapCampToHiringPrefill({}, { campType: 'HCW + Device (Light Device)' }).campType,
    ).toBe('Light Device (1-5 KG)');
    expect(
      mapCampToHiringPrefill({}, { campType: 'HCW + Device (Heavy Device)' }).campType,
    ).toBe('Heavy Device (5-12 KG)');
  });

  it('formats a linked camp summary for the hyperlink label', () => {
    expect(formatLinkedCampSummary(camp)).toContain('CAMP-1001');
    expect(formatLinkedCampSummary(camp)).toContain('Balkrishna Patil');
    expect(formatLinkedCampSummary(camp)).toContain('10-08-2026');
  });
});
