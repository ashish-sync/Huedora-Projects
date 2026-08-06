import { useCallback, useEffect, useRef, useState } from 'react';
import { A4_LANDSCAPE_PX, A4_PORTRAIT_PX } from '../shared/a4Landscape.js';

/** Default preview zoom — never auto-fit below this floor. */
export const DEFAULT_PREVIEW_SCALE = 0.85;
const MIN_SCALE = 0.85;
const MAX_SCALE = 1.4;

export function usePreviewScale({
  defaultScale = DEFAULT_PREVIEW_SCALE,
  autoFit = true,
  orientation = 'landscape',
} = {}) {
  const wrapRef = useRef(null);
  const [scale, setScale] = useState(defaultScale);
  const pagePx = orientation === 'portrait' ? A4_PORTRAIT_PX : A4_LANDSCAPE_PX;

  const fitToWidth = useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const padX = 24;
    const padY = 28;
    const availableW = Math.max(120, wrap.clientWidth - padX);
    const availableH = Math.max(120, wrap.clientHeight - padY);
    const byWidth = availableW / pagePx.w;
    const byHeight = availableH / pagePx.h;
    const next = Math.min(byWidth, byHeight, MAX_SCALE);
    setScale(Math.max(MIN_SCALE, Math.round(next * 100) / 100));
  }, [pagePx.h, pagePx.w]);

  const resetZoom = useCallback(() => {
    if (autoFit) fitToWidth();
    else setScale(defaultScale);
  }, [autoFit, defaultScale, fitToWidth]);

  useEffect(() => {
    if (!autoFit) return undefined;
    const wrap = wrapRef.current;
    if (!wrap) return undefined;

    const runFit = () => {
      requestAnimationFrame(() => fitToWidth());
    };
    runFit();

    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(runFit) : null;
    ro?.observe(wrap);
    window.addEventListener('resize', runFit);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', runFit);
    };
  }, [autoFit, fitToWidth, orientation]);

  const zoomIn = () => setScale((s) => Math.min(MAX_SCALE, Math.round((s + 0.08) * 100) / 100));
  const zoomOut = () => setScale((s) => Math.max(MIN_SCALE, Math.round((s - 0.08) * 100) / 100));

  return { wrapRef, scale, setScale, zoomIn, zoomOut, fitToWidth, resetZoom, pagePx, orientation };
}
