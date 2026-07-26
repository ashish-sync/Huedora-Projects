import { useCallback, useEffect, useRef, useState } from 'react';
import { A4_LANDSCAPE_PX } from '../shared/a4Landscape.js';

const MIN_SCALE = 0.72;
const MAX_SCALE = 1.05;

export function usePreviewScale() {
  const wrapRef = useRef(null);
  const [scale, setScale] = useState(0.85);

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

  useEffect(() => {
    fitToWidth();
    window.addEventListener('resize', fitToWidth);
    return () => window.removeEventListener('resize', fitToWidth);
  }, [fitToWidth]);

  const zoomIn = () => setScale((s) => Math.min(MAX_SCALE, Math.round((s + 0.08) * 100) / 100));
  const zoomOut = () => setScale((s) => Math.max(MIN_SCALE, Math.round((s - 0.08) * 100) / 100));

  return { wrapRef, scale, setScale, zoomIn, zoomOut, fitToWidth, pagePx: A4_LANDSCAPE_PX };
}
