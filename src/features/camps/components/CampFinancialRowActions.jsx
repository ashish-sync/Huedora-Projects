import { useState } from 'react';
import { Eye, Pencil } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CampRowIconButton } from './CampRowIconButton';
import { CampFinanceViewModal } from './CampFinanceViewModal';

export function CampFinancialRowActions({ camp, canEdit }) {
  const [financeOpen, setFinanceOpen] = useState(false);

  return (
    <>
      <div className="actions camp-row-actions camp-row-icon-actions">
        <CampRowIconButton
          icon={Eye}
          label="View payment status and UTR"
          variant="issues"
          onClick={() => setFinanceOpen(true)}
        />
        {canEdit && (
          <Link
            to={`/camps/manage/${camp._id}/edit`}
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
      {financeOpen && (
        <CampFinanceViewModal
          camp={camp}
          onClose={() => setFinanceOpen(false)}
        />
      )}
    </>
  );
}
