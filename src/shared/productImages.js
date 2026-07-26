import { api } from './api.js';
import { apiUrl } from './config.js';

/** Resolved URL for a stored product image reference. */
export function productImageUrl(ref) {
  if (!ref?.url) return '';
  return apiUrl(ref.url);
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
  const fd = new FormData();
  fd.append('slot', 'images');
  for (const file of picked) fd.append('images', file);
  const res = await api(`/logistics/products/${productId}/files`, { method: 'POST', body: fd });
  return res.data;
}

export async function removeProductImage(productId, filename) {
  if (!filename) throw new Error('Image reference is missing');
  const res = await api(`/logistics/products/${productId}/files`, {
    method: 'DELETE',
    body: { filename },
  });
  return res.data;
}
