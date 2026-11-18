import {
  qieIndicatorGlyph,
  qieIndicatorLabel,
  resolveQieIndicator,
} from './qieIndicators.js';

export default function QieIndicator({
  url = '',
  summary = null,
  onOpen,
  className = '',
  disabled = false,
}) {
  const indicator = resolveQieIndicator({ url, summary });
  const label = qieIndicatorLabel(indicator);
  const glyph = qieIndicatorGlyph(indicator);
  const canOpen = Boolean(summary?.verificationId) && typeof onOpen === 'function';

  return (
    <button
      type="button"
      className={`qie-indicator qie-indicator--${indicator}${className ? ` ${className}` : ''}`}
      title={label}
      aria-label={label}
      disabled={disabled || !canOpen}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (canOpen) onOpen(summary.verificationId);
      }}
    >
      <span className="qie-indicator__glyph" aria-hidden="true">{glyph}</span>
    </button>
  );
}
