import { useEffect, useMemo, useRef, useState } from 'react';
import { api, loadStoredToken, downloadExcel } from '../../shared/api.js';
import { MODULE, FIELD } from '../../shared/labels.js';
import { useAuth } from '../../shared/auth.jsx';
import PageShell from '../../components/ui/PageShell.jsx';
import {
  ASSET_TYPE_OPTIONS,
  ASSET_STATUS_OPTIONS,
  ASSET_CUSTODY_OPTIONS,
  INDIAN_STATES_AND_UTS,
} from './assetMasterOptions.js';

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
};

function formatMoney(n) {
  if (n == null || n === '') return '—';
  const num = Number(n);
  if (!Number.isFinite(num)) return '—';
  return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function purchaseToMonthInput(mmYyyy) {
  if (!mmYyyy || !/^\d{2}\/\d{4}$/.test(String(mmYyyy))) return '';
  const [mm, yyyy] = String(mmYyyy).split('/');
  return `${yyyy}-${mm}`;
}

function statusTone(status) {
  const s = String(status || '');
  if (s === 'Agreement Signed') return 'ok';
  if (s === 'Lost/Stolen' || s === 'Untraceable' || s === 'End of Life') return 'danger';
  if (s === 'Under Repairs' || s === 'With Kartavya') return 'warn';
  return 'neutral';
}

export default function DevicesPage() {
  const { can } = useAuth();
  const canWrite = can('devices:write') || can('*');
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCustody, setFilterCustody] = useState('');
  const [filterType, setFilterType] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [statusBusyId, setStatusBusyId] = useState('');
  const [exportBusy, setExportBusy] = useState(false);
  const fileRef = useRef(null);
  const formRef = useRef(null);

  const load = () => {
    const params = new URLSearchParams({ limit: '200' });
    if (q.trim()) params.set('q', q.trim());
    api(`/devices?${params}`)
      .then((r) => setRows(r.data || []))
      .catch((e) => setError(e.message));
  };

  const downloadMaster = async () => {
    setError('');
    setExportBusy(true);
    try {
      await downloadExcel('/devices/export', 'Asset_Master.xlsx');
    } catch (err) {
      setError(err.message);
    } finally {
      setExportBusy(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((d) => {
      if (filterStatus && d.agreementStatus !== filterStatus) return false;
      if (filterCustody && d.custody !== filterCustody) return false;
      if (filterType && d.assetType !== filterType) return false;
      return true;
    });
  }, [rows, filterStatus, filterCustody, filterType]);

  const openCreate = () => {
    setEditingId('');
    setForm(emptyForm);
    setFormOpen(true);
    setError('');
    setMsg('');
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 40);
  };

  const startEdit = (row) => {
    setEditingId(row._id);
    setForm({
      name: row.name || '',
      assetType: row.assetType || '',
      serialNumber: row.serialNumber || '',
      cost: row.cost == null ? '' : String(row.cost),
      purchaseMonth: purchaseToMonthInput(row.purchaseMonth),
      agreementStatus: row.agreementStatus || 'Not Initiated',
      custody: row.custody || '',
      custodianName: row.custodianName || '',
      custodianContact: row.custodianContact || '',
      custodianCity: row.custodianCity || row.city || '',
      custodianState: row.custodianState || '',
      description: row.description || '',
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
    try {
      if (editingId) {
        const { data } = await api(`/devices/${editingId}`, { method: 'PATCH', body: payload });
        setMsg(`Updated “${data.name}” (${data.serialNumber}).`);
        closeForm();
      } else {
        const { data } = await api('/devices', { method: 'POST', body: payload });
        setMsg(`Added “${data.name}” with serial ${data.serialNumber}.`);
        closeForm();
      }
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const patchStatus = async (row, field, value) => {
    if (!canWrite || value === row[field]) return;
    setError('');
    setStatusBusyId(`${row._id}:${field}`);
    try {
      await api(`/devices/${row._id}`, {
        method: 'PATCH',
        body: { [field]: value },
      });
      setRows((prev) =>
        prev.map((r) => (r._id === row._id ? { ...r, [field]: value } : r))
      );
      if (editingId === row._id) setForm((f) => ({ ...f, [field]: value }));
    } catch (err) {
      setError(err.message);
    } finally {
      setStatusBusyId('');
    }
  };

  const remove = async (row) => {
    if (!window.confirm(`Delete “${row.name}” (${row.serialNumber || 'no serial'})?`)) return;
    setError('');
    setMsg('');
    setDeletingId(row._id);
    try {
      await api(`/devices/${row._id}`, { method: 'DELETE' });
      if (editingId === row._id) closeForm();
      setMsg(`Deleted ${row.name}`);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId('');
    }
  };

  const downloadSample = async () => {
    setError('');
    try {
      const token = loadStoredToken();
      const res = await fetch('/api/v1/devices/import-template', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Could not download sample Excel');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Asset_Master_Sample.xlsx';
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

  const colCount = canWrite ? 13 : 12;

  return (
    <PageShell
      breadcrumbs={[
        { to: '/', label: 'Modules' },
        { to: '/assets', label: MODULE.ASSET_INVENTORY },
        { label: MODULE.ASSET_MASTER },
      ]}
      title={MODULE.ASSET_MASTER}
      description="Catalog assets with type, value, status, custody, and custodian details."
      actions={
        <>
          <button
            className="btn secondary"
            type="button"
            disabled={exportBusy}
            onClick={downloadMaster}
          >
            {exportBusy ? 'Downloading…' : 'Download Excel'}
          </button>
          {canWrite ? (
            <>
              <button className="btn secondary" type="button" onClick={downloadSample}>
                Sample Excel
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
                className="btn secondary"
                type="button"
                disabled={importBusy}
                onClick={() => fileRef.current?.click()}
              >
                {importBusy ? 'Importing…' : 'Import Excel'}
              </button>
              <button className="btn" type="button" onClick={openCreate}>
                + Add asset
              </button>
            </>
          ) : null}
        </>
      }
      kpis={[{ label: 'Catalog assets', value: rows.length }]}
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
                  ? `Updates sync to the matching ${MODULE.ASSET_INVENTORY} record.`
                  : `Creates the catalog entry and ${MODULE.ASSET_INVENTORY} line together.`}
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
              <label>Asset Type *</label>
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
              <label>Asset Value *</label>
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
              <label>Asset Status *</label>
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
              <label>Asset Custody *</label>
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
              <label>Custodian Name *</label>
              <input
                required
                value={form.custodianName}
                onChange={(e) => setForm({ ...form, custodianName: e.target.value })}
                placeholder="Full name"
              />
            </div>
            <div className="field">
              <label>Custodian Contact *</label>
              <input
                required
                value={form.custodianContact}
                onChange={(e) => setForm({ ...form, custodianContact: e.target.value })}
                placeholder="Phone or email"
              />
            </div>
            <div className="field">
              <label>Custodian City *</label>
              <input
                required
                value={form.custodianCity}
                onChange={(e) => setForm({ ...form, custodianCity: e.target.value })}
                placeholder="Mumbai"
              />
            </div>
            <div className="field">
              <label>Custodian State *</label>
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

      <section className="am-catalog card">
        <div className="am-toolbar">
          <input
            className="esign-search am-search"
            placeholder="Search name, serial, custodian, city, state…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
          />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            aria-label="Filter by asset type"
          >
            <option value="">All types</option>
            {ASSET_TYPE_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            aria-label="Filter by asset status"
          >
            <option value="">All statuses</option>
            {ASSET_STATUS_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          <select
            value={filterCustody}
            onChange={(e) => setFilterCustody(e.target.value)}
            aria-label="Filter by custody"
          >
            <option value="">All custody</option>
            {ASSET_CUSTODY_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          <button className="btn secondary" type="button" onClick={load}>
            Search
          </button>
          {(filterStatus || filterCustody || filterType) && (
            <button
              type="button"
              className="filter-chip"
              onClick={() => {
                setFilterStatus('');
                setFilterCustody('');
                setFilterType('');
              }}
            >
              Clear filters
              <span aria-hidden="true">×</span>
            </button>
          )}
        </div>

        <div className="am-table-wrap">
          <table className="am-table">
            <thead>
              <tr>
                <th>Asset Name</th>
                <th>Type</th>
                <th>Serial</th>
                <th>Value</th>
                <th>Purchase</th>
                <th>Asset Status</th>
                <th>Asset Custody</th>
                <th>Custodian</th>
                <th>Contact</th>
                <th>City</th>
                <th>State</th>
                <th>Description</th>
                {canWrite && <th className="am-col-actions">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d._id} className={editingId === d._id ? 'is-editing' : undefined}>
                  <td>
                    <strong>{d.name}</strong>
                  </td>
                  <td>{d.assetType || '—'}</td>
                  <td className="mono-sm am-serial">{d.serialNumber || '—'}</td>
                  <td className="am-cost">{formatMoney(d.cost)}</td>
                  <td className="mono-sm">{d.purchaseMonth || '—'}</td>
                  <td>
                    {canWrite ? (
                      <select
                        className="am-status-select"
                        value={d.agreementStatus || 'Not Initiated'}
                        disabled={statusBusyId === `${d._id}:agreementStatus`}
                        onChange={(e) => patchStatus(d, 'agreementStatus', e.target.value)}
                        aria-label={`Change asset status for ${d.name}`}
                      >
                        {ASSET_STATUS_OPTIONS.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className={`badge tone-${statusTone(d.agreementStatus)}`}>
                        {d.agreementStatus || '—'}
                      </span>
                    )}
                  </td>
                  <td>
                    {canWrite ? (
                      <select
                        className="am-custody-select"
                        value={d.custody || ''}
                        disabled={statusBusyId === `${d._id}:custody`}
                        onChange={(e) => patchStatus(d, 'custody', e.target.value)}
                        aria-label={`Change custody for ${d.name}`}
                      >
                        {!d.custody && <option value="">Select…</option>}
                        {ASSET_CUSTODY_OPTIONS.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="am-custody-text">{d.custody || '—'}</span>
                    )}
                  </td>
                  <td>{d.custodianName || '—'}</td>
                  <td>{d.custodianContact || '—'}</td>
                  <td>{d.custodianCity || '—'}</td>
                  <td>{d.custodianState || '—'}</td>
                  <td className="muted">{d.description || '—'}</td>
                  {canWrite && (
                    <td className="am-col-actions">
                      <div className="am-row-actions">
                        <button
                          type="button"
                          className="btn secondary btn-compact"
                          disabled={busy || deletingId === d._id}
                          onClick={() => startEdit(d)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn danger btn-compact"
                          disabled={deletingId === d._id}
                          onClick={() => remove(d)}
                        >
                          {deletingId === d._id ? '…' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan={colCount}>
                    <div className="am-empty">
                      <strong>{rows.length ? 'No matches' : 'No assets yet'}</strong>
                      <p className="muted">
                        {rows.length
                          ? 'Try clearing filters or adjusting your search.'
                          : canWrite
                            ? 'Add an asset or import an Excel file to get started.'
                            : 'Nothing in the catalog yet.'}
                      </p>
                      {canWrite && !rows.length && (
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
        {(filterStatus || filterCustody || filterType || q) && filtered.length > 0 && (
          <p className="am-footer-meta muted">
            Showing {filtered.length} of {rows.length}
          </p>
        )}
      </section>
    </PageShell>
  );
}
