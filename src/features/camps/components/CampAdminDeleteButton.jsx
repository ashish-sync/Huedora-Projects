import { Trash2 } from 'lucide-react';
import { CampRowIconButton } from './CampRowIconButton';

export function CampAdminDeleteButton({ canDelete, onDelete, campId }) {
  if (!canDelete) return null;

  return (
    <CampRowIconButton
      icon={Trash2}
      label="Delete camp"
      variant="refuse"
      onClick={() => onDelete(campId, 'delete')}
    />
  );
}
