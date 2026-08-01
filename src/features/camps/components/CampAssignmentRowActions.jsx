import { useState } from 'react';
import { ClipboardCopy, User, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CampRowIconButton } from './CampRowIconButton';
import {
  canCancelOrRefuseCamp,
  cancelOrRefuseLabel,
  resolveCancelOrRefuseAction,
} from '../utils/campCancelRefuse';
import { isCampAssigned } from '../utils/campAssignmentActions';
import { copyCampAssignmentDetailsFromRecord } from '../utils/campAssignmentCopy';

const STAGE = 'assignment';

export function CampAssignmentRowActions({
  camp,
  canEdit,
  canRejectCamps,
  hasPermission,
  onAction,
}) {
  const [copyState, setCopyState] = useState('');
  const assigned = isCampAssigned(camp);
  const isTerminal = ['cancelled', 'rejected'].includes(camp.status);
  const showCross = canCancelOrRefuseCamp(camp, { hasPermission, canRejectCamps }, STAGE);
  const closeAction = resolveCancelOrRefuseAction(camp, STAGE);
  const closeLabel = cancelOrRefuseLabel(camp, STAGE);

  async function handleCopyDetails() {
    const didCopy = await copyCampAssignmentDetailsFromRecord(camp);
    if (!didCopy) return;
    setCopyState('copied');
    window.setTimeout(() => setCopyState(''), 2000);
  }

  if (!canEdit && !showCross && !assigned) {
    return <span className="camps-cell-empty">—</span>;
  }

  return (
    <div className="actions camp-row-actions camp-row-icon-actions">
      {canEdit && !isTerminal && (
        <Link
          to={`/camps/manage/${camp._id}/edit`}
          className="camp-row-icon-btn camp-row-icon-btn--assign"
          title="Open assignment"
          aria-label="Open assignment"
        >
          <span className="camp-row-icon-btn__glyph" aria-hidden="true">
            <User size={17} strokeWidth={2} />
          </span>
        </Link>
      )}
      {assigned && (
        <CampRowIconButton
          icon={ClipboardCopy}
          label={copyState === 'copied' ? 'Copied' : 'Copy details'}
          variant="neutral"
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
    </div>
  );
}
