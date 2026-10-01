import { useLayoutEffect, useRef, useState } from 'react';
import { formatDigitallySignedOn, normalizeSignatoryDisplayName } from './clickToSign.js';

/** Leave a thin inset so the stamp sits just inside the box borders. */
const FIT_INSET = 0.96;
const MAX_SCALE = 1.85;

/**
 * Click-to-Sign stamp that scales to fill parent width
 * (name + date stay one line each, snug inside the Digital Signature box).
 */
export default function ClickToSignStamp({ signatoryName, signedAt, className = '' }) {
  const shellRef = useRef(null);
  const stampRef = useRef(null);
  const [scale, setScale] = useState(1);

  const name = normalizeSignatoryDisplayName(signatoryName);
  const meta = formatDigitallySignedOn(signedAt);

  useLayoutEffect(() => {
    const shell = shellRef.current;
    const stamp = stampRef.current;
    if (!shell || !stamp) return undefined;

    function fit() {
      stamp.style.transform = 'scale(1)';
      const available = shell.clientWidth;
      const needed = Math.max(stamp.scrollWidth, stamp.offsetWidth);
      if (!available || !needed) {
        setScale(1);
        return;
      }
      const next = Math.min(MAX_SCALE, (available * FIT_INSET) / needed);
      setScale(Number.isFinite(next) && next > 0 ? next : 1);
    }

    fit();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
    ro?.observe(shell);
    window.addEventListener('resize', fit);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', fit);
    };
  }, [name, meta]);

  return (
    <div ref={shellRef} className={`ti-click-sign-shell ${className}`.trim()}>
      <div
        ref={stampRef}
        className="ti-click-sign"
        aria-label="Digital signature"
        style={{ transform: `scale(${scale})` }}
      >
        <div className="ti-click-sign__name signature-name">{name}</div>
        <div className="ti-click-sign__meta signature-date">{meta}</div>
      </div>
    </div>
  );
}
