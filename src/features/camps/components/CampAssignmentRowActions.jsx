import { Check, X } from 'lucide-react';
import { CampRowIconButton } from './CampRowIconButton';
import {
  canCancelOrRefuseCamp,
  cancelOrRefuseLabel,
  resolveCancelOrRefuseAction,
} from '../utils/campCancelRefuse';
import { canAssignCamp } from '../utils/campAssignmentActions';

const STAGE = 'assignment';

export function CampAssignmentRowActions({
  camp,
  canRejectCamps,
  hasPermission,
  onAction,
  onAssign,
}) {
  const assignDisabled = !canAssignCamp(camp);
  const isTerminal = ['cancelled', 'rejected'].includes(camp.status);
  const showTick = !isTerminal;
  const showCross = canCancelOrRefuseCamp(camp, { hasPermission, canRejectCamps }, STAGE);
  const closeAction = resolveCancelOrRefuseAction(camp, STAGE);
  const closeLabel = cancelOrRefuseLabel(camp, STAGE);

  if (!showTick && !showCross) {
    return <span className="camps-cell-empty">—</span>;
  }

  return (
    <div className="actions camp-row-actions camp-row-icon-actions">
      {showTick && (
        <CampRowIconButton
          icon={Check}
          label={assignDisabled ? 'Cannot assign yet' : 'Assign resource'}
          variant="approve"
          disabled={assignDisabled}
          onClick={() => onAssign?.(camp)}
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
