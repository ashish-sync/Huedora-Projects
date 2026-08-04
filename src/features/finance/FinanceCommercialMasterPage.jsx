import { useEffect, useState } from 'react';
import { FeedbackAlerts } from '../../components/ui/FeedbackBanner.jsx';
import { Link } from 'react-router-dom';
import { useAuth } from '../../shared/auth.jsx';
import { emptyOrgMasterForm, orgMasterToPayload } from './commercialOrgMaster.js';
import { CommercialOrgMasterForm } from './CommercialOrgMasterCard.jsx';
import { canManageOrganisationMaster } from './builder/commercialApproval.js';
import { useCommercialOrgMaster } from './useCommercialOrgMaster.js';
import './finance-commercial.css';

export default function FinanceCommercialMasterPage() {
  const { can, user } = useAuth();
  const canWrite = can('finance:write') || can('*');
  const canEdit = canWrite && canManageOrganisationMaster(user);
  const { data, loading, error, save, reload } = useCommercialOrgMaster();
  const [form, setForm] = useState(emptyOrgMasterForm);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data) {
      setForm({
        ...emptyOrgMasterForm(),
        ...data,
      });
    }
  }, [data]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!canEdit) return;
    setBusy(true);
    setMsg('');
    try {
      await save(orgMasterToPayload(form));
      setMsg('Organisation master saved. All document types will use these details.');
    } catch {
      /* error from hook */
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="finance-org-master-page">
      <header className="finance-org-master-header">
        <div className="finance-org-master-header-text">
          <h2 className="finance-org-master-heading">Organisation master</h2>
          <p className="finance-org-master-lead">
            Letterhead, bank, and tax details shared by Invoice, PO, Proforma, and Credit Note.
          </p>
        </div>
        <div className="finance-org-master-actions finance-org-master-actions--top">
          <Link to="/finance/build" className="btn secondary btn-compact">
            Back
          </Link>
          <button type="button" className="btn secondary btn-compact" disabled={loading || busy} onClick={() => reload()}>
            Reload
          </button>
          {canEdit ? (
            <button type="submit" form="org-master-form" className="btn btn-compact" disabled={busy}>
              {busy ? 'Saving…' : 'Save'}
            </button>
          ) : null}
        </div>
      </header>

      {(error || msg) && <FeedbackAlerts error={error} message={msg} />}

      {!canEdit ? (
        <p className="finance-org-master-readonly muted">
          View-only. Organisation master can be edited by Admin, Operations Head, Senior Manager, or Manager.
        </p>
      ) : null}

      <form id="org-master-form" className="finance-org-master-form-wrap" onSubmit={handleSave}>
        <CommercialOrgMasterForm form={form} setForm={setForm} disabled={!canEdit || busy} />
      </form>
    </div>
  );
}
