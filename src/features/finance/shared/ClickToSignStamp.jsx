import { useLayoutEffect, useRef } from 'react';
import { formatDigitallySignedOn, normalizeSignatoryDisplayName } from './clickToSign.js';
import { fitClickToSignStamps } from './fitClickToSign.js';

/**
 * Click-to-Sign stamp that scales to fill parent width
 * (name + date stay one line each, snug inside the Digital Signature box).
 */
export default function ClickToSignStamp({ signatoryName, signedAt, className = '' }) {
  const shellRef = useRef(null);

  const name = normalizeSignatoryDisplayName(signatoryName);
  const meta = formatDigitallySignedOn(signedAt);

  useLayoutEffect(() => {
    const shell = shellRef.current;
    if (!shell) return undefined;

    function fit() {
      fitClickToSignStamps(shell);
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
      <div className="ti-click-sign" aria-label="Digital signature">
        <div className="ti-click-sign__name signature-name">{name}</div>
        <div className="ti-click-sign__meta signature-date">{meta}</div>
      </div>
    </div>
  );
}
