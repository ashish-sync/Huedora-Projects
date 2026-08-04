import { Link } from 'react-router-dom';
import { useAuth } from '../../shared/auth.jsx';
import FinanceDocumentsList from './FinanceDocumentsList.jsx';
import { FinanceBuilderCreateSelect } from './FinanceBuilderTiles.jsx';
import { canManageOrganisationMaster } from './builder/commercialApproval.js';
import './finance-commercial.css';

/** Billing Center — create commercial documents + review saved ones. */
export default function FinanceBuilderPickerPage() {
  const { can, user } = useAuth();
  const canWrite = can('finance:write') || can('*');
  const canOrgMaster = canManageOrganisationMaster(user);

  return (
    <div className="finance-hub finance-billing-center">
      {canWrite ? (
        <section className="finance-hub-panel card finance-hub-panel--picker">
          <div className="finance-hub-create finance-hub-create--standalone">
            <p className="finance-hub-section-label">Create document</p>
            <FinanceBuilderCreateSelect />
          </div>
        </section>
      ) : (
        <section className="finance-hub-panel card finance-hub-panel--picker">
          <div className="finance-hub-create finance-hub-create--standalone">
            <p className="finance-hub-section-label">Billing Center</p>
            <p className="finance-hub-picker-lead muted">
              View saved documents below. Ask an administrator for Finance write access to create new ones.
            </p>
            {canOrgMaster ? (
              <Link to="/finance-one/organisation" className="btn secondary btn-compact">
                Organisation master
              </Link>
            ) : null}
          </div>
        </section>
      )}

      <section className="finance-hub-panel card">
        <FinanceDocumentsList embedded showCreateLink={false} />
      </section>
    </div>
  );
}