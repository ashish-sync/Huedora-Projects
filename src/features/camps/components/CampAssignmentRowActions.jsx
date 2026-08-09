import { useState } from 'react';
import { ClipboardCopy, UserCheck, Briefcase, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { CampRowIconButton } from './CampRowIconButton';
import {
  canCancelOrRefuseCamp,
  cancelOrRefuseLabel,
  resolveCancelOrRefuseAction,
} from '../utils/campCancelRefuse';
import { isCampAssigned } from '../utils/campAssignmentActions';
import { copyCampAssignmentDetailsFromRecord } from '../utils/campAssignmentCopy';
import { buildCampHireRequestPath } from '../utils/campHireRequest.js';

const STAGE = 'assignment';

export function CampAssignmentRowActions({
  camp,
  canEdit,
  canRejectCamps,
  hasPermission,
  onAction,
}) {
  const navigate = useNavigate();
  const [copyState, setCopyState] = useState('');
  const assigned = isCampAssigned(camp);
  const isTerminal = ['cancelled', 'rejected'].includes(camp.status);
  const showCross = canCancelOrRefuseCamp(camp, { hasPermission, canRejectCamps }, STAGE);
  const closeAction = resolveCancelOrRefuseAction(camp, STAGE);
  const closeLabel = cancelOrRefuseLabel(camp, STAGE);
  const canHireRequest = !isTerminal && camp.status === 'approved';

  async function handleCopyDetails() {
    const didCopy = await copyCampAssignmentDetailsFromRecord(camp);
    if (!didCopy) return;
    setCopyState('copied');
    window.setTimeout(() => setCopyState(''), 2000);
  }

  function handleHireRequest() {
    navigate(buildCampHireRequestPath(camp));
  }

  if (!canEdit && !showCross && !assigned && !canHireRequest) {
    return <span className="camps-cell-empty">—</span>;
  }

  return (
    <div className="actions camp-row-actions camp-row-icon-actions">
      {canEdit && !isTerminal && (
        <Link
          to={`/camp-one/manage/${camp._id}/edit`}
          className="camp-row-icon-btn camp-row-icon-btn--assign"
          title={assigned ? 'Change healthcare worker' : 'Assign healthcare worker'}
          aria-label={assigned ? 'Change healthcare worker' : 'Assign healthcare worker'}
        >
          <span className="camp-row-icon-btn__glyph" aria-hidden="true">
            <UserCheck size={17} strokeWidth={2} />
          </span>
        </Link>
      )}
      {canHireRequest && (
        <CampRowIconButton
          icon={Briefcase}
          label="Raise hiring request in Request One"
          variant="hire"
          onClick={handleHireRequest}
        />
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
