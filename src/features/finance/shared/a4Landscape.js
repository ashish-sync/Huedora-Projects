/** A4 landscape page spec — 297 × 210 mm with 8 mm printable margins. */
export const MM_TO_PX = 96 / 25.4;

export const A4_LANDSCAPE = {
  widthMm: 297,
  heightMm: 210,
  /** Normal-to-narrow margin for printer-safe area (7–10 mm range). */
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
