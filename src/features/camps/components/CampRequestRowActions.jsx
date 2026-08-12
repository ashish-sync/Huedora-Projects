import { useState } from 'react';
import { Check, Eye, Pencil, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CampAdminDeleteButton } from './CampAdminDeleteButton';
import { CampRowIconButton } from './CampRowIconButton';
import { CampIssuesModal } from './CampIssuesModal';
import {
  canCancelOrRefuseCamp,
  cancelOrRefuseLabel,
  resolveCancelOrRefuseAction,
} from '../utils/campCancelRefuse';

const STAGE = 'request';

export function CampRequestRowActions({
  camp,
  canEdit,
  canApprove,
  canRejectCamps,
  hasPermission,
  canDelete = false,
  onApprove,
  onAction,
}) {
  const [issuesOpen, setIssuesOpen] = useState(false);
  const isPendingReview = camp.status === 'pending_review';
  const blockers = Array.isArray(camp.approvalBlockers) ? camp.approvalBlockers : [];
  const approveDisabled = camp.canApprove === false;
  const showTick = isPendingReview && canApprove;
  const showEye = showTick && approveDisabled;
  const showCross = canCancelOrRefuseCamp(camp, { hasPermission, canRejectCamps }, STAGE);
  const closeAction = resolveCancelOrRefuseAction(camp, STAGE);
  const closeLabel = cancelOrRefuseLabel(camp, STAGE);

  if (!showTick && !showCross && !canEdit && !canDelete) {
    return <span className="camps-cell-empty">—</span>;
  }

  return (
    <>
      <div className="actions camp-row-actions camp-row-icon-actions">
        {showTick && (
          <CampRowIconButton
            icon={Check}
            label={approveDisabled ? 'Cannot approve yet' : 'Approve camp'}
            variant="approve"
            disabled={approveDisabled}
            onClick={onApprove}
          />
        )}
        {showEye && (
          <CampRowIconButton
            icon={Eye}
            label="View approval issues"
            variant="issues"
            onClick={() => setIssuesOpen(true)}
          />
        )}
        {showCross && (
          <CampRowIconButton
            icon={X}
            label={closeLabel}
            variant="refuse"
            onClick={() => onAction(camp._id, closeAction)}
          />
        )}
        {canEdit && (
          <Link
            to={`/camp-one/manage/${camp._id}/edit`}
            className="camp-row-icon-btn camp-row-icon-btn--edit"
            title="Edit camp"
            aria-label="Edit camp"
          >
            <span className="camp-row-icon-btn__glyph" aria-hidden="true">
              <Pencil size={17} strokeWidth={2} />
            </span>
          </Link>
        )}
        <CampAdminDeleteButton canDelete={canDelete} campId={camp._id} onDelete={onAction} />
      </div>
      {issuesOpen && (
        <CampIssuesModal
          camp={camp}
          blockers={blockers}
          onClose={() => setIssuesOpen(false)}
          title="Approval blocked"
          lead="Resolve these items before this camp can be approved:"
          fallbackMessage="This camp cannot be approved yet. Open the camp record to review missing or invalid details."
        />
      )}
    </>
  );
}
