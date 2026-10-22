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
  const {
    data,
    orgList,
    selectedOrgId,
    loading,
    error,
    save,
    create,
    selectOrg,
    reload,
  } = useCommercialOrgMaster();
  const [form, setForm] = useState(emptyOrgMasterForm);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (creating) return;
    if (data) {
      setForm({
        ...emptyOrgMasterForm(),
        ...data,
        name: data.name || data.legalName || '',
      });
    }
  }, [data, creating]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!canEdit) return;
    setBusy(true);
    setMsg('');
    try {
      if (creating) {
        const row = await create(orgMasterToPayload(form));
        setCreating(false);
        setMsg(`Organisation “${row.name || row.legalName}” created.`);
      } else {
        await save(orgMasterToPayload(form), selectedOrgId);
        setMsg('Organisation saved. New drafts can use these details; issued docs keep their snapshot.');
      }
    } catch {
      /* error from hook */
    } finally {
      setBusy(false);
    }
  };

  const startCreate = () => {
    if (!canEdit) return;
    setCreating(true);
    setForm(emptyOrgMasterForm());
    setMsg('');
  };

  const cancelCreate = () => {
    setCreating(false);
    if (data) {
      setForm({ ...emptyOrgMasterForm(), ...data, name: data.name || data.legalName || '' });
    }
  };

  return (
    <div className="finance-org-master-page">
      <header className="finance-org-master-header">
        <div className="finance-org-master-header-text">
          <p className="finance-org-master-eyebrow">Finance One · Shared reference</p>
          <h2 className="finance-org-master-heading">Organisation master</h2>
          <p className="finance-org-master-lead">
            Configure one or more issuing organisations. Each commercial document picks an organisation
            and freezes its details at issuance.
          </p>
        </div>
        <div className="finance-org-master-actions finance-org-master-actions--top">
          <Link to="/finance-one/billing" className="btn secondary btn-compact">
            Back
          </Link>
          <button
            type="button"
            className="btn secondary btn-compact"
            disabled={loading || busy}
            onClick={() => reload()}
          >
            Reload
          </button>
          {canEdit ? (
            <>
              <button
                type="button"
                className="btn secondary btn-compact"
                disabled={busy || creating}
                onClick={startCreate}
              >
                Add organisation
              </button>
              <button type="submit" form="org-master-form" className="btn btn-compact" disabled={busy}>
                {busy ? 'Saving…' : creating ? 'Create' : 'Save changes'}
              </button>
            </>
          ) : null}
        </div>
      </header>

      {(error || msg) && <FeedbackAlerts error={error} message={msg} />}

      {!canEdit ? (
        <p className="finance-org-master-readonly muted">
          View-only. Organisation master can be edited by Admin, Operations Head, Senior Manager, or
          Manager.
        </p>
      ) : null}

      <div className="finance-org-master-layout">
        <aside className="finance-org-master-list card">
          <h3>Organisations</h3>
          <div className="role-list">
            {orgList.map((org) => {
              const id = String(org._id || org.id);
              const selected = !creating && id === String(selectedOrgId);
              return (
                <button
                  key={id}
                  type="button"
                  className={`role-list-item ${selected ? 'is-selected' : ''}`}
                  disabled={creating}
                  onClick={() => {
                    setCreating(false);
                    selectOrg(id);
                    setMsg('');
                  }}
                >
                  <strong>{org.name || org.legalName || 'Organisation'}</strong>
                  <span className="muted mono-sm">
                    {[org.documentCode, org.gstin, org.isDefault ? 'Default' : ''].filter(Boolean).join(' · ') || '—'}
                  </span>
                </button>
              );
            })}
            {!orgList.length ? <p className="muted rp-empty">No organisations yet.</p> : null}
          </div>
        </aside>

        <form id="org-master-form" className="finance-org-master-form-wrap" onSubmit={handleSave}>
          <div className="field" style={{ marginBottom: '1rem' }}>
            <label>Organisation display name</label>
            <input
              value={form.name || ''}
              disabled={!canEdit || busy}
              placeholder="e.g. Tylo Care Private Limited"
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          {creating ? (
            <p className="muted" style={{ marginBottom: '1rem' }}>
              Creating a new organisation. Cancel to return to the selected profile.
              {canEdit ? (
                <>
                  {' '}
                  <button type="button" className="btn secondary btn-compact" onClick={cancelCreate}>
                    Cancel
                  </button>
                </>
              ) : null}
            </p>
          ) : null}
          <CommercialOrgMasterForm form={form} setForm={setForm} disabled={!canEdit || busy} />
        </form>
      </div>
    </div>
  );
}
