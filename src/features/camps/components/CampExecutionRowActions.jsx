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

const STAGE = 'execution';

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
  const showTick = !isTerminal && !isExecuted && canExecute;
  const showEye = showTick && executeDisabled;
  const showCross = canCancelOrRefuseCamp(camp, { hasPermission, canRejectCamps }, STAGE);
  const closeAction = resolveCancelOrRefuseAction(camp, STAGE);
  const closeLabel = cancelOrRefuseLabel(camp, STAGE);

  if (!showTick && !showCross && !canEdit) {
    return <span className="camps-cell-empty">—</span>;
  }

  return (
    <>
      <div className="actions camp-row-actions camp-row-icon-actions">
        {showTick && (
          <CampRowIconButton
            icon={Check}
            label={executeDisabled ? 'Cannot mark executed yet' : 'Mark executed'}
            variant="approve"
            disabled={executeDisabled}
            onClick={onExecute}
          />
        )}
        {showEye && (
          <CampRowIconButton
            icon={Eye}
            label="View execution issues"
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
