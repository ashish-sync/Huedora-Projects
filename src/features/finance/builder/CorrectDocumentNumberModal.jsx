import { useEffect, useState } from 'react';
import { documentNumberExample } from '../documentNumbering.js';

export default function CorrectDocumentNumberModal({
  open,
  row,
  documentCode,
  busy = false,
  error = '',
  onClose,
  onSubmit,
}) {
  const [nextNumber, setNextNumber] = useState('');
  const [remark, setRemark] = useState('');

  useEffect(() => {
    if (!open) return;
    setNextNumber('');
    setRemark('');
  }, [open, row?.documentNumber]);

  if (!open || !row) return null;

  const current = String(row.documentNumber || '').trim() || '—';
  const example = documentNumberExample(row.documentType, row.documentDate, documentCode);

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit?.({ documentNumber: nextNumber, remark });
  }

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="modal-card finance-payment-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Correct document number"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="modal-title">Correct document number</h3>
        <p className="muted finance-payment-modal-meta">
          Current: <strong>{current}</strong>
        </p>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="correct-doc-number">New document number *</label>
            <input
              id="correct-doc-number"
              className="ib-input--mono"
              value={nextNumber}
              onChange={(e) => setNextNumber(e.target.value)}
              placeholder={example}
              disabled={busy}
              autoFocus
              required
            />
            <p className="field-hint muted">Must match {example} and must be unique.</p>
          </div>
          <div className="field">
            <label htmlFor="correct-doc-remark">Remark *</label>
            <textarea
              id="correct-doc-remark"
              rows={2}
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="Why is this number being corrected?"
              disabled={busy}
              required
            />
          </div>
          {error ? <p className="field-hint" role="alert">{error}</p> : null}
          <div className="modal-actions">
            <button type="button" className="btn secondary" disabled={busy} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn primary" disabled={busy || !nextNumber.trim() || !remark.trim()}>
              {busy ? 'Saving…' : 'Save number'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
