import { describe, expect, it } from 'vitest';
import {
  CLICK_TO_SIGN_MODE,
  applyClickToSign,
  clearClickToSign,
  formatDigitallySignedOn,
  isClickToSignSignature,
  normalizeSignatoryDisplayName,
  resolveClickToSignName,
} from './clickToSign.js';

describe('clickToSign', () => {
  it('normalizes signatory name to uppercase', () => {
    expect(normalizeSignatoryDisplayName('  Bikram  Binay Srivastava ')).toBe(
      'BIKRAM BINAY SRIVASTAVA'
    );
  });

  it('formats digitally signed stamp with seconds', () => {
    const stamp = formatDigitallySignedOn('2026-10-01T17:55:11');
    expect(stamp).toMatch(/^Digitally signed on \d{2}-\d{2}-2026 \d{2}:\d{2}:\d{2}$/);
  });

  it('applies click-to-sign and clears image', () => {
    const next = applyClickToSign(
      { imageDataUrl: 'data:image/png;base64,abc', signatoryName: 'Old', companyLabel: 'Acme' },
      { fullName: 'Bikram Binay Srivastava', signedAt: '2026-10-01T12:25:11.000Z' }
    );
    expect(next.mode).toBe(CLICK_TO_SIGN_MODE);
    expect(next.signatoryName).toBe('BIKRAM BINAY SRIVASTAVA');
    expect(next.signedAt).toBe('2026-10-01T12:25:11.000Z');
    expect(next.imageDataUrl).toBe('');
    expect(next.companyLabel).toBe('Acme');
    expect(isClickToSignSignature(next)).toBe(true);
  });

  it('resolves name from Organisation Master signatory, not the user', () => {
    expect(
      resolveClickToSignName({
        user: { fullName: 'Ashish Singh', email: 'a@x.com' },
        signature: { signatoryName: 'Bikram Binay Srivastava' },
      })
    ).toBe('BIKRAM BINAY SRIVASTAVA');
  });

  it('falls back to orgMaster.signatoryName when form signature is blank', () => {
    expect(
      resolveClickToSignName({
        signature: { signatoryName: '' },
        orgMaster: { signatoryName: 'Org Signatory' },
      })
    ).toBe('ORG SIGNATORY');
  });

  it('does not use the logged-in user when org signatory is missing', () => {
    expect(
      resolveClickToSignName({
        user: { fullName: 'Ashish Singh' },
        signature: {},
        orgMaster: {},
      })
    ).toBe('');
  });

  it('clears click-to-sign mode and image so the box can render blank', () => {
    const cleared = clearClickToSign({
      mode: CLICK_TO_SIGN_MODE,
      signedAt: '2026-10-01T12:00:00.000Z',
      signatoryName: 'TEST',
      imageDataUrl: 'data:image/png;base64,abc',
    });
    expect(cleared.mode).toBe('');
    expect(cleared.signedAt).toBe('');
    expect(cleared.imageDataUrl).toBe('');
    expect(cleared.signatoryName).toBe('TEST');
    expect(isClickToSignSignature(cleared)).toBe(false);
  });
});
