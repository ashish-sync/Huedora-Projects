import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AdaptiveSelect from '../../components/ui/AdaptiveSelect.jsx';
import DateInput from '../../components/ui/DateInput.jsx';
import FilePicker from '../../components/ui/FilePicker.jsx';
import PaginationBar from '../../components/ui/PaginationBar.jsx';
import { api, apiFetch } from '../../shared/api.js';
import { formatDate, todayIso } from '../../shared/dateFormat.js';
import { useAuth } from '../../shared/auth.jsx';
import './finance-commercial.css';
import { purchaseOrderNumberExample } from './documentNumbering.js';

function formatMoney(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return '—';
  return num.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

const emptyLine = () => ({
  description: '',
  qty: '',
  rate: '',
  isFoc: false,
});

const emptyForm = () => ({
  vendorName: '',
  vendorGstin: '',
  vendorAddress: '',
  contactPerson: '',
  contactEmail: '',
  documentDate: todayIso(),
  dueDate: '',
  purchaseTaxRate: 5,
  notes: 'It was great doing business with you.',
  lineItems: [{ ...emptyLine(), description: '', qty: '1', rate: '' }],
});

async function downloadPoPdf(row, { download = true } = {}) {
  const res = await apiFetch(
    `/finance/purchase-orders/${row._id}/pdf?download=${download ? '1' : '0'}`
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
  a.download = `${(row.documentNumber || row.docKey || 'purchase-order').replace(/[^\w.-]+/g, '_')}.pdf`;
  if (!download) a.target = '_blank';
  a.click();
  URL.revokeObjectURL(url);
}

export default function FinancePurchaseOrdersPage() {
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
  const [vendors, setVendors] = useState([]);
  const [uploadForm, setUploadForm] = useState({
    vendorName: '',
    vendorAddress: '',
    documentNumber: '',
    documentDate: todayIso(),
    grandTotal: '',
    file: null,
  });

  const preview = useMemo(() => {
    const subtotal = form.lineItems.reduce((sum, line) => {
      const qty = Number(line.qty) || 0;
      const rate = line.isFoc ? 0 : Number(line.rate) || 0;
      return sum + qty * rate;
    }, 0);
    const tax = (subtotal * (Number(form.purchaseTaxRate) || 0)) / 100;
    return { subtotal, tax, total: subtotal + tax };
  }, [form.lineItems, form.purchaseTaxRate]);

  const load = useCallback(async () => {
    setListLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (q.trim()) params.set('q', q.trim());
      if (status) params.set('status', status);
      const res = await api(`/finance/purchase-orders?${params}`);
      setRows(res.data || []);
      setListMeta(res.meta || { page, limit, total: 0, pages: 0 });
    } catch (e) {
      setError(e.message);
    } finally {
      setListLoading(false);
    }
  }, [page, limit, q, status]);

  const loadVendors = useCallback(async () => {
    try {
      const res = await api('/contacts?limit=200');
      const list = (res.data || []).filter(
        (c) => String(c.contactCategory || '').toLowerCase() === 'vendor'
      );
      setVendors(list);
    } catch {
      setVendors([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadVendors();
  }, [loadVendors]);

  const applyVendor = (contactId) => {
    const vendor = vendors.find((v) => v._id === contactId);
    if (!vendor) return;
    const address = [vendor.organization, vendor.address, vendor.city, vendor.state, vendor.pinCode]
      .filter(Boolean)
      .join(', ');
    setForm((f) => ({
      ...f,
      contactId,
      vendorName: vendor.organization || vendor.name,
      vendorGstin: vendor.gstin || f.vendorGstin,
      vendorAddress: address || f.vendorAddress,
      contactPerson: vendor.name || f.contactPerson,
      contactEmail: vendor.email || f.contactEmail,
    }));
  };

  const openCreate = () => {
    setEditingId('');
    setForm(emptyForm());
    setFormOpen(true);
    setUploadOpen(false);
    setMsg('');
    setError('');
  };

  const openEdit = async (row) => {
    if (row.source === 'uploaded') {
      setError('Uploaded PO files cannot be edited here.');
      return;
    }
    try {
      const res = await api(`/finance/purchase-orders/${row._id}`);
      const data = res.data;
      setEditingId(data._id);
      setForm({
        vendorName: data.recipientName || '',
        vendorGstin: data.recipientGstin || '',
        vendorAddress: data.placeOfSupply || '',
        contactPerson: data.contactPerson || '',
        contactEmail: data.contactEmail || '',
        documentDate: data.documentDate || todayIso(),
        dueDate: data.dueDate || '',
        purchaseTaxRate: data.purchaseTaxRate ?? 5,
        notes: data.customNotes || '',
        lineItems: (data.lineItems || []).length
          ? data.lineItems.map((line) => ({
              description: line.description || '',
              qty: line.qty == null ? '' : String(line.qty),
              rate: line.rate == null ? '' : String(line.rate),
              isFoc: Boolean(line.isFoc),
            }))
          : [emptyLine()],
      });
      setFormOpen(true);
      setUploadOpen(false);
    } catch (e) {
      setError(e.message);
    }
  };

  const updateLine = (index, patch) => {
    setForm((f) => {
      const lineItems = [...f.lineItems];
      lineItems[index] = { ...lineItems[index], ...patch };
      return { ...f, lineItems };
    });
  };

  const save = async (e) => {
    e.preventDefault();
    if (!canWrite) return;
    setBusy(true);
    setError('');
    try {
      const body = {
        ...form,
        lineItems: form.lineItems.map((line) => ({
          ...line,
          qty: line.qty === '' ? 0 : Number(line.qty),
          rate: line.isFoc ? 0 : line.rate === '' ? 0 : Number(line.rate),
        })),
        purchaseTaxRate: Number(form.purchaseTaxRate) || 0,
      };
      if (editingId) {
        await api(`/finance/purchase-orders/${editingId}`, { method: 'PATCH', body });
        setMsg('Purchase order saved.');
      } else {
        const res = await api('/finance/purchase-orders', { method: 'POST', body });
        setEditingId(res.data._id);
        setMsg('Purchase order draft created.');
      }
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const issue = async () => {
    if (!editingId) return;
    setBusy(true);
    try {
      const res = await api(`/finance/purchase-orders/${editingId}/issue`, { method: 'POST' });
      setMsg(`Issued as ${res.data.documentNumber}.`);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const uploadPo = async (e) => {
    e.preventDefault();
    if (!uploadForm.file) {
      setError('Choose a file to upload.');
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', uploadForm.file);
      fd.append('vendorName', uploadForm.vendorName);
      fd.append('vendorAddress', uploadForm.vendorAddress);
      fd.append('documentNumber', uploadForm.documentNumber);
      fd.append('documentDate', uploadForm.documentDate);
      fd.append('grandTotal', uploadForm.grandTotal);
      await api('/finance/purchase-orders/upload', { method: 'POST', body: fd });
      setMsg('Purchase order uploaded.');
      setUploadOpen(false);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (row) => {
    if (!window.confirm(`Delete PO ${row.documentNumber || row.docKey}?`)) return;
    await api(`/finance/purchase-orders/${row._id}`, { method: 'DELETE' });
    setMsg('Purchase order deleted.');
    load();
  };

  return (
    <div className="finance-purchase-orders">
      <p className="muted" style={{ marginTop: 0 }}>
        Vendor purchase orders auto-numbered as{' '}
        <span className="mono-sm">{purchaseOrderNumberExample()}</span>.
      </p>

      {(error || msg) && (
        <div className={`am-banner ${error ? 'is-error' : 'is-info'}`} role="status">
          {error || msg}
        </div>
      )}

      <div className="inv-toolbar logistics-toolbar">
        <input
          className="inv-search"
          placeholder="Search vendor, PO number…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <AdaptiveSelect className="filter-select" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="Draft">Draft</option>
          <option value="Issued">Issued</option>
          <option value="Uploaded">Uploaded</option>
        </AdaptiveSelect>
        <button className="btn secondary" type="button" onClick={load}>
          Search
        </button>
        {canWrite && (
          <>
            <button className="btn" type="button" onClick={openCreate}>
              New PO
            </button>
            <button className="btn secondary" type="button" onClick={() => setUploadOpen(true)}>
              Upload PDF
            </button>
          </>
        )}
      </div>

      <div className="card card--flush table-wrap">
        <table>
          <thead>
            <tr>
              <th>PO#</th>
              <th>Vendor</th>
              <th>Order date</th>
              <th>Delivery</th>
              <th>Total</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row._id}>
                <td className="mono-sm">{row.documentNumber || row.docKey}</td>
                <td>{row.recipientName}</td>
                <td>{row.documentDate ? formatDate(row.documentDate) : '—'}</td>
                <td>{row.dueDate ? formatDate(row.dueDate) : '—'}</td>
                <td>{formatMoney(row.grandTotal)}</td>
                <td>{row.status}</td>
                <td>
                  <div className="finance-proforma-actions">
                    <button className="btn secondary btn-compact" type="button" onClick={() => downloadPoPdf(row)}>
                      PDF
                    </button>
                    {canWrite && row.source !== 'uploaded' && (
                      <button className="btn secondary btn-compact" type="button" onClick={() => openEdit(row)}>
                        Edit
                      </button>
                    )}
                    {canWrite && (
                      <button className="btn secondary btn-compact" type="button" onClick={() => remove(row)}>
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
      </div>

      {uploadOpen && canWrite && (
        <form className="card finance-upload-panel" onSubmit={uploadPo}>
          <h3 style={{ marginTop: 0 }}>Upload purchase order PDF</h3>
          <div className="finance-proforma-grid">
            <div className="field">
              <label>Vendor name *</label>
              <input required value={uploadForm.vendorName} onChange={(e) => setUploadForm({ ...uploadForm, vendorName: e.target.value })} />
            </div>
            <div className="field">
              <label>PO number</label>
              <input
                value={uploadForm.documentNumber}
                placeholder={purchaseOrderNumberExample(uploadForm.documentDate)}
                onChange={(e) => setUploadForm({ ...uploadForm, documentNumber: e.target.value })}
              />
            </div>
            <DateInput label="Order date" value={uploadForm.documentDate} onChange={(v) => setUploadForm({ ...uploadForm, documentDate: v })} />
            <div className="field">
              <label>Total amount</label>
              <input type="number" value={uploadForm.grandTotal} onChange={(e) => setUploadForm({ ...uploadForm, grandTotal: e.target.value })} />
            </div>
          </div>
          <div className="field">
            <label>File *</label>
            <FilePicker ref={uploadRef} accept=".pdf,application/pdf" onChange={(e) => setUploadForm({ ...uploadForm, file: e.target.files?.[0] || null })} />
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
          <h3 style={{ marginTop: 0 }}>{editingId ? 'Edit purchase order' : 'New purchase order'}</h3>

          {vendors.length > 0 && (
            <div className="field">
              <label>Vendor from Contact Directory</label>
              <AdaptiveSelect value="" onChange={(e) => e.target.value && applyVendor(e.target.value)}>
                <option value="">Select vendor…</option>
                {vendors.map((v) => (
                  <option key={v._id} value={v._id}>
                    {v.organization || v.name}
                    {v.city ? ` · ${v.city}` : ''}
                  </option>
                ))}
              </AdaptiveSelect>
            </div>
          )}

          <div className="finance-proforma-grid">
            <div className="field">
              <label>Vendor name *</label>
              <input required value={form.vendorName} onChange={(e) => setForm({ ...form, vendorName: e.target.value })} />
            </div>
            <div className="field">
              <label>Vendor GSTIN</label>
              <input value={form.vendorGstin} onChange={(e) => setForm({ ...form, vendorGstin: e.target.value })} />
            </div>
            <DateInput label="Order date *" required value={form.documentDate} onChange={(v) => setForm({ ...form, documentDate: v })} />
            <DateInput label="Delivery date" value={form.dueDate} min={form.documentDate || undefined} onChange={(v) => setForm({ ...form, dueDate: v })} />
            <div className="field">
              <label>Purchase tax %</label>
              <input type="number" min="0" step="any" value={form.purchaseTaxRate} onChange={(e) => setForm({ ...form, purchaseTaxRate: e.target.value })} />
            </div>
          </div>

          <div className="field">
            <label>Vendor address *</label>
            <textarea rows={3} required value={form.vendorAddress} onChange={(e) => setForm({ ...form, vendorAddress: e.target.value })} />
          </div>

          <fieldset className="finance-line-items">
            <legend>Line items</legend>
            {form.lineItems.map((line, index) => (
              <div className="finance-line-item" key={`po-line-${index}`}>
                <div className="finance-line-item-grid">
                  <div className="field" style={{ gridColumn: '1 / -1' }}>
                    <label>Item description *</label>
                    <input required value={line.description} onChange={(e) => updateLine(index, { description: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>Qty</label>
                    <input type="number" min="0" value={line.qty} onChange={(e) => updateLine(index, { qty: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>Rate</label>
                    <input type="number" min="0" disabled={line.isFoc} value={line.rate} onChange={(e) => updateLine(index, { rate: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>FOC</label>
                    <AdaptiveSelect value={line.isFoc ? 'yes' : 'no'} onChange={(e) => updateLine(index, { isFoc: e.target.value === 'yes', rate: e.target.value === 'yes' ? '0' : line.rate })}>
                      <option value="no">No</option>
                      <option value="yes">Yes</option>
                    </AdaptiveSelect>
                  </div>
                </div>
              </div>
            ))}
            <button className="btn secondary btn-compact" type="button" onClick={() => setForm({ ...form, lineItems: [...form.lineItems, emptyLine()] })}>
              Add line
            </button>
            <p className="muted">
              Subtotal ₹{formatMoney(preview.subtotal)} · Tax ₹{formatMoney(preview.tax)} · Total ₹
              {formatMoney(preview.total)}
            </p>
          </fieldset>

          <div className="field">
            <label>Notes</label>
            <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>

          <div className="finance-proforma-actions">
            <button className="btn" type="submit" disabled={busy}>
              Save draft
            </button>
            {editingId && (
              <>
                <button className="btn secondary" type="button" disabled={busy} onClick={issue}>
                  Issue ({purchaseOrderNumberExample(form.documentDate).replace('-001', '-###')})
                </button>
                <button className="btn secondary" type="button" onClick={() => downloadPoPdf({ _id: editingId })}>
                  Preview PDF
                </button>
              </>
            )}
            <button className="btn secondary" type="button" onClick={() => setFormOpen(false)}>
              Close
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
