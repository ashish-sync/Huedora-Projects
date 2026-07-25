import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AdaptiveSelect from '../../components/ui/AdaptiveSelect.jsx';
import DateInput from '../../components/ui/DateInput.jsx';
import PaginationBar from '../../components/ui/PaginationBar.jsx';
import { api, apiFetch } from '../../shared/api.js';
import { formatDate, todayIso } from '../../shared/dateFormat.js';
import { useAuth } from '../../shared/auth.jsx';
import './finance-commercial.css';
import { DOCUMENT_NUMBER_STANDARDS, invoiceNumberExample } from './documentNumbering.js';

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
  igstRate: '18',
  cgstRate: '9',
  sgstRate: '9',
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
  lineItems: [{ ...emptyLine(), description: 'Healthcare camp services', qty: '1', rate: '' }],
});

function serializeForm(form) {
  return {
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
}

async function fetchPreviewBlobUrl(form) {
  const res = await apiFetch('/finance/client-invoices/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(serializeForm(form)),
  });
  if (!res.ok) {
    let message = 'Could not load invoice preview';
    try {
      const json = await res.json();
      if (json?.error?.message) message = json.error.message;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

async function downloadInvoicePdf(row, { download = true } = {}) {
  const res = await apiFetch(
    `/finance/client-invoices/${row._id}/pdf?download=${download ? '1' : '0'}`
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
  a.download = `${(row.documentNumber || row.docKey || 'invoice').replace(/[^\w.-]+/g, '_')}.pdf`;
  if (!download) a.target = '_blank';
  a.click();
  URL.revokeObjectURL(url);
}

export default function FinanceGenerateInvoicePage() {
  const { can } = useAuth();
  const canWrite = can('finance:write') || can('*');

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

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [clientMasters, setClientMasters] = useState([]);

  const [livePreview, setLivePreview] = useState(true);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const previewTimerRef = useRef(null);
  const previewUrlRef = useRef('');

  const previewTotal = useMemo(() => {
    return form.lineItems.reduce((sum, line) => {
      const qty = Number(line.qty) || 0;
      const rate = Number(line.rate) || 0;
      const discount = Number(line.discount) || 0;
      return sum + Math.max(qty * rate - discount, 0);
    }, 0);
  }, [form.lineItems]);

  const revokePreviewUrl = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = '';
    }
    setPreviewUrl('');
  }, []);

  const refreshPreview = useCallback(async () => {
    if (!editorOpen) return;
    setPreviewLoading(true);
    setPreviewError('');
    try {
      const url = await fetchPreviewBlobUrl(form);
      revokePreviewUrl();
      previewUrlRef.current = url;
      setPreviewUrl(url);
    } catch (err) {
      setPreviewError(err.message || 'Preview failed');
    } finally {
      setPreviewLoading(false);
    }
  }, [editorOpen, form, revokePreviewUrl]);

  const load = useCallback(async () => {
    setListLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (q.trim()) params.set('q', q.trim());
      if (status) params.set('status', status);
      const res = await api(`/finance/client-invoices?${params}`);
      setRows(res.data || []);
      setListMeta(res.meta || { page, limit, total: 0, pages: 0 });
    } catch (e) {
      setError(e.message);
    } finally {
      setListLoading(false);
    }
  }, [page, limit, q, status]);

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
    loadClientMasters();
  }, [loadClientMasters]);

  useEffect(() => {
    return () => revokePreviewUrl();
  }, [revokePreviewUrl]);

  useEffect(() => {
    if (!editorOpen || !livePreview) return undefined;
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    previewTimerRef.current = setTimeout(() => {
      refreshPreview();
    }, 700);
    return () => {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    };
  }, [editorOpen, livePreview, form, refreshPreview]);

  const applyClientMaster = (masterId) => {
    const master = clientMasters.find((m) => m._id === masterId);
    if (!master) return;
    setForm((f) => ({
      ...f,
      clientMasterId: master._id,
      recipientName: master.clientName || f.recipientName,
      projectName: master.programName || master.campName || f.projectName,
      placeOfSupply: [master.city, master.state].filter(Boolean).join(', ') || f.placeOfSupply,
      contactPerson: master.contactPerson || f.contactPerson,
      contactEmail: master.contactEmail || f.contactEmail,
      recipientGstin: master.gstin || f.recipientGstin,
    }));
  };

  const openCreate = () => {
    setEditingId('');
    setForm(emptyForm());
    setEditorOpen(true);
    setMsg('');
    setError('');
    setPreviewError('');
  };

  const openEdit = async (row) => {
    if (row.source === 'uploaded') {
      setError('Uploaded invoice files cannot be edited here.');
      return;
    }
    try {
      const res = await api(`/finance/client-invoices/${row._id}`);
      const data = res.data;
      setEditingId(data._id);
      setForm({
        recipientName: data.recipientName || '',
        projectName: data.projectName || '',
        placeOfSupply: data.placeOfSupply || '',
        deliveryAddress: data.deliveryAddress || '',
        contactPerson: data.contactPerson || '',
        contactEmail: data.contactEmail || '',
        recipientGstin: data.recipientGstin || '',
        recipientPan: data.recipientPan || '',
        recipientStateCode: data.recipientStateCode || '',
        reference: data.reference || '',
        documentDate: data.documentDate || todayIso(),
        dueDate: data.dueDate || '',
        paymentTermsDays: data.paymentTermsDays ?? 45,
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
      setEditorOpen(true);
      setMsg('');
      setError('');
      setPreviewError('');
    } catch (e) {
      setError(e.message);
    }
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setEditingId('');
    revokePreviewUrl();
    setPreviewError('');
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
      lineItems: [
        ...f.lineItems,
        { sectionTitle: 'Section heading', description: '', sacCode: '', qty: '', rate: '' },
      ],
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
    const recipientName = String(form.recipientName || '').trim();
    if (!recipientName) {
      setError('Recipient name is required.');
      return;
    }
    const describedLines = form.lineItems.filter((line) => String(line.description || '').trim());
    if (!describedLines.length) {
      setError('Add at least one line item with a description.');
      return;
    }
    if (previewTotal <= 0) {
      setError('Grand total must be greater than zero.');
      return;
    }
    setBusy(true);
    setError('');
    setMsg('');
    try {
      const body = serializeForm(form);
      if (editingId) {
        await api(`/finance/client-invoices/${editingId}`, { method: 'PATCH', body });
        setMsg('Invoice draft saved.');
      } else {
        const res = await api('/finance/client-invoices', { method: 'POST', body });
        setEditingId(res.data._id);
        setMsg('Invoice draft created. Review the live preview, then issue when ready.');
      }
      load();
      if (livePreview) refreshPreview();
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
      const res = await api(`/finance/client-invoices/${editingId}/issue`, { method: 'POST' });
      setMsg(`Tax invoice issued as ${res.data.documentNumber}.`);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="finance-generate-invoice">
      <p className="muted" style={{ marginTop: 0 }}>
        Draft client tax invoices with a live PDF preview matching your finalized layout. Invoices
        are auto-numbered as <span className="mono-sm">{invoiceNumberExample()}</span> on issue.
      </p>

      <div className="finance-numbering-legend card" style={{ padding: '10px 14px', marginBottom: 12 }}>
        <strong style={{ fontSize: '0.85rem' }}>Document numbering</strong>
        <ul className="finance-numbering-list muted" style={{ margin: '6px 0 0', paddingLeft: '1.1rem' }}>
          {DOCUMENT_NUMBER_STANDARDS.filter((item) => item.documentType === 'client_invoice').map(
            (item) => (
              <li key={item.prefix}>
                <span className="mono-sm">{item.example}</span> — {item.label}
              </li>
            )
          )}
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
          <option value="Cancelled">Cancelled</option>
        </AdaptiveSelect>
        <button className="btn secondary" type="button" onClick={() => load()}>
          Search
        </button>
        {canWrite && (
          <button className="btn" type="button" onClick={openCreate}>
            New tax invoice
          </button>
        )}
      </div>

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
                <td>
                  <div className="finance-proforma-actions">
                    <button
                      className="btn secondary btn-compact"
                      type="button"
                      onClick={() => downloadInvoicePdf(row)}
                    >
                      PDF
                    </button>
                    {canWrite && row.status === 'Draft' && (
                      <button
                        className="btn secondary btn-compact"
                        type="button"
                        onClick={() => openEdit(row)}
                      >
                        Edit
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
            No client invoices yet. Create a draft to preview the tax invoice layout before issuing.
          </p>
        )}
      </div>

      {editorOpen && canWrite && (
        <div className="finance-generate-split">
          <form className="card finance-proforma-editor finance-generate-form" onSubmit={save}>
            <h3 style={{ marginTop: 0 }}>{editingId ? 'Edit tax invoice' : 'New tax invoice'}</h3>
            <p className="muted" style={{ marginTop: 0, fontSize: '0.85rem' }}>
              Fill in details on the left. The live preview on the right updates as you type so you
              can verify the layout before creating or issuing.
            </p>

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
                <label>Bill to (recipient) *</label>
                <input
                  required
                  value={form.recipientName}
                  onChange={(e) => setForm({ ...form, recipientName: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Project / camp</label>
                <input
                  value={form.projectName}
                  onChange={(e) => setForm({ ...form, projectName: e.target.value })}
                />
              </div>
              <DateInput
                label="Invoice date *"
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
              <label>Place of supply (Bill To address)</label>
              <textarea
                rows={2}
                value={form.placeOfSupply}
                onChange={(e) => setForm({ ...form, placeOfSupply: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Ship to / delivery address</label>
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
                      <label>HSN/SAC</label>
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
                      <label>Rate (₹)</label>
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
                    Issue invoice ({invoiceNumberExample(form.documentDate).replace('-001', '-###')})
                  </button>
                  <button
                    className="btn secondary"
                    type="button"
                    onClick={() => downloadInvoicePdf({ _id: editingId })}
                  >
                    Download PDF
                  </button>
                </>
              )}
              <button className="btn secondary" type="button" onClick={closeEditor}>
                Close
              </button>
            </div>
          </form>

          <aside className="finance-generate-preview card">
            <div className="inv-pdf-preview-head">
              <div>
                <strong>Live preview</strong>
                <p className="muted" style={{ margin: '2px 0 0', fontSize: '0.8rem' }}>
                  Tax invoice layout — updates as you edit
                </p>
              </div>
              <div className="finance-proforma-actions">
                <label className="finance-preview-toggle">
                  <input
                    type="checkbox"
                    checked={livePreview}
                    onChange={(e) => setLivePreview(e.target.checked)}
                  />
                  Auto-refresh
                </label>
                <button
                  className="btn secondary btn-compact"
                  type="button"
                  disabled={previewLoading}
                  onClick={refreshPreview}
                >
                  {previewLoading ? 'Refreshing…' : 'Refresh now'}
                </button>
              </div>
            </div>

            {previewError && (
              <p className="error" style={{ padding: '0 12px', margin: '8px 0 0' }}>
                {previewError}
              </p>
            )}

            <div className="inv-pdf-preview" style={{ marginTop: 8 }}>
              {previewUrl ? (
                <iframe
                  title="Tax invoice live preview"
                  className="inv-pdf-frame finance-invoice-preview-frame"
                  src={previewUrl}
                />
              ) : (
                <div className="finance-preview-placeholder muted">
                  {previewLoading
                    ? 'Generating preview…'
                    : livePreview
                      ? 'Preview will appear shortly…'
                      : 'Turn on auto-refresh or click Refresh now'}
                </div>
              )}
            </div>
          </aside>
        </div>
      )}

      {!canWrite && (
        <p className="meta-text" style={{ marginTop: 12 }}>
          You have view-only access. Ask an administrator for Finance write access to generate
          invoices.
        </p>
      )}
    </div>
  );
}
