import { useEffect, useRef, useState, useCallback } from 'react';
import ModalShell from '../../components/ui/ModalShell.jsx';
import { Camera, ZoomIn, ZoomOut, RotateCcw, Move, X } from 'lucide-react';
import './headerPhotoEditor.css';

const VIEWPORT_SIZE = 300;
const CROP_DIAMETER = 240;
const CROP_RADIUS = CROP_DIAMETER / 2;
const MIN_ZOOM = 1.0;
const MAX_ZOOM = 3.0;

function clampPan(x, y, zoom, naturalDim, cropDiameter = CROP_DIAMETER) {
  if (!naturalDim.width || !naturalDim.height) return { x: 0, y: 0 };
  const baseScale = Math.max(cropDiameter / naturalDim.width, cropDiameter / naturalDim.height);
  const scale = baseScale * zoom;
  const wDisp = naturalDim.width * scale;
  const hDisp = naturalDim.height * scale;
  const maxPanX = Math.max(0, (wDisp - cropDiameter) / 2);
  const maxPanY = Math.max(0, (hDisp - cropDiameter) / 2);
  return {
    x: Math.min(maxPanX, Math.max(-maxPanX, x)),
    y: Math.min(maxPanY, Math.max(-maxPanY, y)),
  };
}

/**
 * HeaderPhotoEditorModal
 *
 * Enterprise-grade 1:1 circular photo crop modal.
 * Supports drag-to-reposition, smooth zoom slider/wheel, live circular previews,
 * reset, cancel, and high-resolution JPEG canvas export.
 */
