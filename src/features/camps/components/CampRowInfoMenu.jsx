import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertBadge, RequestReviewStatusBadge } from './DashboardWidgets';
import { formatClosureSummary } from '../constants/campClosure';
import { formatDateTimeDDMMYYYY, formatOverdueExecutionMessage } from '../utils/dateFormat';

function formatDateTime(value) {
  return formatDateTimeDDMMYYYY(value);
}

function formatCancelledBy(value) {
  if (value === 'brand') return 'Brand';
  if (value === 'khw') return 'KHW';
  return value || '—';
}

function DetailRow({ label, children, alert = false }) {
  return (
    <div className={`camp-info-detail-row${alert ? ' camp-info-detail-row-alert' : ''}`}>
      <dt className="camp-info-label">{label}</dt>
      <dd className="camp-info-value">{children}</dd>
    </div>
  );
}

function SectionDivider() {
  return <div className="camp-info-divider" role="separator" />;
}

function isCampClosed(camp = {}) {
  return ['cancelled', 'rejected'].includes(camp.status);
}

export function CampRowInfoMenu({
  camp,
  hasPermission,
  canRejectCamps = false,
  isSuperAdmin,
  onAction,
  showStageActions = true,
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;

    function handleEscape(event) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [open]);

  const approvalBlockers = camp.status === 'pending_review' ? (camp.approvalBlockers || []) : [];
  const hasApprovalAlert = approvalBlockers.length > 0;
  const showReject = showStageActions && camp.status === 'pending_review' && canRejectCamps;
  const showRequestInformation = showStageActions && camp.status === 'pending_review' && hasPermission('camps:approve');
  const showDelete = showStageActions && isSuperAdmin();
  const showCloseCamp = showStageActions
    && !isCampClosed(camp)
    && (hasPermission('camps:cancel') || hasPermission('camps:approve'));
  const closureSummary = formatClosureSummary(camp);
  const hasOverdueNotice = camp.isOverdue && camp.endsAt;
  const hasAlert = camp.alertLevel && camp.alertLevel !== 'none';
  const hasDetails = camp.submittedAt
    || camp.requestReviewStatusLabel
    || camp.requestReviewStatus
    || camp.informationRequestNote
    || camp.rejectionReason
    || closureSummary
    || hasOverdueNotice
    || (camp.status === 'cancelled' && (camp.cancelledBy || camp.remarks))
    || hasAlert;
  const hasActions = showReject || showDelete || showCloseCamp || showRequestInformation;
  const showEmptyState = !hasApprovalAlert && !hasDetails && !hasActions;

  function runAction(action) {
    setOpen(false);
    onAction(camp._id, action);
  }

  const modal = open ? (
    <div className="camp-ops-root camp-info-portal-root">
      <div
        className="modal-overlay camp-info-modal-overlay"
        onClick={() => setOpen(false)}
      >
        <div
          className="modal-card camp-info-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="camp-info-modal-title"
          onClick={(event) => event.stopPropagation()}
        >
          <header className="camp-info-modal-header">
            <div className="camp-info-modal-heading">
              <h2 id="camp-info-modal-title">Camp details</h2>
              {camp.campId && (
                <p className="camp-info-modal-subtitle">{camp.campId}</p>
              )}
            </div>
            <button
              type="button"
              className="camp-info-modal-close"
              aria-label="Close camp details"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </header>

          <div className="camp-info-modal-body">
            {hasApprovalAlert && (
              <section className="camp-info-section camp-info-section-alert" aria-label="Approval alerts">
                <p className="camp-info-section-title">Approval alert</p>
                <ul className="camp-info-blocker-list">
                  {approvalBlockers.map((message) => (
                    <li key={message} className="camp-info-blocker-item">
                      <span className="camp-info-blocker-icon" aria-hidden="true">!</span>
                      <span>{message}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {hasDetails && (
              <section className="camp-info-section camp-info-details" aria-label="Camp information">
                <dl className="camp-info-details-list">
                  {camp.submittedAt && (
                    <DetailRow label="Submitted">{formatDateTime(camp.submittedAt)}</DetailRow>
                  )}
                  {(camp.requestReviewStatusLabel || camp.requestReviewStatus) && (
                    <DetailRow label="Request status">
                      <RequestReviewStatusBadge camp={camp} />
                    </DetailRow>
                  )}
                  {camp.informationRequestNote && (
                    <DetailRow label="Info requested">{camp.informationRequestNote}</DetailRow>
                  )}
                  {camp.rejectionReason && (
                    <DetailRow label="Rejection reason">{camp.rejectionReason}</DetailRow>
                  )}
                  {closureSummary && (
                    <DetailRow label="Closure">{closureSummary}</DetailRow>
                  )}
                  {hasOverdueNotice && (
                    <DetailRow label="Overdue" alert>
                      {formatOverdueExecutionMessage(camp.endsAt)}
                    </DetailRow>
                  )}
                  {camp.status === 'cancelled' && camp.cancelledBy && (
                    <DetailRow label="Cancelled by">{formatCancelledBy(camp.cancelledBy)}</DetailRow>
                  )}
                  {camp.status === 'cancelled' && camp.remarks && (
                    <DetailRow label="Cancel remark">{camp.remarks}</DetailRow>
                  )}
                  {hasAlert && (
                    <DetailRow label="Alert" alert>
                      <AlertBadge alertLevel={camp.alertLevel} alertReason={camp.alertReason} />
                    </DetailRow>
                  )}
                </dl>
                {camp.alertReason && hasAlert && (
                  <p className="camp-info-note">{camp.alertReason}</p>
                )}
              </section>
            )}

            {showEmptyState && (
              <p className="camp-info-note camp-info-empty">No extra details for this camp.</p>
            )}
          </div>

          {hasActions && (
            <footer className="camp-info-modal-footer">
              <div className="camp-info-actions">
                {showCloseCamp && (
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => runAction('closeCamp')}>
                    Cancel / Refuse camp
                  </button>
                )}
                {showRequestInformation && (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => runAction('requestInformation')}>
                    Request more information
                  </button>
                )}
                {showReject && (
                  <button type="button" className="btn btn-danger btn-sm camp-info-action-outline" onClick={() => runAction('reject')}>
                    Reject
                  </button>
                )}
                {showDelete && (
                  <button type="button" className="btn btn-danger btn-sm camp-info-action-outline" onClick={() => runAction('delete')}>
                    Delete
                  </button>
                )}
              </div>
            </footer>
          )}
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className="camp-info-menu">
      <button
        type="button"
        className="camp-info-btn"
        aria-label="Camp details and actions"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        i
      </button>
      {modal && createPortal(modal, document.body)}
    </div>
  );
}
