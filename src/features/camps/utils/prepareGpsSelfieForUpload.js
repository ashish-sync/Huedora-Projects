/**
 * Shrink GPS selfie in the browser before upload so Render free-tier
 * does not need a heavy Sharp convert under memory pressure.
 * Optionally burns camp ID / lat-lng / date watermark onto the image.
 * Falls back to the original File on any failure (unless watermark is required).
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

function formatCoord(value, digits = 6) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toFixed(digits);
}

function formatWatermarkDate(value) {
  const d = value instanceof Date ? value : new Date(value || Date.now());
  if (Number.isNaN(d.getTime())) return String(value || '');
  try {
    return new Intl.DateTimeFormat(undefined, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(d);
  } catch {
    return d.toISOString();
  }
}

/**
 * Build watermark lines for GPS selfie.
 * @param {{ campId?: string, latitude?: number|string, longitude?: number|string, capturedAt?: Date|string|number }} meta
 * @returns {string[]}
 */
export function buildGpsSelfieWatermarkLines(meta = {}) {
  const campId = String(meta.campId || '').trim() || 'Camp ID unavailable';
  const lat = formatCoord(meta.latitude);
  const lng = formatCoord(meta.longitude);
  const when = formatWatermarkDate(meta.capturedAt || Date.now());
  return [
    `Camp: ${campId}`,
    `Lat: ${lat}  Lng: ${lng}`,
    when,
  ];
}

/**
 * Draw a bottom overlay with camp / GPS / date lines.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} width
 * @param {number} height
 * @param {string[]} lines
 */
export function drawGpsSelfieWatermark(ctx, width, height, lines) {
  const safeLines = (Array.isArray(lines) ? lines : []).map((l) => String(l || '').trim()).filter(Boolean);
  if (!safeLines.length || !ctx || !width || !height) return;

  const padX = Math.max(10, Math.round(width * 0.03));
  const padY = Math.max(8, Math.round(height * 0.02));
  const fontSize = Math.max(14, Math.min(28, Math.round(width * 0.032)));
  const lineHeight = Math.round(fontSize * 1.28);
  const barHeight = padY * 2 + lineHeight * safeLines.length;

  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.58)';
  ctx.fillRect(0, height - barHeight, width, barHeight);

  ctx.font = `600 ${fontSize}px "Plus Jakarta Sans", Inter, system-ui, sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'top';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
  ctx.shadowBlur = 2;
  ctx.shadowOffsetY = 1;

  let y = height - barHeight + padY;
  for (const line of safeLines) {
    ctx.fillText(line, padX, y, width - padX * 2);
    y += lineHeight;
  }
  ctx.restore();
}

/**
 * @param {File} file
 * @param {{ watermark?: { campId?: string, latitude?: number|string, longitude?: number|string, capturedAt?: Date|string|number } }} [options]
 * @returns {Promise<File>}
 */
export async function prepareGpsSelfieForUpload(file, options = {}) {
  if (!file || typeof document === 'undefined') return file;
  const type = String(file.type || '').toLowerCase();
  if (!type.startsWith('image/')) return file;

  const watermarkLines = options.watermark
    ? buildGpsSelfieWatermarkLines(options.watermark)
    : [];
  const needsWatermark = watermarkLines.length > 0;

  // Already-small WebP with no watermark: leave as-is (server passthrough).
  if (!needsWatermark && type === 'image/webp' && file.size <= 800 * 1024) return file;

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
    if (needsWatermark) {
      drawGpsSelfieWatermark(ctx, width, height, watermarkLines);
    }

    let blob = await canvasToBlob(canvas, 'image/webp', GPS_JPEG_QUALITY);
    if (!blob || blob.size <= 0) {
      blob = await canvasToBlob(canvas, 'image/jpeg', GPS_JPEG_QUALITY);
    }
    if (!blob || blob.size <= 0) return file;

    // Without watermark, keep original if compression did not help.
    if (!needsWatermark && blob.size >= file.size && maxDim <= GPS_LONG_EDGE) return file;

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
