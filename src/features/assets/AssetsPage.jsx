import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, apiFetch, downloadExcel } from '../../shared/api.js';

import { MODULE, FIELD } from '../../shared/labels.js';
import { useAuth } from '../../shared/auth.jsx';
import PageShell from '../../components/ui/PageShell.jsx';
import {
  ASSET_TYPE_OPTIONS,
  ASSET_STATUS_OPTIONS,
  ASSET_CUSTODY_OPTIONS,
  INDIAN_STATES_AND_UTS,
} from '../devices/assetMasterOptions.js';

const PAGE_SIZES = [10, 25, 50, 100];

const emptyForm = {
  name: '',
  assetType: '',
  serialNumber: '',
  cost: '',
  purchaseMonth: '',
  agreementStatus: 'Not Initiated',
  custody: '',
  custodianName: '',
  custodianContact: '',
  custodianCity: '',
  custodianState: '',
  description: '',
  contactId: '',
};

function assetStatusTone(status) {
  const s = String(status || '');
  if (s === 'Agreement Signed' || s === 'Active') return 'ok';
  if (['With Kartavya', 'Under Repairs'].includes(s)) return 'info';
  if (['Lost/Stolen', 'Untraceable', 'End of Life'].includes(s)) return 'danger';
  if (s === 'Not Initiated') return 'neutral';
  return 'warn';
}

function purchaseToMonthInput(mmYyyy) {
  if (!mmYyyy || !/^\d{2}\/\d{4}$/.test(String(mmYyyy))) return '';
  const [mm, yyyy] = String(mmYyyy).split('/');
  return `${yyyy}-${mm}`;
}

function custodianCity(row) {
  return row.location?.city || row.contactId?.city || row.custodianCity || '—';
}

function custodianName(row) {
  return row.custodianName || row.contactId?.name || '—';
}