export default function HeaderPhotoEditorModal({
  open = false,
  file,
  userName = '',
  onSave,
  onCancel,
}) {
  const [imageSrc, setImageSrc] = useState('');
  const [naturalDim, setNaturalDim] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const imgRef = useRef(null);
  const viewportRef = useRef(null);
  const startDragRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  // Load and decode chosen file
  useEffect(() => {
    if (!open || !file) {
      setImageSrc('');
      setNaturalDim({ width: 0, height: 0 });
      setZoom(1.0);
      setPan({ x: 0, y: 0 });
      setError('');
      return undefined;
    }

    const objectUrl = URL.createObjectURL(file);
    setImageSrc(objectUrl);
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
    setError('');

    const img = new Image();
    img.onload = () => {
      setNaturalDim({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      setError('Could not load image file. Please choose a valid image.');
    };
    img.src = objectUrl;

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [open, file]);

  // Adjust zoom and keep pan clamped
  const handleZoomChange = useCallback(
    (newZoom) => {
      const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, +(Number(newZoom) || 1).toFixed(2)));
      setZoom(clamped);
      setPan((currentPan) => clampPan(currentPan.x, currentPan.y, clamped, naturalDim));
    },
    [naturalDim]
  );

  // Wheel zoom over crop viewport
  useEffect(() => {
    const el = viewportRef.current;
    if (!el || !open) return undefined;

    const handleWheel = (event) => {
      event.preventDefault();
      const step = event.deltaY < 0 ? 0.08 : -0.08;
      setZoom((z) => {
        const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, +(z + step).toFixed(2)));
        setPan((currentPan) => clampPan(currentPan.x, currentPan.y, next, naturalDim));
        return next;
      });
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [open, naturalDim]);

  // Pointer drag events
  const handlePointerDown = (event) => {
    if (event.button !== 0) return; // Only main button
    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
    setIsDragging(true);
    startDragRef.current = {
      x: event.clientX,
      y: event.clientY,
      panX: pan.x,
      panY: pan.y,
    };
  };

  const handlePointerMove = (event) => {
    if (!isDragging) return;
    event.preventDefault();
    const dx = event.clientX - startDragRef.current.x;
    const dy = event.clientY - startDragRef.current.y;
    setPan(clampPan(startDragRef.current.panX + dx, startDragRef.current.panY + dy, zoom, naturalDim));
  };

  const handlePointerUp = (event) => {
    if (!isDragging) return;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
    setIsDragging(false);
  };

  const handleReset = () => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
  };

  const handleSave = async () => {
    if (!imgRef.current || !naturalDim.width || !naturalDim.height) return;
    setSaving(true);
    setError('');

    try {
      const baseScale = Math.max(CROP_DIAMETER / naturalDim.width, CROP_DIAMETER / naturalDim.height);
      const scale = baseScale * zoom;
      const wDisp = naturalDim.width * scale;
      const hDisp = naturalDim.height * scale;
      const xRel = wDisp / 2 - pan.x;
      const yRel = hDisp / 2 - pan.y;

      const sx = (xRel - CROP_RADIUS) / scale;
      const sy = (yRel - CROP_RADIUS) / scale;
      const sw = CROP_DIAMETER / scale;
      const sh = CROP_DIAMETER / scale;

      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not initialize canvas context');

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(imgRef.current, sx, sy, sw, sh, 0, 0, 512, 512);

      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Canvas export failed'))), 'image/jpeg', 0.92);
      });

      const baseName = (file?.name || 'header-photo').replace(/\.[^.]+$/, '');
      const croppedFile = new File([blob], `${baseName}-cropped.jpg`, { type: 'image/jpeg' });

      await onSave(croppedFile);
    } catch (err) {
      setError(err?.message || 'Could not process cropped photo');
      setSaving(false);
    }
  };

  if (!open || !file) return null;

  // Compute live preview transform
  const getPreviewImgStyle = (size) => {
    if (!naturalDim.width || !naturalDim.height) return {};
    const baseScale = Math.max(CROP_DIAMETER / naturalDim.width, CROP_DIAMETER / naturalDim.height);
    const scale = baseScale * zoom;
    const wDisp = naturalDim.width * scale;
    const hDisp = naturalDim.height * scale;
    const xRel = wDisp / 2 - pan.x;
    const yRel = hDisp / 2 - pan.y;
    const factor = size / CROP_DIAMETER;

    return {
      width: `${wDisp * factor}px`,
      height: `${hDisp * factor}px`,
      transform: `translate(${size / 2 - xRel * factor}px, ${size / 2 - yRel * factor}px)`,
      maxWidth: 'none',
      maxHeight: 'none',
      pointerEvents: 'none',
      userSelect: 'none',
    };
  };

  const baseScale = naturalDim.width && naturalDim.height
    ? Math.max(CROP_DIAMETER / naturalDim.width, CROP_DIAMETER / naturalDim.height)
    : 1;
  const currentWidth = naturalDim.width * baseScale * zoom;
  const currentHeight = naturalDim.height * baseScale * zoom;

  return (
    <ModalShell
      open={open}
      onClose={saving ? undefined : onCancel}
      title="Edit Header Photo"
      overlayClassName="modal-overlay rp-photo-editor-overlay"
      panelClassName="modal-card rp-photo-editor-card"
    >
      <div className="rp-editor-shell">
        <header className="rp-editor-header">
          <div className="rp-editor-title-wrap">
            <h3 className="rp-editor-title">
              <Camera size={18} className="rp-editor-title-icon" aria-hidden="true" />
              Adjust Header Photo
            </h3>
            <p className="rp-editor-subtitle">
              Drag to reposition, use the slider to zoom, and preview how your circular avatar appears in the application header.
            </p>
          </div>
          <button
            type="button"
            className="rp-editor-close-btn"
            onClick={onCancel}
            disabled={saving}
            aria-label="Close photo editor"
          >
            <X size={18} />
          </button>
        </header>

        {error ? (
          <div className="rp-editor-error" role="alert">
            {error}
          </div>
        ) : null}

        <div className="rp-editor-workspace">
          {/* Main Interactive Crop Column */}
          <div className="rp-editor-canvas-col">
            <div
              ref={viewportRef}
              className={`rp-crop-viewport${isDragging ? ' is-dragging' : ''}`}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              role="region"
              aria-label="Interactive image cropping canvas. Drag image to reposition, or scroll to zoom."
              tabIndex={0}
            >
              {imageSrc ? (
                <img
                  ref={imgRef}
                  src={imageSrc}
                  alt="Original upload"
                  className="rp-crop-source-image"
                  style={{
                    width: `${currentWidth}px`,
                    height: `${currentHeight}px`,
                    transform: `translate(${VIEWPORT_SIZE / 2 - currentWidth / 2 + pan.x}px, ${
                      VIEWPORT_SIZE / 2 - currentHeight / 2 + pan.y
                    }px)`,
                  }}
                  draggable={false}
                />
              ) : null}

              {/* 1:1 Circular Crop Mask & Guides */}
              <svg
                className="rp-crop-mask-svg"
                viewBox={`0 0 ${VIEWPORT_SIZE} ${VIEWPORT_SIZE}`}
                aria-hidden="true"
              >
                <defs>
                  <mask id="rpCropCircleMask">
                    <rect width={VIEWPORT_SIZE} height={VIEWPORT_SIZE} fill="#FFFFFF" />
                    <circle cx={VIEWPORT_SIZE / 2} cy={VIEWPORT_SIZE / 2} r={CROP_RADIUS} fill="#000000" />
                  </mask>
                </defs>
                {/* Shaded backdrop outside the circular crop area */}
                <rect
                  width={VIEWPORT_SIZE}
                  height={VIEWPORT_SIZE}
                  fill="rgba(15, 23, 42, 0.64)"
                  mask="url(#rpCropCircleMask)"
                />
                {/* Circle boundary ring */}
                <circle
                  cx={VIEWPORT_SIZE / 2}
                  cy={VIEWPORT_SIZE / 2}
                  r={CROP_RADIUS}
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.9)"
                  strokeWidth="2"
                />
                {/* Rule of thirds grid lines */}
                <g className="rp-crop-guides" opacity={isDragging ? 0.7 : 0.35}>
                  <line
                    x1={VIEWPORT_SIZE / 2 - CROP_RADIUS + 25}
                    y1={VIEWPORT_SIZE / 2 - CROP_RADIUS / 3}
                    x2={VIEWPORT_SIZE / 2 + CROP_RADIUS - 25}
                    y2={VIEWPORT_SIZE / 2 - CROP_RADIUS / 3}
                    stroke="rgba(255, 255, 255, 0.75)"
                    strokeDasharray="3 3"
                  />
                  <line
                    x1={VIEWPORT_SIZE / 2 - CROP_RADIUS + 25}
                    y1={VIEWPORT_SIZE / 2 + CROP_RADIUS / 3}
                    x2={VIEWPORT_SIZE / 2 + CROP_RADIUS - 25}
                    y2={VIEWPORT_SIZE / 2 + CROP_RADIUS / 3}
                    stroke="rgba(255, 255, 255, 0.75)"
                    strokeDasharray="3 3"
                  />
                  <line
                    x1={VIEWPORT_SIZE / 2 - CROP_RADIUS / 3}
                    y1={VIEWPORT_SIZE / 2 - CROP_RADIUS + 25}
                    x2={VIEWPORT_SIZE / 2 - CROP_RADIUS / 3}
                    y2={VIEWPORT_SIZE / 2 + CROP_RADIUS - 25}
                    stroke="rgba(255, 255, 255, 0.75)"
                    strokeDasharray="3 3"
                  />
                  <line
                    x1={VIEWPORT_SIZE / 2 + CROP_RADIUS / 3}
                    y1={VIEWPORT_SIZE / 2 - CROP_RADIUS + 25}
                    x2={VIEWPORT_SIZE / 2 + CROP_RADIUS / 3}
                    y2={VIEWPORT_SIZE / 2 + CROP_RADIUS - 25}
                    stroke="rgba(255, 255, 255, 0.75)"
                    strokeDasharray="3 3"
                  />
                </g>
              </svg>

              <div className="rp-crop-hint" aria-hidden="true">
                <Move size={12} />
                <span>Drag to reposition</span>
              </div>
            </div>

            {/* Zoom Slider Control */}
            <div className="rp-editor-zoom-bar">
              <button
                type="button"
                className="rp-editor-zoom-btn"
                onClick={() => handleZoomChange(zoom - 0.1)}
                title="Zoom out"
                aria-label="Zoom out"
                disabled={zoom <= MIN_ZOOM}
              >
                <ZoomOut size={16} />
              </button>

              <div className="rp-editor-slider-wrap">
                <input
                  type="range"
                  className="rp-editor-slider"
                  min={MIN_ZOOM}
                  max={MAX_ZOOM}
                  step={0.01}
                  value={zoom}
                  onChange={(e) => handleZoomChange(Number(e.target.value))}
                  aria-label="Zoom level"
                />
              </div>

              <button
                type="button"
                className="rp-editor-zoom-btn"
                onClick={() => handleZoomChange(zoom + 0.1)}
                title="Zoom in"
                aria-label="Zoom in"
                disabled={zoom >= MAX_ZOOM}
              >
                <ZoomIn size={16} />
              </button>

              <span className="rp-editor-zoom-value" aria-live="polite">
                {Math.round(zoom * 100)}%
              </span>
            </div>
          </div>

          {/* Real-time Header & Card Previews Column */}
          <div className="rp-editor-preview-col">
            <h4 className="rp-preview-heading">Live Previews</h4>
            <p className="rp-preview-desc">
              Matches your actual application surfaces in real-time.
            </p>

            <div className="rp-preview-group">
              <div className="rp-preview-item">
                <span className="rp-preview-badge-label">Profile Card (72px)</span>
                <div className="rp-preview-circle rp-preview-circle--72" aria-hidden="true">
                  {imageSrc ? <img src={imageSrc} style={getPreviewImgStyle(72)} alt="" /> : null}
                </div>
              </div>

              <div className="rp-preview-item">
                <span className="rp-preview-badge-label">Header Bar (30px)</span>
                <div className="rp-preview-header-pill" aria-hidden="true">
                  <div className="header-avatar rp-preview-circle--30">
                    {imageSrc ? <img src={imageSrc} style={getPreviewImgStyle(30)} alt="" /> : null}
                  </div>
                  <span className="rp-preview-pill-name">{userName || 'Your Name'}</span>
                </div>
              </div>
            </div>

            <div className="rp-preview-tip">
              <span className="rp-tip-dot" />
              <span>1:1 high-resolution crop exported at 512×512px for crisp Retina display.</span>
            </div>
          </div>
        </div>

        {/* Modal Actions Footer */}
        <footer className="rp-editor-actions">
          <button
            type="button"
            className="btn secondary rp-editor-reset-btn"
            onClick={handleReset}
            disabled={saving || (zoom === 1 && pan.x === 0 && pan.y === 0)}
          >
            <RotateCcw size={14} />
            <span>Reset</span>
          </button>

          <div className="rp-editor-action-group">
            <button
              type="button"
              className="btn secondary"
              onClick={onCancel}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn primary"
              onClick={handleSave}
              disabled={saving || !imageSrc}
            >
              {saving ? 'Saving photo…' : 'Save Header Photo'}
            </button>
          </div>
        </footer>
      </div>
    </ModalShell>
  );
}
