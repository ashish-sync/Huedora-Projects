import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertBadge } from './DashboardWidgets';
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
      <span className="camp-info-label">{label}</span>
      <span className="camp-info-value">{children}</span>
    </div>
  );
}

function SectionDivider() {
  return <div className="camp-info-divider" role="separator" />;
}

export function CampRowInfoMenu({
  camp,
  hasPermission,
  canRejectCamps = false,
  isSuperAdmin,
  onAction,
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;

    function handleEscape(event) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  const approvalBlockers = camp.status === 'pending_review' ? (camp.approvalBlockers || []) : [];
  const hasApprovalAlert = approvalBlockers.length > 0;
  const showReject = camp.status === 'pending_review' && canRejectCamps;
  const showDelete = (
    ((hasPermission('camps:update') || hasPermission('camps:approve')) && camp.status !== 'executed')
    || (isSuperAdmin() && camp.status === 'executed')
  );
  const showCancel = camp.status === 'approved'
    && (hasPermission('camps:cancel') || hasPermission('camps:approve'));
  const hasOverdueNotice = camp.isOverdue && camp.endsAt;
  const hasAlert = camp.alertLevel && camp.alertLevel !== 'none';
  const hasDetails = camp.submittedAt
    || hasOverdueNotice
    || (camp.status === 'cancelled' && (camp.cancelledBy || camp.remarks))
    || hasAlert;
  const hasActions = showReject || showDelete || showCancel;
  const showEmptyState = !hasApprovalAlert && !hasDetails && !hasActions;

  function runAction(action) {
    setOpen(false);
    onAction(camp._id, action);
  }

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
      {open && createPortal(
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
            <div className="camp-info-modal-header">
              <div>
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
            </div>

            {hasApprovalAlert && (
              <>
                <div className="camp-info-section camp-info-section-alert">
                  <p className="camp-info-section-title">Approval alert</p>
                  {approvalBlockers.map((message) => (
                    <p key={message} className="camp-info-note camp-info-error">{message}</p>
                  ))}
                </div>
                {(hasDetails || hasActions || showEmptyState) && <SectionDivider />}
              </>
            )}

            {hasDetails && (
              <div className="camp-info-section camp-info-details">
                {camp.submittedAt && (
                  <DetailRow label="Submitted">{formatDateTime(camp.submittedAt)}</DetailRow>
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
                {camp.alertReason && hasAlert && (
                  <p className="camp-info-note">{camp.alertReason}</p>
                )}
              </div>
            )}

            {showEmptyState && (
              <p className="camp-info-note camp-info-empty">No extra details for this camp.</p>
            )}

            {hasActions && (
              <>
                {(hasApprovalAlert || hasDetails || showEmptyState) && <SectionDivider />}
                <div className="camp-info-actions">
                  {showCancel && (
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => runAction('cancel')}>
                      Cancel
                    </button>
                  )}
                  {showReject && (
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => runAction('reject')}>
                      Reject
                    </button>
                  )}
                  {showDelete && (
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => runAction('delete')}>
                      Delete
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
