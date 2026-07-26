import { Pencil } from 'lucide-react';
import { Link } from 'react-router-dom';

export function CampFinancialRowActions({ camp, canEdit }) {
  if (!canEdit) {
    return <span className="camps-cell-empty">—</span>;
  }

  return (
    <div className="actions camp-row-actions camp-row-icon-actions">
      <Link
        to={`/camps/manage/${camp._id}/edit`}
        className="camp-row-icon-btn camp-row-icon-btn--edit"
        title="Edit camp"
        aria-label="Edit camp"
      >
        <Pencil size={17} strokeWidth={2} aria-hidden="true" />
      </Link>
    </div>
  );
}
