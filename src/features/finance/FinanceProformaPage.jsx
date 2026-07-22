import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AdaptiveSelect from '../../components/ui/AdaptiveSelect.jsx';
import DateInput from '../../components/ui/DateInput.jsx';
import FilePicker from '../../components/ui/FilePicker.jsx';
import PaginationBar from '../../components/ui/PaginationBar.jsx';
import { api, apiFetch } from '../../shared/api.js';
import { formatDate, todayIso } from '../../shared/dateFormat.js';
import { useAuth } from '../../shared/auth.jsx';
import './finance-commercial.css';
import { DOCUMENT_NUMBER_STANDARDS, proformaNumberExample } from './documentNumbering.js';

function formatMoney(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return '—';
  return num.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

const emptyLine = () => ({
  sectionTitle: '',
  description: '',
  sacCode: '999316',
  qty: '',
  rate: '',
  discount: '',
  igstRate: '',
  cgstRate: '',
  sgstRate: '',
});

const emptyForm = () => ({
  recipientName: '',
  projectName: '',
  placeOfSupply: '',
  deliveryAddress: '',
  contactPerson: '',
  contactEmail: '',
  recipientGstin: '',
  recipientPan: '',
  recipientStateCode: '',
  reference: '',
  documentDate: todayIso(),
  dueDate: '',
  paymentTermsDays: 45,
  reverseCharge: 'N',
  customNotes: '',
  lineItems: [
    {
      ...emptyLine(),
      description: '',
      qty: '100',
      rate: '',
    },
  ],
});

async function downloadProformaPdf(row, { download = true } = {}) {
  const res = await apiFetch(
    `/finance/proformas/${row._id}/pdf?download=${download ? '1' : '0'}`
  );
  if (!res.ok) {
    let message = 'Download failed';
    try {
      const json = await res.json();
      if (json?.error?.message) message = json.error.message;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(row.documentNumber || row.docKey || 'proforma').replace(/[^\w.-]+/g, '_')}.pdf`;
  if (!download) a.target = '_blank';
  a.click();
  URL.revokeObjectURL(url);
}

export default function FinanceProformaPage() {
  const { can } = useAuth();
  const canWrite = can('finance:write') || can('*');
  const uploadRef = useRef(null);

  const [rows, setRows] = useState([]);
  const [listMeta, setListMeta] = useState({ page: 1, limit: 25, total: 0, pages: 0 });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [listLoading, setListLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [uploadForm, setUploadForm] = useState({
    recipientName: '',
    projectName: '',
    documentNumber: '',
    documentDate: todayIso(),
    grandTotal: '',
    file: null,
  });

  const [clientMasters, setClientMasters] = useState([]);
  const [orgProfileOpen, setOrgProfileOpen] = useState(false);
  const [orgProfile, setOrgProfile] = useState(null);

  const previewTotal = useMemo(() => {
    return form.lineItems.reduce((sum, line) => {
      const qty = Number(line.qty) || 0;
      const rate = Number(line.rate) || 0;
      const discount = Number(line.discount) || 0;
      return sum + Math.max(qty * rate - discount, 0);
    }, 0);
  }, [form.lineItems]);

  const load = useCallback(async () => {
    setListLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (q.trim()) params.set('q', q.trim());
      if (status) params.set('status', status);
      const res = await api(`/finance/proformas?${params}`);
      setRows(res.data || []);
      setListMeta(res.meta || { page, limit, total: 0, pages: 0 });
    } catch (e) {
      setError(e.message);
    } finally {
      setListLoading(false);
    }
  }, [page, limit, q, status]);

  const loadOrgProfile = useCallback(async () => {
    try {
      const res = await api('/finance/org-profile');
      setOrgProfile(res.data);
    } catch {
      /* ignore */
    }
  }, []);

  const loadClientMasters = useCallback(async () => {
    try {
      const res = await api('/camp-ops/client-masters?limit=200');
      setClientMasters(res.data || []);
    } catch {
      setClientMasters([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadOrgProfile();
    loadClientMasters();
  }, [loadOrgProfile, loadClientMasters]);

  const openCreate = () => {
    setEditingId('');
    setForm(emptyForm());
    setFormOpen(true);
    setUploadOpen(false);
    setMsg('');
    setError('');
  };

  const openUpload = () => {
    setUploadForm({
      recipientName: '',
      projectName: '',
      documentNumber: '',
      documentDate: todayIso(),
      grandTotal: '',
      file: null,
    });
    setUploadOpen(true);
    setFormOpen(false);
    setMsg('');
    setError('');
  };

  const openEdit = async (row) => {
    if (row.source === 'uploaded') {
      setError('Uploaded proforma files cannot be edited here. Download or delete and re-upload.');
      return;
    }
    try {
      const res = await api(`/finance/proformas/${row._id}`);
      const data = res.data;
      setEditingId(data._id);
      setForm({
        recipientName: data.recipientName || '',
        projectName: data.projectName || '',
        placeOfSupply: data.placeOfSupply || '',
        deliveryAddress: data.deliveryAddress || data.placeOfSupply || '',
        contactPerson: data.contactPerson || '',
        contactEmail: data.contactEmail || '',
        recipientGstin: data.recipientGstin || '',
        recipientPan: data.recipientPan || '',
        recipientStateCode: data.recipientStateCode || '',
        reference: data.reference || '',
        documentDate: data.documentDate || todayIso(),
        dueDate: data.dueDate || '',
        paymentTermsDays: data.paymentTermsDays || 45,
        reverseCharge: data.reverseCharge || 'N',
        customNotes: data.customNotes || '',
        lineItems: (data.lineItems || []).length
          ? data.lineItems.map((line) => ({
              sectionTitle: line.sectionTitle || '',
              description: line.description || '',
              sacCode: line.sacCode || '999316',
              qty: line.qty == null ? '' : String(line.qty),
              rate: line.rate == null ? '' : String(line.rate),
              discount: line.discount == null ? '' : String(line.discount),
              igstRate: line.igstRate == null ? '' : String(line.igstRate),
              cgstRate: line.cgstRate == null ? '' : String(line.cgstRate),
              sgstRate: line.sgstRate == null ? '' : String(line.sgstRate),
            }))
          : [emptyLine()],
      });
      setFormOpen(true);
      setUploadOpen(false);
      setMsg('');
      setError('');
    } catch (e) {
      setError(e.message);
    }
  };

  const applyClientMaster = (masterId) => {
    const master = clientMasters.find((m) => m._id === masterId);
    if (!master) return;
    setForm((f) => ({
      ...f,
      recipientName: master.clientName || f.recipientName,
      projectName: master.programName
        ? `${master.clientName || ''} ${master.programName}`.trim()
        : f.projectName,
      clientMasterId: master._id,
    }));
  };

  const updateLine = (index, patch) => {
    setForm((f) => {
      const lineItems = [...f.lineItems];
      lineItems[index] = { ...lineItems[index], ...patch };
      return { ...f, lineItems };
    });
  };

  const addLine = () => {
    setForm((f) => ({ ...f, lineItems: [...f.lineItems, emptyLine()] }));
  };

  const addSection = () => {
    setForm((f) => ({
      ...f,
      lineItems: [...f.lineItems, { sectionTitle: 'Section heading', description: '', sacCode: '', qty: '', rate: '' }],
    }));
  };

  const removeLine = (index) => {
    setForm((f) => ({
      ...f,
      lineItems: f.lineItems.filter((_, i) => i !== index),
    }));
  };

  const save = async (e) => {
    e.preventDefault();
    if (!canWrite) return;
    setBusy(true);
    setError('');
    setMsg('');
    try {
      const body = {
        ...form,
        lineItems: form.lineItems.map((line) => ({
          ...line,
          qty: line.qty === '' ? 0 : Number(line.qty),
          rate: line.rate === '' ? 0 : Number(line.rate),
          discount: line.discount === '' ? 0 : Number(line.discount),
          igstRate: line.igstRate === '' ? 0 : Number(line.igstRate),
          cgstRate: line.cgstRate === '' ? 0 : Number(line.cgstRate),
          sgstRate: line.sgstRate === '' ? 0 : Number(line.sgstRate),
        })),
        paymentTermsDays: Number(form.paymentTermsDays) || 45,
      };
      if (editingId) {
        await api(`/finance/proformas/${editingId}`, { method: 'PATCH', body });
        setMsg('Proforma saved.');
      } else {
        const res = await api('/finance/proformas', { method: 'POST', body });
        setEditingId(res.data._id);
        setMsg('Proforma draft created.');
      }
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const issue = async () => {
    if (!canWrite || !editingId) return;
    setBusy(true);
    setError('');
    try {
      const res = await api(`/finance/proformas/${editingId}/issue`, { method: 'POST' });
      setMsg(`Issued as ${res.data.documentNumber}.`);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const uploadProforma = async (e) => {
    e.preventDefault();
    if (!canWrite) return;
    if (!uploadForm.file) {
      setError('Choose a file to upload.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', uploadForm.file);
      fd.append('recipientName', uploadForm.recipientName);
      fd.append('projectName', uploadForm.projectName);
      fd.append('documentNumber', uploadForm.documentNumber);
      fd.append('documentDate', uploadForm.documentDate);
      fd.append('grandTotal', uploadForm.grandTotal);
      await api('/finance/proformas/upload', { method: 'POST', body: fd });
      setMsg('Proforma uploaded.');
      setUploadOpen(false);
      if (uploadRef.current) uploadRef.current.value = '';
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const saveOrgProfile = async (e) => {
    e.preventDefault();
    if (!canWrite || !orgProfile) return;
    setBusy(true);
    try {
      const res = await api('/finance/org-profile', {
        method: 'PATCH',
        body: {
          ...orgProfile,
          defaultTerms: String(orgProfile.defaultTermsText || '')
            .split('\n')
            .map((t) => t.trim())
            .filter(Boolean),
          proformaNotes: String(orgProfile.proformaNotesText || '')
            .split('\n')
            .map((t) => t.trim())
            .filter(Boolean),
        },
      });
      setOrgProfile({
        ...res.data,
        defaultTermsText: (res.data.defaultTerms || []).join('\n'),
        proformaNotesText: (res.data.proformaNotes || []).join('\n'),
      });
      setMsg('Organisation profile updated.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (row) => {
    if (!canWrite || !window.confirm(`Delete proforma ${row.documentNumber || row.docKey}?`)) return;
    try {
      await api(`/finance/proformas/${row._id}`, { method: 'DELETE' });
      setMsg('Proforma deleted.');
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    if (orgProfile && orgProfile.defaultTermsText == null) {
      setOrgProfile((p) => ({
        ...p,
        defaultTermsText: (p.defaultTerms || []).join('\n'),
        proformaNotesText: (p.proformaNotes || []).join('\n'),
      }));
    }
  }, [orgProfile]);

  return (
    <div className="finance-proforma">
      <p className="muted" style={{ marginTop: 0 }}>
        Create client proforma invoices (auto-numbered as{' '}
        <span className="mono-sm">{proformaNumberExample()}</span>), or upload external PDFs.
      </p>

      <div className="finance-numbering-legend card" style={{ padding: '10px 14px', marginBottom: 12 }}>
        <strong style={{ fontSize: '0.85rem' }}>Document numbering</strong>
        <ul className="finance-numbering-list muted" style={{ margin: '6px 0 0', paddingLeft: '1.1rem' }}>
          {DOCUMENT_NUMBER_STANDARDS.map((item) => (
            <li key={item.prefix}>
              <span className="mono-sm">{item.example}</span> — {item.label}
            </li>
          ))}
        </ul>
      </div>

      {(error || msg) && (
        <div className={`am-banner ${error ? 'is-error' : 'is-info'}`} role="status">
          {error || msg}
        </div>
      )}

      <div className="inv-toolbar logistics-toolbar">
        <input
          className="inv-search"
          placeholder="Search recipient, project, number…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <AdaptiveSelect
          className="filter-select"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          <option value="Draft">Draft</option>
          <option value="Issued">Issued</option>
          <option value="Uploaded">Uploaded</option>
          <option value="Cancelled">Cancelled</option>
        </AdaptiveSelect>
        <button className="btn secondary" type="button" onClick={() => load()}>
          Search
        </button>
        {canWrite && (
          <>
            <button className="btn" type="button" onClick={openCreate}>
              New proforma
            </button>
            <button className="btn secondary" type="button" onClick={openUpload}>
              Upload PDF
            </button>
            <button
              className="btn secondary"
              type="button"
              onClick={() => setOrgProfileOpen((v) => !v)}
            >
              {orgProfileOpen ? 'Hide letterhead' : 'Letterhead settings'}
            </button>
          </>
        )}
      </div>

      {orgProfileOpen && orgProfile && canWrite && (
        <form className="card finance-proforma-editor" onSubmit={saveOrgProfile}>
          <h3 style={{ marginTop: 0 }}>Organisation letterhead</h3>
          <div className="finance-proforma-grid">
            <div className="field">
              <label>Legal name</label>
              <input
                value={orgProfile.legalName || ''}
                onChange={(e) => setOrgProfile({ ...orgProfile, legalName: e.target.value })}
              />
            </div>
            <div className="field">
              <label>GSTIN</label>
              <input
                value={orgProfile.gstin || ''}
                onChange={(e) => setOrgProfile({ ...orgProfile, gstin: e.target.value })}
              />
            </div>
            <div className="field">
              <label>PAN</label>
              <input
                value={orgProfile.pan || ''}
                onChange={(e) => setOrgProfile({ ...orgProfile, pan: e.target.value })}
              />
            </div>
            <div className="field">
              <label>State code</label>
              <input
                value={orgProfile.stateCode || ''}
                onChange={(e) => setOrgProfile({ ...orgProfile, stateCode: e.target.value })}
              />
            </div>
          </div>
          <div className="field">
            <label>Registered office</label>
            <textarea
              rows={2}
              value={orgProfile.registeredOffice || ''}
              onChange={(e) => setOrgProfile({ ...orgProfile, registeredOffice: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Default terms (one per line)</label>
            <textarea
              rows={3}
              value={orgProfile.defaultTermsText || ''}
              onChange={(e) => setOrgProfile({ ...orgProfile, defaultTermsText: e.target.value })}
            />
          </div>
          <button className="btn" type="submit" disabled={busy}>
            Save letterhead
          </button>
        </form>
      )}

      <div className="card card--flush table-wrap">
        <table>
          <thead>
            <tr>
              <th>Number</th>
              <th>Recipient</th>
              <th>Project</th>
              <th>Date</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Source</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row._id}>
                <td className="mono-sm">{row.documentNumber || row.docKey}</td>
                <td>{row.recipientName}</td>
                <td>{row.projectName || '—'}</td>
                <td>{row.documentDate ? formatDate(row.documentDate) : '—'}</td>
                <td>{formatMoney(row.grandTotal)}</td>
                <td>{row.status}</td>
                <td>{row.source === 'uploaded' ? 'Uploaded' : 'Generated'}</td>
                <td>
                  <div className="finance-proforma-actions">
                    <button
                      className="btn secondary btn-compact"
                      type="button"
                      onClick={() => downloadProformaPdf(row)}
                    >
                      PDF
                    </button>
                    {canWrite && row.source !== 'uploaded' && (
                      <button
                        className="btn secondary btn-compact"
                        type="button"
                        onClick={() => openEdit(row)}
                      >
                        Edit
                      </button>
                    )}
                    {canWrite && (
                      <button
                        className="btn secondary btn-compact"
                        type="button"
                        onClick={() => remove(row)}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <PaginationBar
          page={listMeta.page || page}
          limit={limit}
          total={listMeta.total || 0}
          pages={listMeta.pages || 0}
          loading={listLoading}
          onPageChange={setPage}
          onLimitChange={(n) => {
            setLimit(n);
            setPage(1);
          }}
        />
        {!rows.length && !listLoading && (
          <p className="muted" style={{ padding: '1rem' }}>
            No proforma documents yet. Create one or upload a PDF.
          </p>
        )}
      </div>

      {uploadOpen && canWrite && (
        <form className="card finance-upload-panel" onSubmit={uploadProforma}>
          <h3 style={{ marginTop: 0 }}>Upload proforma PDF</h3>
          <div className="finance-proforma-grid">
            <div className="field">
              <label>Recipient name *</label>
              <input
                required
                value={uploadForm.recipientName}
                onChange={(e) => setUploadForm({ ...uploadForm, recipientName: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Project</label>
              <input
                value={uploadForm.projectName}
                onChange={(e) => setUploadForm({ ...uploadForm, projectName: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Proforma number</label>
              <input
                value={uploadForm.documentNumber}
                onChange={(e) => setUploadForm({ ...uploadForm, documentNumber: e.target.value })}
                placeholder={proformaNumberExample(uploadForm.documentDate)}
              />
            </div>
            <DateInput
              label="Date"
              value={uploadForm.documentDate}
              onChange={(value) => setUploadForm({ ...uploadForm, documentDate: value })}
            />
            <div className="field">
              <label>Amount (INR)</label>
              <input
                type="number"
                min="0"
                step="any"
                value={uploadForm.grandTotal}
                onChange={(e) => setUploadForm({ ...uploadForm, grandTotal: e.target.value })}
              />
            </div>
          </div>
          <div className="field">
            <label>File *</label>
            <FilePicker
              ref={uploadRef}
              accept=".pdf,.doc,.docx,.xls,.xlsx,application/pdf"
              onChange={(e) =>
                setUploadForm({ ...uploadForm, file: e.target.files?.[0] || null })
              }
            />
          </div>
          <div className="finance-proforma-actions">
            <button className="btn" type="submit" disabled={busy}>
              Upload
            </button>
            <button className="btn secondary" type="button" onClick={() => setUploadOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {formOpen && canWrite && (
        <form className="card finance-proforma-editor" onSubmit={save}>
          <h3 style={{ marginTop: 0 }}>{editingId ? 'Edit proforma' : 'New proforma'}</h3>

          {clientMasters.length > 0 && (
            <div className="field">
              <label>Prefill from Client Master</label>
              <AdaptiveSelect
                value=""
                onChange={(e) => {
                  if (e.target.value) applyClientMaster(e.target.value);
                }}
              >
                <option value="">Select program…</option>
                {clientMasters.map((m) => (
                  <option key={m._id} value={m._id}>
                    {m.clientName} — {m.programName || m.campName || 'Program'}
                  </option>
                ))}
              </AdaptiveSelect>
            </div>
          )}

          <div className="finance-proforma-grid">
            <div className="field">
              <label>Recipient name *</label>
              <input
                required
                value={form.recipientName}
                onChange={(e) => setForm({ ...form, recipientName: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Project</label>
              <input
                value={form.projectName}
                onChange={(e) => setForm({ ...form, projectName: e.target.value })}
              />
            </div>
            <DateInput
              label="Date *"
              required
              value={form.documentDate}
              onChange={(value) => setForm({ ...form, documentDate: value })}
            />
            <DateInput
              label="Due date"
              value={form.dueDate}
              min={form.documentDate || undefined}
              onChange={(value) => setForm({ ...form, dueDate: value })}
            />
            <div className="field">
              <label>Contact person</label>
              <input
                value={form.contactPerson}
                onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Email</label>
              <input
                type="email"
                value={form.contactEmail}
                onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Recipient GSTIN</label>
              <input
                value={form.recipientGstin}
                onChange={(e) => setForm({ ...form, recipientGstin: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Recipient PAN</label>
              <input
                value={form.recipientPan}
                onChange={(e) => setForm({ ...form, recipientPan: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Recipient state code</label>
              <input
                value={form.recipientStateCode}
                onChange={(e) => setForm({ ...form, recipientStateCode: e.target.value })}
                placeholder="e.g. 27 for Maharashtra"
              />
            </div>
            <div className="field">
              <label>Payment terms (days)</label>
              <input
                type="number"
                min="0"
                value={form.paymentTermsDays}
                onChange={(e) => setForm({ ...form, paymentTermsDays: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Reverse charge (Y/N)</label>
              <AdaptiveSelect
                value={form.reverseCharge}
                onChange={(e) => setForm({ ...form, reverseCharge: e.target.value })}
              >
                <option value="N">N</option>
                <option value="Y">Y</option>
              </AdaptiveSelect>
            </div>
          </div>

          <div className="field">
            <label>Place of supply</label>
            <textarea
              rows={2}
              value={form.placeOfSupply}
              onChange={(e) => setForm({ ...form, placeOfSupply: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Delivery address</label>
            <textarea
              rows={2}
              value={form.deliveryAddress}
              onChange={(e) => setForm({ ...form, deliveryAddress: e.target.value })}
            />
          </div>

          <fieldset className="finance-line-items">
            <legend>Line items</legend>
            {form.lineItems.map((line, index) => (
              <div className="finance-line-item" key={`line-${index}`}>
                <div className="finance-line-item-head">
                  <strong>Line {index + 1}</strong>
                  {form.lineItems.length > 1 && (
                    <button
                      className="btn secondary btn-compact"
                      type="button"
                      onClick={() => removeLine(index)}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="finance-line-item-grid">
                  <div className="field">
                    <label>Section title</label>
                    <input
                      value={line.sectionTitle}
                      onChange={(e) => updateLine(index, { sectionTitle: e.target.value })}
                      placeholder="Optional group heading"
                    />
                  </div>
                  <div className="field" style={{ gridColumn: '1 / -1' }}>
                    <label>Description *</label>
                    <textarea
                      rows={2}
                      value={line.description}
                      onChange={(e) => updateLine(index, { description: e.target.value })}
                      placeholder="Service description"
                    />
                  </div>
                  <div className="field">
                    <label>SAC</label>
                    <input
                      value={line.sacCode}
                      onChange={(e) => updateLine(index, { sacCode: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label>Qty</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={line.qty}
                      onChange={(e) => updateLine(index, { qty: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label>Rate</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={line.rate}
                      onChange={(e) => updateLine(index, { rate: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label>Discount</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={line.discount}
                      onChange={(e) => updateLine(index, { discount: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label>IGST %</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={line.igstRate}
                      onChange={(e) => updateLine(index, { igstRate: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label>CGST %</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={line.cgstRate}
                      onChange={(e) => updateLine(index, { cgstRate: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label>SGST %</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={line.sgstRate}
                      onChange={(e) => updateLine(index, { sgstRate: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            ))}
            <div className="finance-proforma-actions">
              <button className="btn secondary btn-compact" type="button" onClick={addLine}>
                Add line
              </button>
              <button className="btn secondary btn-compact" type="button" onClick={addSection}>
                Add section heading
              </button>
              <span className="finance-proforma-total muted">
                Est. subtotal: ₹{formatMoney(previewTotal)}
              </span>
            </div>
          </fieldset>

          <div className="field">
            <label>Custom notes (printed above terms)</label>
            <textarea
              rows={2}
              value={form.customNotes}
              onChange={(e) => setForm({ ...form, customNotes: e.target.value })}
            />
          </div>

          <div className="finance-proforma-actions">
            <button className="btn" type="submit" disabled={busy}>
              {editingId ? 'Save draft' : 'Create draft'}
            </button>
            {editingId && (
              <>
                <button className="btn secondary" type="button" disabled={busy} onClick={issue}>
                  Issue ({proformaNumberExample(form.documentDate).replace('-001', '-###')})
                </button>
                <button
                  className="btn secondary"
                  type="button"
                  onClick={() => downloadProformaPdf({ _id: editingId, documentNumber: form.documentNumber })}
                >
                  Preview PDF
                </button>
              </>
            )}
            <button
              className="btn secondary"
              type="button"
              onClick={() => {
                setFormOpen(false);
                setEditingId('');
              }}
            >
              Close
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
