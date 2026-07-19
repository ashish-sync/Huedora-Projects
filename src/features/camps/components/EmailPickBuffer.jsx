import { useEffect } from 'react';

export function EmailPickBuffer({ activeField, pendingSelection, onApply, onCancel }) {
  useEffect(() => {
    if (!activeField || !pendingSelection || !onApply) return undefined;

    function handleKeyDown(event) {
      if (event.key !== 'Enter') return;
      const tag = event.target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      event.preventDefault();
      onApply();
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeField, pendingSelection, onApply]);

  if (!activeField) return null;

  return (
    <div className="email-body-pick-buffer">
      <span className="email-body-pick-buffer-label">
        Insert into <strong>{activeField.label}</strong>
      </span>
      <div
        className={`email-body-pick-buffer-text${pendingSelection ? ' has-selection' : ''}`}
        aria-live="polite"
      >
        {pendingSelection || 'Select text in the message above'}
      </div>
      <div className="email-body-pick-buffer-actions">
        <button
          type="button"
          className="email-body-pick-apply-btn"
          onClick={onApply}
          disabled={!pendingSelection}
          title={`Insert selection into ${activeField.label} (Enter)`}
          aria-label={`Insert selection into ${activeField.label}`}
        >
          →
        </button>
        {onCancel && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
