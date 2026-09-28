import { describe, expect, it } from 'vitest';
import {
  agreementTitleToFileBase,
  buildAgreementDocumentTitle,
  formatNomenclatureDate,
} from './documentFileName.js';

describe('buildAgreementDocumentTitle', () => {
  it('builds HCW-Document Details-Date nomenclature', () => {
    expect(
      buildAgreementDocumentTitle({
        partyName: 'Ashish',
        documentDetails: 'Service Agreement',
        dateValue: '2026-09-27',
      })
    ).toBe('Ashish-Service Agreement-27/09/2026');
  });

  it('trims parts and falls back when blank', () => {
    expect(
      buildAgreementDocumentTitle({
        partyName: '  Ashish PP  ',
        documentDetails: '',
        dateValue: '2026-09-27',
      })
    ).toBe('Ashish PP-Agreement-27/09/2026');
  });
});

describe('formatNomenclatureDate', () => {
  it('formats ISO dates as DD/MM/YYYY', () => {
    expect(formatNomenclatureDate('2026-09-27')).toBe('27/09/2026');
  });
});

describe('agreementTitleToFileBase', () => {
  it('replaces path-unsafe characters', () => {
    expect(agreementTitleToFileBase('Ashish-Service Agreement-27/09/2026')).toBe(
      'Ashish-Service Agreement-27-09-2026'
    );
    expect(agreementTitleToFileBase('Ashish PP-TCPL - Service Agreement & NDA-27/09/2026')).toBe(
      'Ashish PP-TCPL - Service Agreement - NDA-27-09-2026'
    );
  });
});
