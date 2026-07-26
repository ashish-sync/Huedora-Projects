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
  className = '',
}) {
  if (!canCancelOrRefuseCamp(camp, { hasPermission, canRejectCamps })) {
    return null;
  }

  const action = resolveCancelOrRefuseAction(camp);
  const label = cancelOrRefuseLabel(camp);

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
