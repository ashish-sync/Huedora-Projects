import { describe, expect, it } from 'vitest';
import {
  agreementTitleToFileBase,
  buildAgreementDocumentTitle,
  formatNomenclatureDate,
  primaryPartyName,
  shortenDocumentDetails,
} from './documentFileName.js';

describe('buildAgreementDocumentTitle', () => {
  it('builds HCW-Document Details-Date nomenclature', () => {
    expect(
      buildAgreementDocumentTitle({
        partyName: 'Ashish',
        documentDetails: 'Service Agreement',
        dateValue: '2026-09-27',
      })
    ).toBe('Ashish-Service Agreement-27-09-2026');
  });

  it('trims parts and falls back when blank', () => {
    expect(
      buildAgreementDocumentTitle({
        partyName: '  Ashish PP  ',
        documentDetails: '',
        dateValue: '2026-09-27',
      })
    ).toBe('Ashish PP-Agreement-27-09-2026');
  });

  it('shortens multi-party names and org-prefixed template titles', () => {
    expect(
      buildAgreementDocumentTitle({
        partyName: 'Manoj Kumar Rastogi & Charu Rastogi',
        documentDetails: 'Tylo Care - Service Agreement & NDA',
        dateValue: '2026-11-23',
      })
    ).toBe('Manoj Kumar Rastogi-Service Agreement NDA-23-11-2026');
  });
});

describe('primaryPartyName / shortenDocumentDetails', () => {
  it('keeps the first party only', () => {
    expect(primaryPartyName('Manoj Kumar Rastogi & Charu Rastogi')).toBe('Manoj Kumar Rastogi');
    expect(primaryPartyName('A and B')).toBe('A');
  });

  it('strips Tylo Care prefixes from template names', () => {
    expect(shortenDocumentDetails('Tylo Care - Service Agreement & NDA')).toBe(
      'Service Agreement NDA'
    );
  });
});

describe('formatNomenclatureDate', () => {
  it('formats ISO dates as DD-MM-YYYY', () => {
    expect(formatNomenclatureDate('2026-09-27')).toBe('27-09-2026');
  });
});

describe('agreementTitleToFileBase', () => {
  it('replaces path-unsafe characters without exploding ampersands into dashes', () => {
    expect(agreementTitleToFileBase('Ashish-Service Agreement-27/09/2026')).toBe(
      'Ashish-Service Agreement-27-09-2026'
    );
    expect(agreementTitleToFileBase('Ashish PP-TCPL - Service Agreement & NDA-27/09/2026')).toBe(
      'Ashish PP-TCPL - Service Agreement NDA-27-09-2026'
    );
  });
});
