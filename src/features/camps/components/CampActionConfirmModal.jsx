import { createPortal } from 'react-dom';
import {
  closureSubReasonRequiresRemarks,
  getAvailableClosureTypes,
  getClosureReasonCategories,
  getClosureSubReasons,
  hasSingleClosureReasonCategory,
  isClosureDetailsReady,
  resolveClosureReasonCategory,
} from '../constants/campClosure';
import { closeCampModalCopy } from '../utils/campCancelRefuse';

const ACTION_COPY = {
  approve: {
    title: 'Approve camp',
    message: 'Are you sure you want to approve this camp?',
    confirmLabel: 'Approve',
    confirmClass: '',
  },
  reject: {
    title: 'Refuse camp',
    message: 'Provide a mandatory reason before refusing this camp request.',
    confirmLabel: 'Refuse',
    confirmClass: 'danger',
    requiresReason: true,
    reasonLabel: 'Refusal reason',
    reasonPlaceholder: 'Enter why this request is being refused',
  },
  requestInformation: {
    title: 'Request more information',
    message: 'Ask the requester to update or clarify details before approval.',
    confirmLabel: 'Send request',
    confirmClass: '',
    requiresReason: true,
    reasonLabel: 'Information needed',
    reasonPlaceholder: 'Describe what information is required',
  },
  delete: {
    title: 'Delete camp',
    message: 'Are you sure you want to delete this camp? This action archives the camp.',
    confirmLabel: 'Delete',
    confirmClass: 'danger',
  },
  cancel: {
    title: 'Cancel camp',
    message: 'Choose who cancelled this camp and add a remark.',
    confirmLabel: 'Cancel camp',
    confirmClass: 'danger',
  },
  closeCamp: {
    title: 'Cancel camp',
    message: 'Choose how to close this camp and select a reason code.',
    confirmLabel: 'Confirm cancellation',
    confirmClass: 'danger',
  },
  execute: {
    title: 'Mark executed',
    message: 'Are you sure you want to mark this camp as executed?',
    confirmLabel: 'Mark executed',
    confirmClass: '',
  },
  submitReview: {
    title: 'Re-submit camp',
    message: 'Are you sure you want to re-submit this camp for review?',
    confirmLabel: 'Re-submit',
    confirmClass: '',
  },
};

const BULK_ACTION_COPY = {
  approve: {
    title: 'Approve selected camps',
    message: (count) => `Approve ${count} selected camp${count === 1 ? '' : 's'}?`,
    confirmLabel: 'Approve selected',
    confirmClass: '',
  },
  reject: {
    title: 'Refuse selected camps',
    message: (count) => `Refuse ${count} selected camp${count === 1 ? '' : 's'}?`,
    confirmLabel: 'Refuse selected',
    confirmClass: 'danger',
  },
  delete: {
    title: 'Delete selected camps',
    message: (count) => `Delete ${count} selected camp${count === 1 ? '' : 's'}? This archives them.`,
    confirmLabel: 'Delete selected',
    confirmClass: 'danger',
  },
  execute: {
    title: 'Mark selected executed',
    message: (count) => `Mark ${count} selected camp${count === 1 ? '' : 's'} as executed?`,
    confirmLabel: 'Mark executed',
    confirmClass: '',
  },
};

const CANCEL_OPTIONS = [
  { value: 'brand', label: 'Cancel by Brand', description: 'The brand requested this camp be cancelled.' },
  { value: 'khw', label: 'Cancel by KHW', description: 'KHW cancelled this camp internally.' },
];

