import { describe, expect, it } from 'vitest';
import {
  agreementTitleToFileBase,
  buildAgreementDocumentFileBase,
  buildAgreementDocumentTitle,
  displayAgreementDocumentName,
  formatNomenclatureDate,
  primaryPartyName,
  shortenDocumentDetails,
} from './documentFileName.js';

describe('buildAgreementDocumentTitle', () => {
  it('stores document type only (no party or date)', () => {
    expect(
      buildAgreementDocumentTitle({
        partyName: 'Ashish',
        documentDetails: 'Service Agreement',
        dateValue: '2026-09-27',
      })
    ).toBe('Service Agreement');
  });

  it('strips org prefixes and keeps ampersands', () => {
    expect(
      buildAgreementDocumentTitle({
        partyName: 'Manoj Kumar Rastogi & Charu Rastogi',
        documentDetails: 'Tylo Care - Service Agreement & NDA',
        dateValue: '2026-11-23',
      })
    ).toBe('Service Agreement & NDA');
  });

  it('falls back when blank', () => {
    expect(
      buildAgreementDocumentTitle({
        partyName: 'Ashish',
        documentDetails: '',
        dateValue: '2026-09-27',
      })
    ).toBe('Agreement');
  });
});

describe('buildAgreementDocumentFileBase', () => {
  it('keeps party + details + date for downloads', () => {
    expect(
      buildAgreementDocumentFileBase({
        partyName: 'Manoj Kumar Rastogi & Charu Rastogi',
        documentDetails: 'Tylo Care - Service Agreement & NDA',
        dateValue: '2026-11-23',
      })
    ).toBe('Manoj Kumar Rastogi-Service Agreement & NDA-23-11-2026');
  });
});

describe('displayAgreementDocumentName', () => {
  it('strips party, org prefix, and trailing date from legacy titles', () => {
    expect(
      displayAgreementDocumentName(
        'Tapas Sarkar-Tylo Care - Service Agreement & NDA-23-11-2026'
      )
    ).toBe('Service Agreement & NDA');
    expect(
      displayAgreementDocumentName(
        'Manoj Kumar Rastogi & Charu Rastogi-Tylo Care - Service Agreement & NDA-23-11-2026'
      )
    ).toBe('Service Agreement & NDA');
    expect(
      displayAgreementDocumentName('Rakesh Chidanand Kadam-Service Agreement File-20-11-2026')
    ).toBe('Service Agreement File');
  });

  it('passes through already-clean titles', () => {
    expect(displayAgreementDocumentName('Service Agreement & NDA')).toBe(
      'Service Agreement & NDA'
    );
  });
});

describe('primaryPartyName / shortenDocumentDetails', () => {
  it('keeps the first party only', () => {
    expect(primaryPartyName('Manoj Kumar Rastogi & Charu Rastogi')).toBe('Manoj Kumar Rastogi');
    expect(primaryPartyName('A and B')).toBe('A');
  });

  it('strips Tylo Care prefixes from template names', () => {
    expect(shortenDocumentDetails('Tylo Care - Service Agreement & NDA')).toBe(
      'Service Agreement & NDA'
    );
  });
});

describe('formatNomenclatureDate', () => {
  it('formats ISO dates as DD-MM-YYYY', () => {
    expect(formatNomenclatureDate('2026-09-27')).toBe('27-09-2026');
  });
});

describe('agreementTitleToFileBase', () => {
  it('replaces path-unsafe characters', () => {
    expect(agreementTitleToFileBase('Ashish-Service Agreement-27/09/2026')).toBe(
      'Ashish-Service Agreement-27-09-2026'
    );
  });
});
