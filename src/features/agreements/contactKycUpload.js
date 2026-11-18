/**
 * Contact Directory attachments: Aadhaar, PAN, Passbook/Cheque,
 * Educational Certificate, and Resume. Accept PDF and common images.
 */

export const CONTACT_KYC_ACCEPT_EXTENSIONS = [
  '.pdf',
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.bmp',
  '.tif',
  '.tiff',
];

/** Prefer broad wildcards so Windows file dialogs reliably list images + PDFs. */
export const CONTACT_KYC_ACCEPT_ATTR = 'image/*,application/pdf,.pdf,.jpg,.jpeg,.png,.webp,.gif,.bmp,.tif,.tiff';

export const CONTACT_KYC_MAX_BYTES = 10 * 1024 * 1024;

export const CONTACT_KYC_HINT = 'PDF or image (JPG, JPEG, PNG, WEBP, GIF, BMP, TIFF) · max 10 MB';
