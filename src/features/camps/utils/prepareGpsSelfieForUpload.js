/**
 * Shrink GPS selfie in the browser before upload so Render free-tier
 * does not need a heavy Sharp convert under memory pressure.
 * Falls back to the original File on any failure.
 */

const GPS_LONG_EDGE = 1280;
const GPS_JPEG_QUALITY = 0.82;

function loadImageElement(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to decode image for resize'));
    };
    img.src = url;
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

/**
 * @param {File} file
 * @returns {Promise<File>}
 */
export async function prepareGpsSelfieForUpload(file) {
  if (!file || typeof document === 'undefined') return file;
  const type = String(file.type || '').toLowerCase();
  if (!type.startsWith('image/')) return file;
  // Already-small WebP: leave as-is (server passthrough).
  if (type === 'image/webp' && file.size <= 800 * 1024) return file;

  try {
    const img = await loadImageElement(file);
    const maxDim = Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height);
    const scale = maxDim > GPS_LONG_EDGE ? GPS_LONG_EDGE / maxDim : 1;
    const width = Math.max(1, Math.round((img.naturalWidth || img.width) * scale));
    const height = Math.max(1, Math.round((img.naturalHeight || img.height) * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, width, height);

    let blob = await canvasToBlob(canvas, 'image/webp', GPS_JPEG_QUALITY);
    if (!blob || blob.size <= 0) {
      blob = await canvasToBlob(canvas, 'image/jpeg', GPS_JPEG_QUALITY);
    }
    if (!blob || blob.size <= 0) return file;
    // Keep original if compression did not help (or grew).
    if (blob.size >= file.size && maxDim <= GPS_LONG_EDGE) return file;

    const ext = blob.type === 'image/webp' ? '.webp' : '.jpg';
    const base = String(file.name || 'gps-selfie').replace(/\.[^.]+$/, '');
    return new File([blob], `${base}${ext}`, {
      type: blob.type,
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}