function CampSummary({ camp, compact = false }) {
  if (!camp) return null;

  if (compact) {
    const parts = [
      camp.campId,
      camp.clientName,
      camp.campaignName,
    ].filter(Boolean);
    if (!parts.length) return null;
    return (
      <p className="modal-camp-summary-compact" title={parts.join(' · ')}>
        {parts.join(' · ')}
      </p>
    );
  }

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

function confirmButtonClass(confirmClass) {
  if (confirmClass === 'danger') return 'btn btn-danger';
  return 'btn btn-primary';
}

export function CampActionConfirmModal({
  request,
  cancelDetails,
  closureDetails,
  reasonDetails,
  onCancelDetailsChange,
  onClosureDetailsChange,
  onReasonDetailsChange,
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

  const closureStage = request.stage || request.camp?.lifecycleStage || 'request';
  const message = isBulk ? copy.message(request.count) : copy.message;
  const closeCopy = !isBulk && request.action === 'closeCamp' && request.camp
    ? closeCampModalCopy(request.camp, closureStage)
    : null;
  const dialogTitle = closeCopy?.title || copy.title;
  const dialogMessage = closeCopy?.message || message;
  const confirmLabel = loading ? 'Processing...' : (closeCopy?.confirmLabel || copy.confirmLabel);
  const showCancelForm = !isBulk && request.action === 'cancel' && cancelDetails;
  const showClosureForm = !isBulk && request.action === 'closeCamp' && closureDetails;
  const showReasonForm = !isBulk && copy.requiresReason && reasonDetails;
  const availableClosureTypes = request.camp
    ? getAvailableClosureTypes(request.camp, closureStage)
    : [];
  const effectiveClosureType = closureDetails?.closureType || availableClosureTypes[0] || '';
  const effectiveReasonCategory = showClosureForm
    ? resolveClosureReasonCategory(
      effectiveClosureType,
      closureDetails?.reasonCategory,
      request.camp,
      closureStage,
    )
    : '';
  const showClosureReasonCategory = showClosureForm
    && effectiveClosureType
    && !hasSingleClosureReasonCategory(effectiveClosureType, request.camp, closureStage);
  const cancelReady = !showCancelForm
    || (cancelDetails.cancelledBy && String(cancelDetails.remarks || '').trim());
  const closureReady = !showClosureForm || isClosureDetailsReady(closureDetails, request.camp, closureStage);
  const reasonReady = !showReasonForm || String(reasonDetails.reason || '').trim();
  const confirmDisabled = loading || !cancelReady || !closureReady || !reasonReady;
  const modalClassName = (showCancelForm || showClosureForm || showReasonForm)
    ? 'modal-card modal-card-cancel'
    : 'modal-card';

  const modal = (
    <div className="camp-ops-root camp-info-portal-root">
      <div className="modal-overlay camp-info-modal-overlay" onClick={loading ? undefined : onCancel}>
        <div
          className={modalClassName}
          role="dialog"
          aria-modal="true"
          aria-labelledby="camp-action-modal-title"
          onClick={(e) => e.stopPropagation()}
        >
          <div className={modalClassName.includes('modal-card-cancel') ? 'modal-card-body' : undefined}>
            <h2 id="camp-action-modal-title">{dialogTitle}</h2>
            {!showCancelForm && !showClosureForm && !showReasonForm && <p className="modal-message">{dialogMessage}</p>}

            {!isBulk && request.camp && !showCancelForm && !showClosureForm && !showReasonForm && (
              <div className="modal-camp-summary">
                <div><strong>Client:</strong> {request.camp.clientName || '—'}</div>
                <div><strong>Camp:</strong> {request.camp.campaignName || '—'}</div>
              </div>
            )}

            {showReasonForm && (
              <>
                {message ? <p className="modal-message">{message}</p> : null}
                <CampSummary camp={request.camp} compact />
                <label className="modal-cancel-remark-field">
                  {copy.reasonLabel}
                  <textarea
                    rows={3}
                    value={reasonDetails.reason}
                    placeholder={copy.reasonPlaceholder}
                    onChange={(e) => onReasonDetailsChange({
                      ...reasonDetails,
                      reason: e.target.value,
                    })}
                    required
                  />
                </label>
              </>
            )}

            {showClosureForm && (
              <>
                <CampSummary camp={request.camp} compact />

                <div className="modal-cancel-form modal-closure-form">
                  {availableClosureTypes.length > 1 ? (
                    <label className="modal-cancel-remark-field">
                      Closure type
                      <select
                        value={closureDetails.closureType}
                        onChange={(e) => onClosureDetailsChange({
                          ...closureDetails,
                          closureType: e.target.value,
                          reasonCategory: resolveClosureReasonCategory(
                            e.target.value,
                            '',
                            request.camp,
                            closureStage,
                          ),
                          subReason: '',
                          remarks: '',
                        })}
                        required
                      >
                        <option value="">Select type</option>
                        {availableClosureTypes.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </label>
                  ) : effectiveClosureType ? (
                    <p className="modal-closure-type-badge">{effectiveClosureType}</p>
                  ) : null}

                  <div className={`modal-closure-fields${showClosureReasonCategory ? ' modal-closure-fields--split' : ''}`}>
                    {showClosureReasonCategory ? (
                      <label className="modal-cancel-remark-field">
                        Reason
                        <select
                          value={closureDetails.reasonCategory}
                          onChange={(e) => onClosureDetailsChange({
                            ...closureDetails,
                            closureType: effectiveClosureType,
                            reasonCategory: e.target.value,
                            subReason: '',
                            remarks: '',
                          })}
                          required
                          disabled={!effectiveClosureType}
                        >
                          <option value="">Select reason</option>
                          {getClosureReasonCategories(effectiveClosureType, request.camp, closureStage).map((category) => (
                            <option key={category} value={category}>{category}</option>
                          ))}
                        </select>
                      </label>
                    ) : null}

                    <label className="modal-cancel-remark-field">
                      {showClosureReasonCategory ? 'Sub-reason' : 'Reason'}
                      <select
                        value={closureDetails.subReason}
                        onChange={(e) => onClosureDetailsChange({
                          ...closureDetails,
                          closureType: effectiveClosureType,
                          reasonCategory: effectiveReasonCategory,
                          subReason: e.target.value,
                          remarks: closureSubReasonRequiresRemarks(e.target.value)
                            ? closureDetails.remarks
                            : '',
                        })}
                        required
                        disabled={!effectiveReasonCategory}
                      >
                        <option value="">Select {showClosureReasonCategory ? 'sub-reason' : 'reason'}</option>
                        {getClosureSubReasons(
                          effectiveClosureType,
                          effectiveReasonCategory,
                        ).map((item) => (
                          <option key={item.value} value={item.value}>{item.label}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {closureSubReasonRequiresRemarks(closureDetails.subReason) && (
                    <label className="modal-cancel-remark-field">
                      Remarks
                      <textarea
                        rows={2}
                        value={closureDetails.remarks}
                        placeholder="Required for this sub-reason"
                        onChange={(e) => onClosureDetailsChange({
                          ...closureDetails,
                          closureType: effectiveClosureType,
                          reasonCategory: effectiveReasonCategory,
                          remarks: e.target.value,
                        })}
                        required
                      />
                    </label>
                  )}
                </div>
              </>
            )}

            {showCancelForm && (
              <>
                <CampSummary camp={request.camp} compact />

                <div className="modal-cancel-form">
                  <label className="modal-cancel-remark-field">
                    Cancelled by
                    <select
                      value={cancelDetails.cancelledBy}
                      onChange={(e) => onCancelDetailsChange({
                        ...cancelDetails,
                        cancelledBy: e.target.value,
                      })}
                      required
                    >
                      {CANCEL_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>

                  <label className="modal-cancel-remark-field">
                    Remark
                    <textarea
                      rows={3}
                      value={cancelDetails.remarks}
                      placeholder="Reason for cancellation"
                      onChange={(e) => onCancelDetailsChange({
                        ...cancelDetails,
                        remarks: e.target.value,
                      })}
                      required
                    />
                  </label>
                </div>
              </>
            )}
          </div>

          <div className="modal-actions">
            <button type="button" className="btn secondary" onClick={onCancel} disabled={loading}>
              Cancel
            </button>
            <button
              type="button"
              className={confirmButtonClass(copy.confirmClass)}
              onClick={onConfirm}
              disabled={confirmDisabled}
              aria-disabled={confirmDisabled}
            >
              {loading ? 'Processing...' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
