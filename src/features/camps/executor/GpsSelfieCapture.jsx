import { useEffect, useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';

async function openCameraStream() {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('This device does not support live camera capture');
  }
  const attempts = [
    { audio: false, video: { facingMode: { ideal: 'user' }, width: { ideal: 1280 }, height: { ideal: 720 } } },
    { audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } },
    { audio: false, video: true },
  ];
  let lastError = null;
  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('Allow camera access to capture the GPS selfie');
}

function stopStream(stream) {
  if (!stream) return;
  stream.getTracks().forEach((track) => {
    try { track.stop(); } catch { /* ignore */ }
  });
}

async function snapshotToFile(video) {
  const width = video.videoWidth || 0;
  const height = video.videoHeight || 0;
  if (!width || !height) {
    throw new Error('Camera is not ready yet — wait a moment and try again');
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Could not capture from camera');
  ctx.drawImage(video, 0, 0, width, height);
  const blob = await new Promise((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', 0.92);
  });
  if (!blob || blob.size <= 0) {
    throw new Error('Could not capture photo from camera');
  }
  return new File([blob], `gps-selfie-${Date.now()}.jpg`, {
    type: 'image/jpeg',
    lastModified: Date.now(),
  });
}

/**
 * Live camera-only GPS selfie capture (no gallery / file upload).
 */
export function GpsSelfieCapture({ open, busy = false, onCapture, onCancel }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [starting, setStarting] = useState(false);
  const [snapping, setSnapping] = useState(false);
  const [camError, setCamError] = useState('');

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;

    async function start() {
      setCamError('');
      setStarting(true);
      stopStream(streamRef.current);
      streamRef.current = null;
      try {
        const stream = await openCameraStream();
        if (cancelled) {
          stopStream(stream);
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => {});
        }
      } catch (err) {
        if (!cancelled) {
          setCamError(
            err?.message
              || 'Allow camera access to capture the GPS selfie. Gallery upload is not allowed.',
          );
        }
      } finally {
        if (!cancelled) setStarting(false);
      }
    }

    start();
    return () => {
      cancelled = true;
      stopStream(streamRef.current);
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [open]);

  async function handleSnap() {
    if (busy || snapping || starting || camError) return;
    setSnapping(true);
    setCamError('');
    try {
      const file = await snapshotToFile(videoRef.current);
      stopStream(streamRef.current);
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      await onCapture?.(file);
    } catch (err) {
      setCamError(err?.message || 'Could not capture GPS selfie');
    } finally {
      setSnapping(false);
    }
  }

  if (!open) return null;

  const blocked = busy || starting || snapping;

  return (
    <div className="camp-execute__camera" role="dialog" aria-modal="true" aria-label="Capture GPS Selfie">
      <div className="camp-execute__camera-head">
        <strong>Live GPS Selfie</strong>
        <button
          type="button"
          className="camp-execute__icon-btn"
          aria-label="Close camera"
          disabled={busy || snapping}
          onClick={() => onCancel?.()}
        >
          <X size={20} />
        </button>
      </div>
      <p className="camp-execute__camera-hint">
        Real-time capture only — photos from gallery or files cannot be used.
      </p>
      <div className="camp-execute__camera-frame">
        {camError ? (
          <p className="camp-execute__camera-error">{camError}</p>
        ) : (
          <video
            ref={videoRef}
            className="camp-execute__camera-video"
            playsInline
            muted
            autoPlay
          />
        )}
        {starting && !camError ? (
          <p className="camp-execute__camera-loading">Starting camera…</p>
        ) : null}
      </div>
      <div className="camp-execute__camera-actions">
        <button
          type="button"
          className="camp-execute__text-btn"
          disabled={busy || snapping}
          onClick={() => onCancel?.()}
        >
          Cancel
        </button>
        <button
          type="button"
          className="camp-execute__upload-btn"
          disabled={blocked || Boolean(camError)}
          onClick={handleSnap}
        >
          <Camera size={18} aria-hidden="true" />
          {snapping ? 'Capturing…' : 'Capture now'}
        </button>
      </div>
    </div>
  );
}
