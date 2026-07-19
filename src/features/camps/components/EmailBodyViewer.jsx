import { useMemo, useState } from 'react';
import { parseEmailDisplaySegments } from '../utils/parseEmailBody';

function ChevronIcon({ expanded }) {
  return (
    <svg
      className={`email-body-chevron${expanded ? ' is-expanded' : ''}`}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="M8.12 9.29 12 13.17l3.88-3.88a1 1 0 1 1 1.41 1.41l-4.59 4.59a1 1 0 0 1-1.41 0L6.71 10.7a1 1 0 0 1 1.41-1.41z" fill="currentColor" />
    </svg>
  );
}

function getSegmentSubject(segment) {
  const subject = segment.meta?.subject?.trim();
  if (subject) return subject;
  if (segment.preview && segment.preview !== 'No preview available') return segment.preview;
  return 'No subject';
}

export function EmailBodyViewer({ bodyText, bodySegments, activeField, onSelectionCapture }) {
  const segments = useMemo(() => {
    if (bodySegments?.length) return bodySegments;
    return parseEmailDisplaySegments(bodyText);
  }, [bodySegments, bodyText]);

  const [expanded, setExpanded] = useState(() => new Set([1]));

  const hasMultiple = segments.length > 1;

  function toggleSegment(index) {
    setExpanded((current) => {
      if (current.has(index)) {
        const next = new Set(current);
        next.delete(index);
        return next;
      }
      return new Set([index]);
    });
  }

  function handleMouseUp() {
    if (!activeField || !onSelectionCapture) return;
    const selection = window.getSelection()?.toString().trim();
    if (selection) {
      onSelectionCapture(selection);
    }
  }

  if (!segments.length) {
    return <div className="email-detail-empty">No body text stored for this email.</div>;
  }

  return (
    <div
      className={`email-body-viewer${activeField ? ' is-pick-mode' : ''}`}
      onMouseUp={handleMouseUp}
    >
      {hasMultiple && (
        <p className="email-body-forward-hint meta-text">
          This email contains {segments.length} message layers. Open one section at a time — scroll to read the full message.
        </p>
      )}

      {segments.map((segment, segmentIdx) => {
        const isExpanded = !hasMultiple || expanded.has(segment.index);
        const subject = getSegmentSubject(segment);
        const layerLabel = segment.isForwarded ? 'Forwarded' : 'Latest';

        return (
          <article
            key={segment.index}
            className={`email-body-segment${segment.isForwarded ? ' is-forwarded' : ''}${isExpanded ? ' is-expanded' : ' is-collapsed'}`}
          >
            <button
              type="button"
              className="email-body-segment-header"
              onClick={() => hasMultiple && toggleSegment(segment.index)}
              aria-expanded={isExpanded}
              disabled={!hasMultiple}
            >
              <span className="email-body-segment-number" aria-hidden="true">
                {segmentIdx + 1}
              </span>
              <div className="email-body-segment-heading">
                <span className="email-body-segment-type">{layerLabel}</span>
                <span className="email-body-segment-subject" title={subject}>
                  {subject}
                </span>
              </div>
              {hasMultiple && <ChevronIcon expanded={isExpanded} />}
            </button>

            {isExpanded && (
              <div className="email-body-segment-body">
                <pre className="email-body-segment-text">{segment.text || 'No content in this section.'}</pre>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
