import { useCallback, useEffect, useRef, useState } from 'react';
import { A4_LANDSCAPE_PX, A4_PORTRAIT_PX } from '../shared/a4Landscape.js';

/**
 * Preview zoom for commercial builders.
 * Default / auto-fit is locked at 88% minimum — never auto-zooms above 88%.
 * Manual + / − can still go higher (up to MAX) or stay at the 88% floor.
 */
export const DEFAULT_PREVIEW_SCALE = 0.88;
const MIN_SCALE = 0.88;
const MAX_SCALE = 1.5;
/** Auto-fit never exceeds this (stops wide canvases jumping to 115%+). */
const AUTO_FIT_CAP = 0.88;

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
    const padX = 16;
    const availableW = Math.max(120, wrap.clientWidth - padX);
    const byWidth = availableW / pagePx.w;
    // Prefer filling width, but lock auto-fit to 88% (MIN = CAP).
    const next = Math.min(byWidth, AUTO_FIT_CAP, MAX_SCALE);
    setScale(Math.max(MIN_SCALE, Math.round(next * 100) / 100));
  }, [pagePx.w]);

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
