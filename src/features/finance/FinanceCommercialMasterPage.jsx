import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../shared/auth.jsx';
import { emptyOrgMasterForm, orgMasterToPayload } from './commercialOrgMaster.js';
import { CommercialOrgMasterForm } from './CommercialOrgMasterCard.jsx';
import { useCommercialOrgMaster } from './useCommercialOrgMaster.js';
import './finance-commercial.css';

export default function FinanceCommercialMasterPage() {
  const { can } = useAuth();
  const canWrite = can('finance:write') || can('*');
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
    if (!canWrite) return;
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
      <div className="finance-org-master-intro card">
        <div>
          <h2 className="finance-org-master-heading">Organisation master</h2>
          <p className="muted finance-org-master-lead">
            Fixed letterhead, bank, and payment details shared across{' '}
            <strong>Invoice</strong>, <strong>Purchase Order</strong>, <strong>Proforma</strong>, and{' '}
            <strong>Credit Note</strong>. Edit once here — every document picks it up automatically.
          </p>
        </div>
        <div className="finance-org-master-doc-pills">
          {['Invoice', 'Purchase Order', 'Proforma', 'Credit Note'].map((label) => (
            <span key={label} className="finance-org-master-pill">
              {label}
            </span>
          ))}
        </div>
      </div>

      {(error || msg) && (
        <div className={`am-banner ${error ? 'is-error' : 'is-info'}`} role="status">
          {error || msg}
        </div>
      )}

      <form className="card finance-org-master-form-wrap" onSubmit={handleSave}>
        <CommercialOrgMasterForm form={form} setForm={setForm} disabled={!canWrite || busy} />

        <div className="finance-org-master-actions">
          <button type="button" className="btn secondary" disabled={loading} onClick={() => reload()}>
            Reload
          </button>
          {canWrite ? (
            <button type="submit" className="btn" disabled={busy}>
              {busy ? 'Saving…' : 'Save organisation master'}
            </button>
          ) : (
            <p className="muted">View-only access. Ask an administrator for Finance write access.</p>
          )}
          <Link to="/finance/generate" className="btn secondary">
            Back to Generate
          </Link>
        </div>
      </form>
    </div>
  );
}
