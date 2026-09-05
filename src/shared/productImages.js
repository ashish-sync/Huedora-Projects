import { api } from './api.js';
import { apiUrl } from './config.js';
import { isDirectUploadPath, resolveUploadViewUrl } from './uploadViewUrl.js';

/** Resolved URL for a stored product image reference (sync; expects signed URL from API). */
export function productImageUrl(ref) {
  if (!ref?.url) return '';
  return apiUrl(ref.url);
}

/** Prefer async resolve when a raw /uploads path might still be present. */
export async function productImageViewUrl(ref) {
  if (!ref?.url) return '';
  if (isDirectUploadPath(ref.url)) return resolveUploadViewUrl(ref.url);
  return apiUrl(ref.url);
}

/**
 * Filename used by DELETE /logistics/products/:id/files.
 * Prefer the stored filename; fall back to the last /uploads/... path segment.
 */
export function resolveProductImageFilename(ref) {
  const direct = String(ref?.filename || '').trim();
  if (direct) return direct;
  const url = String(ref?.url || '').trim();
  if (!url) return '';
  const uploadsMatch = url.match(/\/uploads\/[^?#]*\/([^/?#]+)(?:[?#]|$)/i);
  if (uploadsMatch?.[1]) {
    try {
      return decodeURIComponent(uploadsMatch[1]);
    } catch {
      return uploadsMatch[1];
    }
  }
  return '';
}

/** Primary image + gallery images, de-duplicated by URL. */
export function collectProductImages(product) {
  if (!product) return [];
  const seen = new Set();
  const list = [];
  const add = (ref) => {
    if (!ref?.url || seen.has(ref.url)) return;
    seen.add(ref.url);
    list.push(ref);
  };
  add(product.image);
  for (const img of product.documents?.images || []) add(img);
  return list;
}

export function isImageFile(file) {
  return Boolean(file?.type && String(file.type).startsWith('image/'));
}

export async function uploadProductImages(productId, files) {
  const picked = [...files].filter(isImageFile);
  if (!picked.length) throw new Error('Select one or more image files');
  if (!productId) throw new Error('Save the product first, then add images');
  const fd = new FormData();
  fd.append('slot', 'images');
  for (const file of picked) fd.append('images', file);
  const res = await api(`/logistics/products/${productId}/files`, { method: 'POST', body: fd });
  return res.data;
}

export async function removeProductImage(productId, filenameOrRef) {
  if (!productId) throw new Error('Save the product first, then manage images');
  const filename = typeof filenameOrRef === 'string'
    ? String(filenameOrRef || '').trim()
    : resolveProductImageFilename(filenameOrRef);
  if (!filename) throw new Error('Image reference is missing — reload the product and try again');
  const res = await api(`/logistics/products/${productId}/files`, {
    method: 'DELETE',
    body: { filename },
  });
  return res.data;
}
