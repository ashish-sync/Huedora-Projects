/**
 * Contact Directory KYC attachments: PAN Card Copy + Bank Account Proof.
 * Accept PDF and common image formats.
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

export const CONTACT_KYC_ACCEPT_ATTR = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/tiff',
  '.pdf',
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.bmp',
  '.tif',
  '.tiff',
].join(',');

export const CONTACT_KYC_MAX_BYTES = 10 * 1024 * 1024;

export const CONTACT_KYC_HINT = 'PDF or image (JPG, JPEG, PNG, WEBP, GIF, BMP, TIFF) · max 10 MB';
