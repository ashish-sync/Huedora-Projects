const ACTION_COPY = {
  approve: {
    title: 'Approve camp',
    message: 'Are you sure you want to approve this camp?',
    confirmLabel: 'Approve',
    confirmClass: 'btn-primary',
  },
  reject: {
    title: 'Reject camp',
    message: 'Are you sure you want to reject this camp?',
    confirmLabel: 'Reject',
    confirmClass: 'btn-danger',
  },
  delete: {
    title: 'Delete camp',
    message: 'Are you sure you want to delete this camp? This action archives the camp.',
    confirmLabel: 'Delete',
    confirmClass: 'btn-danger',
  },
  cancel: {
    title: 'Cancel camp',
    message: 'Choose who cancelled this camp and add a remark.',
    confirmLabel: 'Cancel camp',
    confirmClass: 'btn-danger',
  },
  execute: {
    title: 'Mark executed',
    message: 'Are you sure you want to mark this camp as executed?',
    confirmLabel: 'Mark executed',
    confirmClass: 'btn-primary',
  },
  submitReview: {
    title: 'Re-submit camp',
    message: 'Are you sure you want to re-submit this camp for review?',
    confirmLabel: 'Re-submit',
    confirmClass: 'btn-primary',
  },
};

const BULK_ACTION_COPY = {
  approve: {
    title: 'Approve selected camps',
    message: (count) => `Approve ${count} selected camp${count === 1 ? '' : 's'}?`,
    confirmLabel: 'Approve selected',
    confirmClass: 'btn-primary',
  },
  reject: {
    title: 'Reject selected camps',
    message: (count) => `Reject ${count} selected camp${count === 1 ? '' : 's'}?`,
    confirmLabel: 'Reject selected',
    confirmClass: 'btn-danger',
  },
  delete: {
    title: 'Delete selected camps',
    message: (count) => `Delete ${count} selected camp${count === 1 ? '' : 's'}? This archives them.`,
    confirmLabel: 'Delete selected',
    confirmClass: 'btn-danger',
  },
  execute: {
    title: 'Mark selected executed',
    message: (count) => `Mark ${count} selected camp${count === 1 ? '' : 's'} as executed?`,
    confirmLabel: 'Mark executed',
    confirmClass: 'btn-primary',
  },
};

const CANCEL_OPTIONS = [
  { value: 'brand', label: 'Cancel by Brand', description: 'The brand requested this camp be cancelled.' },
  { value: 'khw', label: 'Cancel by KHW', description: 'KHW cancelled this camp internally.' },
];

function CampSummary({ camp }) {
  if (!camp) return null;

  return (
    <div className="modal-camp-summary modal-camp-summary-grid">
      {camp.campId && (
        <div className="modal-camp-summary-row">
          <span>Camp ID</span>
          <strong>{camp.campId}</strong>
        </div>
      )}
      <div className="modal-camp-summary-row">
        <span>Client</span>
        <strong>{camp.clientName || '—'}</strong>
      </div>
      <div className="modal-camp-summary-row">
        <span>Division</span>
        <strong>{camp.campaignType || '—'}</strong>
      </div>
      <div className="modal-camp-summary-row">
        <span>Camp</span>
        <strong>{camp.campaignName || '—'}</strong>
      </div>
    </div>
  );
}

export function CampActionConfirmModal({
  request,
  cancelDetails,
  onCancelDetailsChange,
  onConfirm,
  onCancel,
  loading = false,
}) {
  if (!request) return null;

  const isBulk = request.mode === 'bulk';
  const copy = isBulk
    ? BULK_ACTION_COPY[request.action]
    : ACTION_COPY[request.action];

  if (!copy) return null;

  const message = isBulk ? copy.message(request.count) : copy.message;
  const showCancelForm = !isBulk && request.action === 'cancel' && cancelDetails;
  const cancelReady = !showCancelForm
    || (cancelDetails.cancelledBy && String(cancelDetails.remarks || '').trim());
  const modalClassName = showCancelForm ? 'modal-card modal-card-cancel' : 'modal-card';

  return (
    <div className="modal-overlay" onClick={loading ? undefined : onCancel}>
      <div
        className={modalClassName}
        role="dialog"
        aria-modal="true"
        aria-labelledby="camp-action-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="camp-action-modal-title">{copy.title}</h2>
        {!showCancelForm && <p className="modal-message">{message}</p>}

        {!isBulk && request.camp && !showCancelForm && (
          <div className="modal-camp-summary">
            <div><strong>Client:</strong> {request.camp.clientName || '—'}</div>
            <div><strong>Camp:</strong> {request.camp.campaignName || '—'}</div>
          </div>
        )}

        {showCancelForm && (
          <>
            <p className="modal-message">Record who cancelled this camp and why. The remark is required.</p>
            <CampSummary camp={request.camp} />

            <div className="modal-cancel-form">
              <div className="modal-cancel-section">
                <p className="modal-cancel-section-title">Cancelled by</p>
                <div className="cancel-source-options" role="radiogroup" aria-label="Cancelled by">
                  {CANCEL_OPTIONS.map((option) => {
                    const isSelected = cancelDetails.cancelledBy === option.value;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        className={`cancel-source-option${isSelected ? ' is-selected' : ''}`}
                        onClick={() => onCancelDetailsChange({
                          ...cancelDetails,
                          cancelledBy: option.value,
                        })}
                      >
                        <span className="cancel-source-option-label">{option.label}</span>
                        <span className="cancel-source-option-text">{option.description}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <label className="modal-cancel-remark-field">
                Remark
                <textarea
                  rows={4}
                  value={cancelDetails.remarks}
                  placeholder="Enter the reason for cancellation"
                  onChange={(e) => onCancelDetailsChange({
                    ...cancelDetails,
                    remarks: e.target.value,
                  })}
                  required
                />
                <span className="modal-cancel-remark-hint">Required before confirming cancellation.</span>
              </label>
            </div>
          </>
        )}

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={loading}>
            Close
          </button>
          <button
            type="button"
            className={`btn ${copy.confirmClass}`}
            onClick={onConfirm}
            disabled={loading || !cancelReady}
          >
            {loading ? 'Processing...' : copy.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
