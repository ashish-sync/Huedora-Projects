import { X } from 'lucide-react';
import { CampRowIconButton } from './CampRowIconButton';
import {
  canCancelOrRefuseCamp,
  cancelOrRefuseLabel,
  resolveCancelOrRefuseAction,
} from '../utils/campCancelRefuse.js';

export function CampCancelRefuseButton({
  camp,
  hasPermission,
  canRejectCamps,
  onAction,
  stage = '',
  className = '',
}) {
  if (!canCancelOrRefuseCamp(camp, { hasPermission, canRejectCamps }, stage)) {
    return null;
  }

  const action = resolveCancelOrRefuseAction(camp, stage);
  const label = cancelOrRefuseLabel(camp, stage);

  return (
    <CampRowIconButton
      icon={X}
      label={label}
      variant="refuse"
      className={className}
      onClick={() => onAction(camp._id, action)}
    />
  );
}
