import { useState } from 'react';
import { Check, Eye, X } from 'lucide-react';
import { CampRowIconButton } from './CampRowIconButton';
import { CampIssuesModal } from './CampIssuesModal';
import {
  canCancelOrRefuseCamp,
  cancelOrRefuseLabel,
  resolveCancelOrRefuseAction,
} from '../utils/campCancelRefuse';
import { canAssignCamp, getAssignmentBlockers } from '../utils/campAssignmentActions';

export function CampAssignmentRowActions({
  camp,
  canRejectCamps,
  hasPermission,
  onAction,
  onAssign,
}) {
  const [issuesOpen, setIssuesOpen] = useState(false);
  const blockers = getAssignmentBlockers(camp);
  const assignDisabled = !canAssignCamp(camp);
  const isTerminal = ['cancelled', 'rejected'].includes(camp.status);
  const showAssign = !isTerminal;
  const showIssues = showAssign && assignDisabled;
  const showRefuse = canCancelOrRefuseCamp(camp, { hasPermission, canRejectCamps });
  const refuseAction = resolveCancelOrRefuseAction(camp);
  const refuseLabel = cancelOrRefuseLabel(camp);

  return (
    <>
      <div className="actions camp-row-actions camp-row-icon-actions">
        {showAssign && (
          <CampRowIconButton
            icon={Check}
            label={assignDisabled ? 'Cannot assign yet' : 'Assign resource'}
            variant="approve"
            disabled={assignDisabled}
            onClick={() => onAssign?.(camp)}
          />
        )}
        {showIssues && (
          <CampRowIconButton
            icon={Eye}
            label="View assignment issues"
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
      </div>
      {issuesOpen && (
        <CampIssuesModal
          camp={camp}
          blockers={blockers}
          onClose={() => setIssuesOpen(false)}
          title="Assignment blocked"
          lead="Resolve these items before a resource can be assigned:"
          fallbackMessage="This camp cannot be assigned yet."
        />
      )}
    </>
  );
}
