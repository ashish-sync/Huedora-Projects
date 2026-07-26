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
import { canMarkCampExecuted, getExecutionBlockers } from '../utils/campExecutionActions';

export function CampExecutionRowActions({
  camp,
  canEdit,
  canExecute,
  canRejectCamps,
  hasPermission,
  onExecute,
  onAction,
}) {
  const [issuesOpen, setIssuesOpen] = useState(false);
  const blockers = getExecutionBlockers(camp);
  const executeDisabled = !canMarkCampExecuted(camp);
  const isTerminal = ['cancelled', 'rejected'].includes(camp.status);
  const isExecuted = camp.status === 'executed';
  const showExecute = !isTerminal && !isExecuted && canExecute;
  const showIssues = showExecute && executeDisabled;
  const showRefuse = canCancelOrRefuseCamp(camp, { hasPermission, canRejectCamps });
  const refuseAction = resolveCancelOrRefuseAction(camp);
  const refuseLabel = cancelOrRefuseLabel(camp);

  return (
    <>
      <div className="actions camp-row-actions camp-row-icon-actions">
        {showExecute && (
          <CampRowIconButton
            icon={Check}
            label={executeDisabled ? 'Cannot mark executed yet' : 'Mark executed'}
            variant="approve"
            disabled={executeDisabled}
            onClick={onExecute}
          />
        )}
        {showIssues && (
          <CampRowIconButton
            icon={Eye}
            label="View execution issues"
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
          title="Execution blocked"
          lead="Resolve these items before this camp can be marked executed:"
          fallbackMessage="This camp cannot be marked executed yet."
        />
      )}
    </>
  );
}
