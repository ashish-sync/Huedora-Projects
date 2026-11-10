import { Check, Pencil, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CampAdminDeleteButton } from './CampAdminDeleteButton';
import { CampRowIconButton } from './CampRowIconButton';
import { CampRowInfoMenu } from './CampRowInfoMenu';
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
  const isPendingReview = camp.status === 'pending_review';
  const blockers = Array.isArray(camp.approvalBlockers) ? camp.approvalBlockers : [];
  const approveDisabled = camp.canApprove === false;
  const showTick = isPendingReview && canApprove;
  const showCross = canCancelOrRefuseCamp(camp, { hasPermission, canRejectCamps }, STAGE);
  const closeAction = resolveCancelOrRefuseAction(camp, STAGE);
  const closeLabel = cancelOrRefuseLabel(camp, STAGE);
  const showInfo = typeof hasPermission === 'function';
  const approveTitle = approveDisabled
    ? (blockers.length ? blockers.join(' · ') : 'Cannot approve yet — open camp details for more')
    : 'Approve camp';

  if (!showTick && !showCross && !canEdit && !canDelete && !showInfo) {
    return <span className="camps-cell-empty">—</span>;
  }

  return (
    <div className="actions camp-row-actions camp-row-icon-actions">
      {showTick && (
        <CampRowIconButton
          icon={Check}
          label={approveTitle}
          variant="approve"
          disabled={approveDisabled}
          onClick={onApprove}
        />
      )}
      {showInfo ? (
        <CampRowInfoMenu
          camp={camp}
          hasPermission={hasPermission}
          onAction={onAction}
        />
      ) : null}
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
  );
}
