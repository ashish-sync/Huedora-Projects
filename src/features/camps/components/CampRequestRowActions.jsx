import { useState } from 'react';
import { Check, Eye, Pencil, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CampRowIconButton } from './CampRowIconButton';
import { CampIssuesModal } from './CampIssuesModal';
import {
  canCancelOrRefuseCamp,
  cancelOrRefuseLabel,
  resolveCancelOrRefuseAction,
} from '../utils/campCancelRefuse';

export function CampRequestRowActions({
  camp,
  canEdit,
  canApprove,
  canRejectCamps,
  hasPermission,
  onApprove,
  onAction,
}) {
  const [issuesOpen, setIssuesOpen] = useState(false);
  const isPendingReview = camp.status === 'pending_review';
  const blockers = Array.isArray(camp.approvalBlockers) ? camp.approvalBlockers : [];
  const approveDisabled = camp.canApprove === false;
  const showApprove = isPendingReview && canApprove;
  const showIssues = isPendingReview && canApprove && approveDisabled;
  const showRefuse = canCancelOrRefuseCamp(camp, { hasPermission, canRejectCamps });
  const refuseAction = resolveCancelOrRefuseAction(camp);
  const refuseLabel = cancelOrRefuseLabel(camp);

  return (
    <>
      <div className="actions camp-row-actions camp-row-icon-actions">
        {showApprove && (
          <CampRowIconButton
            icon={Check}
            label={approveDisabled ? 'Cannot approve yet' : 'Approve camp'}
            variant="approve"
            disabled={approveDisabled}
            onClick={onApprove}
          />
        )}
        {showIssues && (
          <CampRowIconButton
            icon={Eye}
            label="View approval issues"
            variant="issues"
            onClick={() => setIssuesOpen(true)}
          />
        )}
        {showRefuse && (
          <CampRowIconButton
            icon={X}
            label={refuseLabel}
            variant="refuse"
            onClick={() => onAction(camp._id, refuseAction)}
          />
        )}
        {canEdit && (
          <Link
            to={`/camps/manage/${camp._id}/edit`}
            className="camp-row-icon-btn camp-row-icon-btn--edit"
            title="Edit camp"
            aria-label="Edit camp"
          >
            <Pencil size={17} strokeWidth={2} aria-hidden="true" />
          </Link>
        )}
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
