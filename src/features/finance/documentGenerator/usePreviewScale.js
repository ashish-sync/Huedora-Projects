import { useCallback, useRef, useState } from 'react';
import { A4_LANDSCAPE_PX } from '../shared/a4Landscape.js';

export const DEFAULT_PREVIEW_SCALE = 0.8;
const MIN_SCALE = 0.5;
const MAX_SCALE = 1.05;

export function usePreviewScale({ defaultScale = DEFAULT_PREVIEW_SCALE } = {}) {
  const wrapRef = useRef(null);
  const [scale, setScale] = useState(defaultScale);

  const fitToWidth = useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const padX = 40;
    const padY = 72;
    const availableW = wrap.clientWidth - padX;
    const availableH = wrap.clientHeight - padY;
    const byWidth = availableW / A4_LANDSCAPE_PX.w;
    const byHeight = availableH / A4_LANDSCAPE_PX.h;
    const next = Math.min(byWidth, byHeight, MAX_SCALE);
    setScale(Math.max(MIN_SCALE, Math.round(next * 100) / 100));
  }, []);

  const resetZoom = useCallback(() => {
    setScale(defaultScale);
  }, [defaultScale]);

  const zoomIn = () => setScale((s) => Math.min(MAX_SCALE, Math.round((s + 0.08) * 100) / 100));
  const zoomOut = () => setScale((s) => Math.max(MIN_SCALE, Math.round((s - 0.08) * 100) / 100));

  return { wrapRef, scale, setScale, zoomIn, zoomOut, fitToWidth, resetZoom, pagePx: A4_LANDSCAPE_PX };
}
