import { useState } from 'react';
import { ClipboardCopy, Check, Pencil, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CampAdminDeleteButton } from './CampAdminDeleteButton';
import { CampRowIconButton } from './CampRowIconButton';
import {
  canCancelOrRefuseCamp,
  cancelOrRefuseLabel,
  resolveCancelOrRefuseAction,
} from '../utils/campCancelRefuse';
import { isCampAssigned } from '../utils/campAssignmentActions';
import { copyCampAssignmentDetailsFromRecord } from '../utils/campAssignmentCopy';

const STAGE = 'execution';

export function CampExecutionRowActions({
  camp,
  canEdit,
  canRejectCamps,
  hasPermission,
  canDelete = false,
  onAction,
}) {
  const [copyState, setCopyState] = useState('');
  const [copyHint, setCopyHint] = useState('');
  const assigned = isCampAssigned(camp);
  const isTerminal = ['cancelled', 'rejected'].includes(camp.status);
  const showCopy = assigned && !isTerminal;
  const showCross = canCancelOrRefuseCamp(camp, { hasPermission, canRejectCamps }, STAGE);
  const closeAction = resolveCancelOrRefuseAction(camp, STAGE);
  const closeLabel = cancelOrRefuseLabel(camp, STAGE);

  async function handleCopyDetails() {
    const result = await copyCampAssignmentDetailsFromRecord(camp);
    if (!result?.copied) return;
    setCopyState(result.activityFormUrl ? 'copied' : 'partial');
    setCopyHint(result.activityFormUrl
      ? 'Copied with Activity Form'
      : (result.activityFormError || 'Copied — Activity Form unavailable'));
    window.setTimeout(() => {
      setCopyState('');
      setCopyHint('');
    }, 3500);
  }

  if (!showCopy && !showCross && !canEdit && !canDelete) {
    return <span className="camps-cell-empty">—</span>;
  }

  return (
    <div className="actions camp-row-actions camp-row-icon-actions">
      {showCopy && (
        <CampRowIconButton
          icon={copyState === 'copied' || copyState === 'partial' ? Check : ClipboardCopy}
          label={copyHint || (copyState === 'copied'
            ? 'Copied with Activity Form'
            : copyState === 'partial'
              ? 'Copied — Activity Form unavailable'
              : 'Copy details')}
          variant={copyState === 'copied' ? 'approve' : copyState === 'partial' ? 'issues' : 'neutral'}
          onClick={handleCopyDetails}
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
  );
}
