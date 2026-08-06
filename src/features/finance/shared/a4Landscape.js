/** A4 page specs — landscape (default commercial docs) and portrait (Purchase Order). */
export const MM_TO_PX = 96 / 25.4;

export const A4_LANDSCAPE = {
  widthMm: 297,
  heightMm: 210,
  /** Normal-to-narrow margin for printer-safe area (7–10 mm range). */
  marginMm: 9,
};

export const A4_PORTRAIT = {
  widthMm: 210,
  heightMm: 297,
  marginMm: 9,
};

export const A4_CONTENT = {
  widthMm: A4_LANDSCAPE.widthMm - A4_LANDSCAPE.marginMm * 2,
  heightMm: A4_LANDSCAPE.heightMm - A4_LANDSCAPE.marginMm * 2,
};

export const A4_LANDSCAPE_PX = {
  w: Math.round(A4_LANDSCAPE.widthMm * MM_TO_PX),
  h: Math.round(A4_LANDSCAPE.heightMm * MM_TO_PX),
  margin: Math.round(A4_LANDSCAPE.marginMm * MM_TO_PX),
  contentW: Math.round(A4_CONTENT.widthMm * MM_TO_PX),
  contentH: Math.round(A4_CONTENT.heightMm * MM_TO_PX),
};

export const A4_PORTRAIT_PX = {
  w: Math.round(A4_PORTRAIT.widthMm * MM_TO_PX),
  h: Math.round(A4_PORTRAIT.heightMm * MM_TO_PX),
  margin: Math.round(A4_PORTRAIT.marginMm * MM_TO_PX),
  contentW: Math.round((A4_PORTRAIT.widthMm - A4_PORTRAIT.marginMm * 2) * MM_TO_PX),
  contentH: Math.round((A4_PORTRAIT.heightMm - A4_PORTRAIT.marginMm * 2) * MM_TO_PX),
};

export function pageSpec(orientation = 'landscape') {
  if (orientation === 'portrait') {
    return { mm: A4_PORTRAIT, px: A4_PORTRAIT_PX, orientation: 'portrait' };
  }
  return { mm: A4_LANDSCAPE, px: A4_LANDSCAPE_PX, orientation: 'landscape' };
}
