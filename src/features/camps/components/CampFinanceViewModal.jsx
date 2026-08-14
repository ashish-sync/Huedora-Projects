import { createPortal } from 'react-dom';
import { financialWorkflowStatus } from '../constants/campWorkflowStatuses.js';
import { formatDateDDMMYYYY } from '../utils/dateFormat.js';

function DetailRow({ label, children }) {
  return (
    <div className="modal-camp-summary-row">
      <span>{label}</span>
      <strong>{children || '—'}</strong>
    </div>
  );
}

export function CampFinanceViewModal({ camp, onClose }) {
  if (!camp) return null;

  const paymentStatus = financialWorkflowStatus(camp).label;
  return createPortal(
    <div className="camp-ops-root camp-info-portal-root">
      <div className="modal-overlay camp-info-modal-overlay" onClick={onClose}>
        <div
          className="modal-card camp-approval-issues-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="camp-finance-modal-title"
          onClick={(event) => event.stopPropagation()}
        >
          <header className="camp-approval-issues-header">
            <div>
              <h2 id="camp-finance-modal-title">Finance settlement</h2>
              {camp.campId && <p className="camp-approval-issues-subtitle">{camp.campId}</p>}
            </div>
            <button type="button" className="camp-info-modal-close" aria-label="Close" onClick={onClose}>
              ×
            </button>
          </header>
          <div className="camp-approval-issues-body">
            <div className="modal-camp-summary modal-camp-summary-grid">
              <DetailRow label="Payment status">{paymentStatus}</DetailRow>
              <DetailRow label="UTR / Transaction ID">{camp.transactionId || '—'}</DetailRow>
              <DetailRow label="Submitted to finance">
                {camp.submittedToFinanceAt
                  ? formatDateDDMMYYYY(camp.submittedToFinanceAt)
                  : '—'}
              </DetailRow>
              {camp.paymentRemark ? (
                <DetailRow label="Payment remark">{camp.paymentRemark}</DetailRow>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
