/** Helpers for asset ↔ Document One agreement files */

const SIGNED_AGREEMENT_STATUSES = new Set(['Agreement Signed', 'Active']);

const SIGNED_ENVELOPE_STATUSES = new Set(['COMPLETED', 'ACTIVE']);

export function isAssetAgreementSigned(assetRow) {
  return SIGNED_AGREEMENT_STATUSES.has(String(assetRow?.agreementStatus || '').trim());
}

/**
 * Pick the best signed agreement file for an asset (active link first, then primary doc).
 * @returns {{ agreement: object, document: object } | null}
 */
export function pickSignedAgreementRecord(agreements, assetRow) {
  let best = null;
  let bestScore = -1;

  for (const ag of agreements || []) {
    const files = (ag.documents || []).filter((d) => d.hasFile);
    if (!files.length) continue;

    const document = files.find((d) => d.isPrimary) || files[0];
    const envelopeSigned = SIGNED_ENVELOPE_STATUSES.has(String(ag.status || '').toUpperCase());
    const uploadedSigned = ag.documentSource === 'UPLOAD';
    const assetSigned = isAssetAgreementSigned(assetRow);

    if (!envelopeSigned && !uploadedSigned && !assetSigned) continue;

    let score = 0;
    if (ag.isActiveLink) score += 100;
    if (document.isPrimary) score += 20;
    if (envelopeSigned || uploadedSigned) score += 10;
    if (assetSigned) score += 5;

    if (score > bestScore) {
      bestScore = score;
      best = { agreement: ag, document };
    }
  }

  return best;
}

export function hasSignedAgreementCopy(agreements, assetRow) {
  return Boolean(pickSignedAgreementRecord(agreements, assetRow));
}