export default function AssetsPage() {
  const { can } = useAuth();
  const canWrite = can('assets:write') || can('devices:write') || can('*');
  const canViewAgreements = can('agreements:read') || can('*');

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: 25, total: 0, pages: 0 });
  const [q, setQ] = useState('');
  const [agreementStatus, setAgreementStatus] = useState('');
  const [custody, setCustody] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);

  const [contacts, setContacts] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const fileRef = useRef(null);
  const formRef = useRef(null);

  const [viewRow, setViewRow] = useState(null);
  const [viewDocs, setViewDocs] = useState([]);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewError, setViewError] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');

  const downloadInventory = async () => {
    setError('');
    setExportBusy(true);
    try {
      await downloadExcel('/assets/export', 'Asset_Inventory.xlsx');
    } catch (err) {
      setError(err.message);
    } finally {
      setExportBusy(false);
    }
  };

  const downloadSample = async () => {
    setError('');
    try {
      const res = await apiFetch('/devices/import-template');
      if (!res.ok) throw new Error('Could not download sample Excel');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Asset_Inventory_Sample.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    }
  };

  const runImport = async (file) => {
    setError('');
    setMsg('');
    setImportBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await api('/devices/import', { method: 'POST', body: fd });
      const errHint =
        data.errorRows > 0
          ? ` · ${data.errorRows} row${data.errorRows === 1 ? '' : 's'} failed`
          : '';
      setMsg(
        `Imported ${data.created} asset${data.created === 1 ? '' : 's'}${errHint}.`
      );
      if (data.errors?.length) {
        setError(data.errors.map((e) => `Row ${e.row}: ${e.message}`).slice(0, 5).join(' · '));
      }
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setImportBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (q.trim()) params.set('q', q.trim());
      if (agreementStatus) params.set('agreementStatus', agreementStatus);
      if (custody) params.set('custody', custody);
      const res = await api(`/assets?${params}`);
      setRows(res.data || []);
      setMeta(res.meta || { page, limit, total: 0, pages: 0 });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, limit, q, agreementStatus, custody]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api('/contacts?limit=500')
      .then((r) => setContacts(r.data || []))
      .catch(() => {});
  }, []);

  const runSearch = () => {
    setPage(1);
    load();
  };

  const openCreate = () => {
    setEditingId('');
    setForm(emptyForm);
    setFormOpen(true);
    setError('');
    setMsg('');
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 40);
  };

  const openEdit = (row) => {
    const master = row.deviceMasterId && typeof row.deviceMasterId === 'object' ? row.deviceMasterId : null;
    setEditingId(row._id);
    setForm({
      name: row.deviceNameSnapshot || master?.name || '',
      assetType: row.assetType || master?.assetType || '',
      serialNumber: row.serialNumber || '',
      cost: row.deviceValue == null && master?.cost == null ? '' : String(row.deviceValue ?? master?.cost),
      purchaseMonth: purchaseToMonthInput(row.addedMonth || master?.purchaseMonth),
      agreementStatus: row.agreementStatus || 'Not Initiated',
      custody: row.custody || '',
      custodianName: row.custodianName || row.contactId?.name || '',
      custodianContact:
        row.custodianContact || row.contactId?.contact || row.contactId?.email || '',
      custodianCity: row.location?.city || row.contactId?.city || '',
      custodianState: row.location?.state || row.contactId?.state || '',
      description: row.remarks || master?.description || '',
      contactId: row.contactId?._id || row.contactId || '',
    });
    setFormOpen(true);
    setError('');
    setMsg('');
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 40);
  };

  const closeForm = () => {
    setEditingId('');
    setForm(emptyForm);
    setFormOpen(false);
  };

  const save = async (e) => {
    e.preventDefault();
    setError('');
    setMsg('');
    setBusy(true);
    try {
      if (editingId) {
        const body = {
          name: form.name.trim(),
          assetType: form.assetType,
          serialNumber: form.serialNumber.trim(),
          deviceValue: form.cost === '' ? null : Number(form.cost),
          purchaseMonth: form.purchaseMonth,
          agreementStatus: form.agreementStatus,
          custody: form.custody,
          custodianName: form.custodianName.trim(),
          custodianContact: form.custodianContact.trim(),
          custodianCity: form.custodianCity.trim(),
          custodianState: form.custodianState,
          description: form.description.trim() || '',
          contactId: form.contactId || null,
        };
        await api(`/assets/${editingId}`, { method: 'PATCH', body });
        setMsg('Asset updated.');
      } else {
        const payload = {
          name: form.name.trim(),
          assetType: form.assetType,
          serialNumber: form.serialNumber.trim(),
          cost: form.cost === '' ? null : Number(form.cost),
          purchaseMonth: form.purchaseMonth,
          agreementStatus: form.agreementStatus,
          custody: form.custody,
          custodianName: form.custodianName.trim(),
          custodianContact: form.custodianContact.trim(),
          custodianCity: form.custodianCity.trim(),
          custodianState: form.custodianState,
          description: form.description.trim() || '',
        };
        const { data } = await api('/devices', { method: 'POST', body: payload });
        setMsg(`Added “${data.name}” with serial ${data.serialNumber}.`);
      }
      closeForm();
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const openView = async (row) => {
    setViewRow(row);
    setViewDocs([]);
    setViewError('');
    setPreviewUrl('');
    setPreviewTitle('');
    setViewLoading(true);
    try {
      const { data } = await api(`/assets/${row._id}/documents`);
      setViewDocs(data || []);
    } catch (err) {
      setViewError(err.message);
    } finally {
      setViewLoading(false);
    }
  };

  const closeView = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl('');
    setPreviewTitle('');
    setViewRow(null);
    setViewDocs([]);
  };

  const openAgreementPdf = async (agreement) => {
    if (!canViewAgreements) return;
    setViewError('');
    try {
      const res = await apiFetch(`/agreements/${agreement._id}/pdf`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error?.message || 'Could not load agreement PDF');
      }
      const blob = await res.blob();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setPreviewTitle(agreement.title || agreement.agreementNumber);
    } catch (err) {
      setViewError(err.message);
    }
  };

  const from = meta.total ? (meta.page - 1) * meta.limit + 1 : 0;
  const to = meta.total ? Math.min(meta.page * meta.limit, meta.total) : 0;

  return (
    <PageShell
      className="inv-page"
      breadcrumbs={[{ to: '/', label: 'Modules' }, { label: MODULE.ASSET_INVENTORY }]}
      title={
        <>
          {MODULE.ASSET_INVENTORY}
          <span className="inv-count" aria-label={`${meta.total} total assets`}>
            {meta.total.toLocaleString()} assets
          </span>
        </>
      }
      description="Onboard and track devices — type, value, status, custody, and custodian."
      actions={
        <div className="inv-header-actions">
          <button
            className="btn secondary btn-compact"
            type="button"
            disabled={exportBusy}
            onClick={downloadInventory}
          >
            {exportBusy ? 'Downloading…' : 'Download'}
          </button>
          {canWrite ? (
            <>
              <button className="btn secondary btn-compact" type="button" onClick={downloadSample}>
                Sample
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) runImport(f);
                }}
              />
              <button
                className="btn secondary btn-compact"
                type="button"
                disabled={importBusy}
                onClick={() => fileRef.current?.click()}
              >
                {importBusy ? 'Importing…' : 'Import'}
              </button>
              <button className="btn btn-compact" type="button" onClick={openCreate}>
                + Add asset
              </button>
            </>
          ) : null}
        </div>
      }
    >
      {(error || msg) && (
        <div className={`am-banner ${error ? 'is-error' : 'is-info'}`} role="status">
          {error || msg}
        </div>
      )}

      {canWrite && formOpen && (
        <form ref={formRef} className="am-form card" onSubmit={save}>
          <div className="am-form-head">
            <div>
              <h2>{editingId ? 'Edit asset' : 'New asset'}</h2>
              <p className="muted">
                {editingId
                  ? 'Updates register and tracking fields together.'
                  : 'Adds the asset to inventory and keeps register fields in sync.'}
              </p>
            </div>
            <button className="btn secondary btn-compact" type="button" onClick={closeForm}>
              Close
            </button>
          </div>

          <div className="am-form-grid">
            <div className="field">
              <label>{FIELD.ASSET_NAME} *</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ultrasound Probe X2"
              />
            </div>
            <div className="field">
              <label>{FIELD.ASSET_TYPE} *</label>
              <select
                required
                value={form.assetType}
                onChange={(e) => setForm({ ...form, assetType: e.target.value })}
              >
                <option value="">Select type</option>
                {ASSET_TYPE_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Serial Number *</label>
              <input
                required
                value={form.serialNumber}
                onChange={(e) => setForm({ ...form, serialNumber: e.target.value })}
                placeholder="SN-1001"
              />
            </div>
            <div className="field">
              <label>{FIELD.ASSET_VALUE} *</label>
              <input
                required
                type="number"
                min={0}
                step="0.01"
                value={form.cost}
                onChange={(e) => setForm({ ...form, cost: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div className="field">
              <label>Purchase (MM/YYYY) *</label>
              <input
                required
                type="month"
                value={form.purchaseMonth}
                onChange={(e) => setForm({ ...form, purchaseMonth: e.target.value })}
              />
            </div>
            <div className="field">
              <label>{FIELD.ASSET_STATUS} *</label>
              <select
                required
                value={form.agreementStatus}
                onChange={(e) => setForm({ ...form, agreementStatus: e.target.value })}
              >
                {ASSET_STATUS_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>{FIELD.ASSET_CUSTODY} *</label>
              <select
                required
                value={form.custody}
                onChange={(e) => setForm({ ...form, custody: e.target.value })}
              >
                <option value="">Select custody</option>
                {ASSET_CUSTODY_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>{FIELD.CUSTODIAN_NAME} *</label>
              <input
                required
                value={form.custodianName}
                onChange={(e) => setForm({ ...form, custodianName: e.target.value })}
                placeholder="Full name"
              />
            </div>
            <div className="field">
              <label>{FIELD.CUSTODIAN_CONTACT} *</label>
              <input
                required
                value={form.custodianContact}
                onChange={(e) => setForm({ ...form, custodianContact: e.target.value })}
                placeholder="Phone or email"
              />
            </div>
            <div className="field">
              <label>{FIELD.CUSTODIAN_CITY} *</label>
              <input
                required
                value={form.custodianCity}
                onChange={(e) => setForm({ ...form, custodianCity: e.target.value })}
                placeholder="Mumbai"
              />
            </div>
            <div className="field">
              <label>{FIELD.CUSTODIAN_STATE} *</label>
              <select
                required
                value={form.custodianState}
                onChange={(e) => setForm({ ...form, custodianState: e.target.value })}
              >
                <option value="">Select state / UT</option>
                {INDIAN_STATES_AND_UTS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
            {editingId ? (
              <div className="field">
                <label htmlFor="inv-edit-contact">Link to {MODULE.CONTACT_DIRECTORY}</label>
                <select
                  id="inv-edit-contact"
                  value={form.contactId}
                  onChange={(e) => {
                    const contactId = e.target.value;
                    const contact = contacts.find((c) => c._id === contactId);
                    setForm({
                      ...form,
                      contactId,
                      ...(contact
                        ? {
                            custodianName: contact.name || form.custodianName,
                            custodianContact:
                              contact.contact || contact.email || form.custodianContact,
                            custodianCity: contact.city || form.custodianCity,
                            custodianState: contact.state || form.custodianState,
                          }
                        : {}),
                    });
                  }}
                >
                  <option value="">— None —</option>
                  {contacts.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                      {c.city ? ` · ${c.city}` : ''}
                      {c.profession ? ` · ${c.profession}` : ''}
                    </option>
                  ))}
                </select>
                {canViewAgreements && (
                  <p className="muted" style={{ marginTop: 6, fontSize: '0.75rem' }}>
                    Optional link from{' '}
                    <Link to="/agreements/contacts">{MODULE.CONTACT_DIRECTORY}</Link>.
                  </p>
                )}
              </div>
            ) : null}
            <div className="field am-form-span">
              <label>Description</label>
              <textarea
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Optional notes"
              />
            </div>
          </div>

          <div className="am-form-actions">
            <button className="btn" type="submit" disabled={busy}>
              {busy ? 'Saving…' : editingId ? 'Save changes' : 'Add asset'}
            </button>
            <button className="btn secondary" type="button" disabled={busy} onClick={closeForm}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <section className="inv-catalog card">
        <div className="inv-toolbar">
          <input
            className="esign-search inv-search"
            placeholder="Search asset name, serial, custodian, city…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runSearch()}
          />
          <select
            value={agreementStatus}
            onChange={(e) => {
              setAgreementStatus(e.target.value);
              setPage(1);
            }}
            aria-label="Asset status"
          >
            <option value="">All asset statuses</option>
            {ASSET_STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            value={custody}
            onChange={(e) => {
              setCustody(e.target.value);
              setPage(1);
            }}
            aria-label="Asset custody"
          >
            <option value="">All custody</option>
            {ASSET_CUSTODY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button className="btn secondary" type="button" onClick={runSearch}>
            Search
          </button>
        </div>

        <div className="inv-table-wrap">
          <table className="inv-table">
            <thead>
              <tr>
                <th>{FIELD.ASSET_NAME}</th>
                <th>{FIELD.ASSET_TYPE}</th>
                <th>Serial No.</th>
                <th>{FIELD.ASSET_STATUS}</th>
                <th>{FIELD.ASSET_CUSTODY}</th>
                <th>{FIELD.CUSTODIAN_NAME}</th>
                <th>City</th>
                <th className="inv-col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a._id}>
                  <td>
                    <strong className="inv-device">{a.deviceNameSnapshot || '—'}</strong>
                  </td>
                  <td className="inv-muted-cell">
                    {a.assetType || a.deviceMasterId?.assetType || '—'}
                  </td>
                  <td className="mono-sm">{a.serialNumber || '—'}</td>
                  <td>
                    <span className={`badge tone-${assetStatusTone(a.agreementStatus)}`}>
                      {a.agreementStatus || 'Not Initiated'}
                    </span>
                  </td>
                  <td className="inv-muted-cell">{a.custody || '—'}</td>
                  <td>{custodianName(a)}</td>
                  <td>{custodianCity(a)}</td>
                  <td className="inv-col-actions">
                    <div className="inv-row-actions">
                      {canWrite && (
                        <button
                          className="inv-link"
                          type="button"
                          onClick={() => openEdit(a)}
                        >
                          Edit
                        </button>
                      )}
                      <Link className="inv-link" to={`/assets/${a._id}`}>
                        Open
                      </Link>
                      <button
                        className="inv-link"
                        type="button"
                        onClick={() => openView(a)}
                      >
                        Docs
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && !rows.length && (
                <tr>
                  <td colSpan={8}>
                    <div className="inv-empty">
                      <strong>No assets found</strong>
                      <p className="muted">
                        {agreementStatus || custody || q
                          ? 'Try clearing filters or search.'
                          : 'Add an asset or import Excel to start the inventory.'}
                      </p>
                      {canWrite && !agreementStatus && !custody && !q && (
                        <button className="btn" type="button" onClick={openCreate}>
                          + Add asset
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <footer className="inv-pagination">
          <div className="inv-pagination-meta">
            <span>
              Showing {from}–{to} of {meta.total} entries
            </span>
            <label className="inv-page-size">
              Rows per page
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
              >
                {PAGE_SIZES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="inv-pagination-controls">
            <button
              type="button"
              className="btn secondary btn-compact"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <span className="inv-page-indicator">
              Page {meta.page || page} of {Math.max(meta.pages, 1)}
            </span>
            <button
              type="button"
              className="btn secondary btn-compact"
              disabled={page >= meta.pages || loading || !meta.total}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </footer>
      </section>

      {viewRow && (
        <div className="inv-modal-backdrop" role="presentation" onClick={closeView}>
          <div
            className="inv-modal inv-modal-wide card"
            role="dialog"
            aria-labelledby="inv-view-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="inv-modal-head">
              <h2 id="inv-view-title">Related documents</h2>
              <button type="button" className="btn secondary btn-compact" onClick={closeView}>
                Close
              </button>
            </div>
            <p className="muted inv-modal-sub">
              {viewRow.deviceNameSnapshot} · {viewRow.serialNumber || 'No serial'}
            </p>
            {viewError && <p className="error">{viewError}</p>}
            {viewLoading && <p className="muted">Loading linked agreements…</p>}
            {!viewLoading && !viewDocs.length && !viewError && (
              <p className="muted">No agreement documents are linked to this asset yet.</p>
            )}
            {!viewLoading && !!viewDocs.length && (
              <ul className="inv-doc-list">
                {viewDocs.map((ag) => (
                  <li key={ag._id} className="inv-doc-item">
                    <div>
                      <strong>{ag.title || ag.agreementNumber}</strong>
                      <div className="muted mono-sm">
                        {ag.agreementNumber} · {ag.status}
                        {ag.isActiveLink ? ' · Active link' : ''}
                      </div>
                    </div>
                    <div className="inv-doc-actions">
                      {canViewAgreements && (
                        <button
                          type="button"
                          className="btn secondary btn-compact"
                          onClick={() => openAgreementPdf(ag)}
                        >
                          Agreement PDF
                        </button>
                      )}
                      <Link
                        className="btn secondary btn-compact"
                        to={`/agreements/${ag._id}`}
                        onClick={closeView}
                      >
                        Open envelope
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {previewUrl && (
              <div className="inv-pdf-preview">
                <div className="inv-pdf-preview-head">
                  <strong>{previewTitle}</strong>
                  <button
                    type="button"
                    className="btn secondary btn-compact"
                    onClick={() => {
                      URL.revokeObjectURL(previewUrl);
                      setPreviewUrl('');
                      setPreviewTitle('');
                    }}
                  >
                    Close preview
                  </button>
                </div>
                <iframe title={previewTitle} src={previewUrl} className="inv-pdf-frame" />
              </div>
            )}
          </div>
        </div>
      )}
    </PageShell>
  );
}
