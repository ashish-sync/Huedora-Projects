import { describe, expect, it } from 'vitest';
import {
  cleanSpaces,
  formatDoctorName,
  formatDoctorNameLive,
  formatTextValue,
  getDoctorNameFormatError,
  toProperTitleCase,
} from './textFormat.js';

describe('textFormat', () => {
  it('cleans extra whitespace', () => {
    expect(cleanSpaces('  hello   world  ')).toBe('hello world');
  });

  it('title-cases names', () => {
    expect(toProperTitleCase('demo pharma ltd')).toBe('Demo Pharma Ltd');
    expect(formatTextValue('  ravi kumar  ', 'doctorName')).toBe('Ravi Kumar');
    expect(formatTextValue('  guru krupa clinic  ', 'campAddress')).toBe('Guru Krupa Clinic');
    expect(formatTextValue('  mahesh  ', 'hcwName')).toBe('Mahesh');
  });

  it('strips Dr/Dr. and title-cases doctor names', () => {
    expect(formatDoctorName('  dr. rajesh   kumar  ')).toBe('Rajesh Kumar');
    expect(formatDoctorName('Doctor Anita Desai')).toBe('Anita Desai');
    expect(formatDoctorName('DR RAJESH KUMAR')).toBe('Rajesh Kumar');
    expect(formatDoctorName('Dr.Rajesh Kumar')).toBe('Rajesh Kumar');
    expect(formatDoctorName('Drake Smith')).toBe('Drake Smith');
    expect(formatDoctorNameLive('dr. rajesh ')).toBe('Rajesh ');
    expect(getDoctorNameFormatError('Dr. Rajesh Kumar')).toBeNull();
  });

  it('preserves codes and picklists', () => {
    expect(formatTextValue('  sn-1001  ', 'serialNumber')).toBe('SN-1001');
    expect(formatTextValue('  not initiated  ', 'agreementStatus')).toBe('not initiated');
  });

  it('keeps extra billing address lines', () => {
    expect(formatTextValue('Pune HQ\n3rd Floor, Extra Landmark', 'billingAddress')).toBe(
      'Pune HQ\n3rd Floor, Extra Landmark',
    );
  });
});
