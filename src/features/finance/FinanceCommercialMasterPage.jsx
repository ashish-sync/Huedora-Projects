import { useEffect, useState } from 'react';
import { FeedbackAlerts } from '../../components/ui/FeedbackBanner.jsx';
import { Link } from 'react-router-dom';
import { useAuth } from '../../shared/auth.jsx';
import { emptyOrgMasterForm, orgMasterToPayload } from './commercialOrgMaster.js';
import { DEFAULT_HEADER_DISPLAY_KEYS, sanitizeHeaderDisplayKeys } from './shared/companyLetterhead.js';
import {
  DEFAULT_PRIMARY_COLOR,
  DEFAULT_SECONDARY_COLOR,
  sanitizeBrandColor,
} from './shared/orgBrandColors.js';
import { CommercialOrgMasterForm } from './CommercialOrgMasterCard.jsx';
import { canManageOrganisationMaster } from './builder/commercialApproval.js';
import { useCommercialOrgMaster } from './useCommercialOrgMaster.js';
import './finance-commercial.css';
import './entityMaster.css';

function getOrgInitials(name) {
  if (!name) return 'TC';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

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
  const [searchQ, setSearchQ] = useState('');

  useEffect(() => {
    if (creating) return;
    if (data) {
      setForm({
        ...emptyOrgMasterForm(),
        ...data,
        name: data.name || data.legalName || '',
        headerDisplayKeys:
          sanitizeHeaderDisplayKeys(data.headerDisplayKeys) ?? [...DEFAULT_HEADER_DISPLAY_KEYS],
        primaryColor: sanitizeBrandColor(data.primaryColor) || DEFAULT_PRIMARY_COLOR,
        secondaryColor: sanitizeBrandColor(data.secondaryColor) || DEFAULT_SECONDARY_COLOR,
      });
    }
  }, [data, creating]);

  const handleSave = async (e) => {
    e?.preventDefault?.();
    if (!canEdit) return;
    setBusy(true);
    setMsg('');
    try {
      if (creating) {
        const row = await create(orgMasterToPayload(form));
        setCreating(false);
        setMsg(`Organisation "${row.name || row.legalName}" created successfully.`);
      } else {
        await save(orgMasterToPayload(form), selectedOrgId);
        setMsg('Organisation details saved. Issued documents preserve their existing snapshot.');
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
      setForm({
        ...emptyOrgMasterForm(),
        ...data,
        name: data.name || data.legalName || '',
        headerDisplayKeys:
          sanitizeHeaderDisplayKeys(data.headerDisplayKeys) ?? [...DEFAULT_HEADER_DISPLAY_KEYS],
        primaryColor: sanitizeBrandColor(data.primaryColor) || DEFAULT_PRIMARY_COLOR,
        secondaryColor: sanitizeBrandColor(data.secondaryColor) || DEFAULT_SECONDARY_COLOR,
      });
    }
  };

  const currentOrg = orgList.find(
    (o) => String(o._id || o.id) === String(selectedOrgId)
  );

  const filteredOrgs = orgList.filter((org) => {
    if (!searchQ.trim()) return true;
    const q = searchQ.trim().toLowerCase();
    const name = (org.name || org.legalName || '').toLowerCase();
    const code = (org.documentCode || '').toLowerCase();
    const gstin = (org.gstin || '').toLowerCase();
    return name.includes(q) || code.includes(q) || gstin.includes(q);
  });

  return (
    <div className="entity-master-workspace">
      {/* ── Enterprise Compact Top Bar ── */}
      <header className="entity-master-topbar">
        <div className="entity-master-topbar-left">
          <div className="entity-master-kicker">
            <span>Finance One</span>
            <span className="entity-master-kicker-sep">/</span>
            <span className="entity-master-kicker-current">Entity Master</span>
          </div>
          <div className="entity-master-topbar-title-row">
            <h2 className="entity-master-title">
              {creating
                ? 'Register New Organisation'
                : form.name || form.legalName || 'Organisation Configuration'}
            </h2>
            {form.documentCode && !creating ? (
              <span className="entity-master-code-badge" title="Document Numbering Code">
                {form.documentCode}
              </span>
            ) : null}
            {currentOrg?.isDefault && !creating ? (
              <span className="entity-master-default-badge">Default Entity</span>
            ) : null}
          </div>
        </div>
        <div className="entity-master-topbar-actions">
          <Link to="/finance-one/billing" className="btn secondary btn-compact">
            Back to Billing
          </Link>
          <button
            type="button"
            className="btn secondary btn-compact"
            disabled={loading || busy}
            onClick={() => reload()}
            title="Reload organisation profiles"
          >
            ↻ Reload
          </button>
          {canEdit && !creating ? (
            <button
              type="button"
              className="btn entity-master-add-btn btn-compact"
              disabled={busy}
              onClick={startCreate}
            >
              + Add Entity
            </button>
          ) : null}
        </div>
      </header>

      {(error || msg) && <FeedbackAlerts error={error} message={msg} />}

      {!canEdit ? (
        <div className="entity-readonly-banner">
          <span className="entity-readonly-icon" aria-hidden="true">
            🔒
          </span>
          <span>
            View-only mode. Organisation master changes require Admin, Operations Head, Senior Manager, or Manager permissions.
          </span>
        </div>
      ) : null}

      <div className="entity-master-layout">
        {/* ── Left Column: Persistent Entity Selector ── */}
        <aside className="entity-selector-sidebar" aria-label="Issuing Entities Directory">
          <div className="entity-selector-head">
            <div className="entity-selector-title-row">
              <h3 className="entity-selector-title">Issuing Entities</h3>
              <span className="entity-selector-count">{orgList.length}</span>
            </div>
            <div className="entity-selector-search">
              <svg
                className="entity-selector-search-icon"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="9" cy="9" r="6" />
                <line x1="14" y1="14" x2="18" y2="18" />
              </svg>
              <input
                type="search"
                className="entity-search-input"
                placeholder="Filter by name, code, GSTIN…"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                aria-label="Filter organisations"
              />
            </div>
          </div>

          <div className="entity-selector-list" role="list">
            {creating ? (
              <div className="entity-selector-item is-creating is-selected">
                <div className="entity-avatar is-creating" aria-hidden="true">
                  +
                </div>
                <div className="entity-info">
                  <div className="entity-info-top">
                    <strong className="entity-name">
                      {form.name || form.legalName || 'Draft Organisation'}
                    </strong>
                    <span
                      className="entity-badge-default"
                      style={{
                        background: 'var(--color-warning-subtle, rgba(217, 119, 6, 0.12))',
                        color: 'var(--color-warning, #d97706)',
                      }}
                    >
                      New
                    </span>
                  </div>
                  <div className="entity-meta-row">
                    <span className="entity-code-pill">
                      {form.documentCode || 'PENDING'}
                    </span>
                    <span className="entity-gstin">
                      {form.gstin || 'Not registered'}
                    </span>
                  </div>
                </div>
              </div>
            ) : null}

            {filteredOrgs.map((org) => {
              const id = String(org._id || org.id);
              const isSelected = !creating && id === String(selectedOrgId);
              const initials = org.documentCode || getOrgInitials(org.name || org.legalName);
              return (
                <button
                  key={id}
                  type="button"
                  className={`entity-selector-item ${isSelected ? 'is-selected' : ''}`}
                  disabled={creating}
                  onClick={() => {
                    selectOrg(id);
                    setMsg('');
                  }}
                  aria-current={isSelected ? 'true' : undefined}
                >
                  <div className="entity-avatar" aria-hidden="true">
                    {initials}
                  </div>
                  <div className="entity-info">
                    <div className="entity-info-top">
                      <strong className="entity-name">
                        {org.name || org.legalName || 'Organisation'}
                      </strong>
                      {org.isDefault ? (
                        <span className="entity-badge-default">Default</span>
                      ) : null}
                    </div>
                    <div className="entity-meta-row">
                      {org.documentCode ? (
                        <span className="entity-code-pill">{org.documentCode}</span>
                      ) : null}
                      {org.gstin ? (
                        <span className="entity-gstin">{org.gstin}</span>
                      ) : (
                        <span className="entity-gstin" style={{ fontStyle: 'italic', opacity: 0.7 }}>
                          No GSTIN
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}

            {!filteredOrgs.length && !creating ? (
              <div className="entity-selector-empty">
                {orgList.length
                  ? 'No matching organisations found.'
                  : 'No organisations registered yet.'}
              </div>
            ) : null}
          </div>
        </aside>

        {/* ── Right Column: Configuration Workspace ── */}
        <form
          id="org-master-form"
          className="entity-workspace-form"
          onSubmit={handleSave}
        >
          {creating ? (
            <div className="entity-create-banner">
              <div className="entity-create-banner-content">
                <span className="entity-create-banner-icon" aria-hidden="true">
                  ✨
                </span>
                <div>
                  <strong>Drafting New Issuing Organisation</strong>
                  <p>
                    Configure legal identity, branding, document numbering, tax registrations, and banking details. Click &ldquo;Create Organisation&rdquo; to register.
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="btn secondary btn-compact"
                onClick={cancelCreate}
              >
                Cancel
              </button>
            </div>
          ) : null}

          <CommercialOrgMasterForm
            form={form}
            setForm={setForm}
            disabled={!canEdit || busy}
          />

          {/* ── Single Docked Sticky Action Bar ── */}
          {canEdit ? (
            <div className="entity-workspace-footer">
              <div className="entity-footer-status">
                <span
                  className={`entity-footer-dot ${creating ? 'is-creating' : ''}`}
                  aria-hidden="true"
                />
                <div className="entity-footer-meta">
                  <span>{creating ? 'New Entity Draft:' : 'Active Entity:'}</span>
                  <strong>
                    {form.name || form.legalName || (creating ? 'Untitled Organisation' : 'Organisation Profile')}
                  </strong>
                  {form.documentCode ? (
                    <span className="entity-code-pill">{form.documentCode}</span>
                  ) : null}
                </div>
              </div>
              <div className="entity-footer-buttons">
                {creating ? (
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={cancelCreate}
                    disabled={busy}
                  >
                    Cancel
                  </button>
                ) : null}
                <button type="submit" className="btn" disabled={busy}>
                  {busy ? 'Saving changes…' : creating ? 'Create Organisation' : 'Save Changes'}
                </button>
              </div>
            </div>
          ) : null}
      </form>
      </div>
    </div>
  );
}
