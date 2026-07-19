import { useCallback, useEffect, useState } from 'react';
import AdaptiveSelect from '../../components/ui/AdaptiveSelect.jsx';
import OtherAwareSelect from '../../components/ui/OtherAwareSelect.jsx';
import PaginationBar from '../../components/ui/PaginationBar.jsx';
import { api } from '../../shared/api.js';
import { useAuth } from '../../shared/auth.jsx';
import { usePicklistOptions } from '../../shared/usePicklistOptions.js';

const FALLBACK_PAYMENT_MODES = ['Bank transfer', 'UPI', 'Cheque', 'Cash', 'Card', 'Other'];

const emptyForm = {
  invoiceNumber: '',
  vendorName: '',
  amount: '',
  taxAmount: '',
  totalAmount: '',
  invoiceDate: '',
  dueDate: '',
  status: 'Open',
  paymentMode: '',
  remarks: '',
};

function formatMoney(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return '-';
  return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function FinanceInvoicesPage() {
  const { can } = useAuth();
  const canWrite = can('finance:write') || can('*');
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [listMeta, setListMeta] = useState({ page: 1, limit: 25, total: 0, pages: 0 });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState('');
  const [busy, setBusy] = useState(false);
  const [listLoading, setListLoading] = useState(false);

  const statuses = meta?.invoiceStatuses || [];
  const paymentModesMeta = meta?.paymentModes || FALLBACK_PAYMENT_MODES;
  const { options: paymentModeOptions } = usePicklistOptions(
    'finance.paymentMode',
    FALLBACK_PAYMENT_MODES
  );
  const paymentModes = paymentModeOptions.length ? paymentModeOptions : paymentModesMeta;

  const loadMeta = useCallback(async () => {
    try {
      const res = await api('/finance/meta');
      setMeta(res.data);
    } catch {
      /* ignore */
    }
  }, []);

  const load = useCallback(async () => {
    setListLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (q.trim()) params.set('q', q.trim());
      if (status) params.set('status', status);
      const res = await api(`/finance/invoices?${params}`);
      setRows(res.data || []);
      setListMeta(res.meta || { page, limit, total: 0, pages: 0 });
    } catch (e) {
      setError(e.message);
    } finally {
      setListLoading(false);
    }
  }, [page, limit, q, status]);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditingId('');
    setForm({ ...emptyForm, invoiceDate: todayIso() });
    setFormOpen(true);
    setMsg('');
    setError('');
  };

  const openEdit = (row) => {
    setEditingId(row._id);
    setForm({
      invoiceNumber: row.invoiceNumber || '',
      vendorName: row.vendorName || '',
      amount: row.amount == null ? '' : String(row.amount),
      taxAmount: row.taxAmount == null ? '' : String(row.taxAmount),
      totalAmount: row.totalAmount == null ? '' : String(row.totalAmount),
      invoiceDate: row.invoiceDate || '',
      dueDate: row.dueDate || '',
      status: row.status || 'Open',
      paymentMode: row.paymentMode || '',
      remarks: row.remarks || '',
    });
    setFormOpen(true);
    setMsg('');
    setError('');
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
        amount: form.amount === '' ? 0 : Number(form.amount),
        taxAmount: form.taxAmount === '' ? 0 : Number(form.taxAmount),
        totalAmount: form.totalAmount === '' ? undefined : Number(form.totalAmount),
      };
      if (editingId) {
        await api(`/finance/invoices/${editingId}`, { method: 'PATCH', body });
        setMsg('Invoice updated.');
      } else {
        await api('/finance/invoices', { method: 'POST', body });
        setMsg('Invoice recorded.');
      }
      setFormOpen(false);
      setEditingId('');
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (row) => {
    if (!canWrite || !window.confirm(`Delete invoice “${row.invoiceNumber}”?`)) return;
    try {
      await api(`/finance/invoices/${row._id}`, { method: 'DELETE' });
      setMsg('Invoice deleted.');
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="finance-invoices">
      <p className="muted" style={{ marginTop: 0 }}>
        Vendor invoices with tax, due date, and payment status.
      </p>

      {(error || msg) && (
        <div className={`am-banner ${error ? 'is-error' : 'is-info'}`} role="status">
          {error || msg}
        </div>
      )}

      <div className="inv-toolbar logistics-toolbar">
        <input
          className="esign-search inv-search"
          placeholder="Search invoice no., vendor…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setPage(1);
              load();
            }
          }}
        />
        <AdaptiveSelect
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </AdaptiveSelect>
        <button
          className="btn secondary"
          type="button"
          onClick={() => {
            setPage(1);
            load();
          }}
        >
          Search
        </button>
        {canWrite && (
          <button className="btn" type="button" onClick={() => (formOpen ? setFormOpen(false) : openCreate())}>
            {formOpen ? 'Close form' : '+ Add invoice'}
          </button>
        )}
      </div>

      {canWrite && formOpen && (
        <form className="card logistics-form" onSubmit={save}>
          <h3>{editingId ? 'Edit invoice' : 'New invoice'}</h3>
          <div className="logistics-form-grid">
            <div className="field">
              <label>Invoice number *</label>
              <input
                required
                value={form.invoiceNumber}
                onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Vendor *</label>
              <input
                required
                value={form.vendorName}
                onChange={(e) => setForm({ ...form, vendorName: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Amount *</label>
              <input
                required
                type="number"
                min={0}
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Tax</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.taxAmount}
                onChange={(e) => setForm({ ...form, taxAmount: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Total (optional)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.totalAmount}
                onChange={(e) => setForm({ ...form, totalAmount: e.target.value })}
                placeholder="Amount + tax if blank"
              />
            </div>
            <div className="field">
              <label>Invoice date *</label>
              <input
                required
                type="date"
                value={form.invoiceDate}
                onChange={(e) => setForm({ ...form, invoiceDate: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Due date</label>
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Status</label>
              <AdaptiveSelect value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {statuses.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </AdaptiveSelect>
            </div>
            <div className="field">
              <label>Payment mode</label>
              <OtherAwareSelect
                picklistKey="finance.paymentMode"
                source="finance-invoice"
                options={paymentModes}
                value={form.paymentMode}
                onChange={(e) => setForm({ ...form, paymentMode: e.target.value })}
                placeholder="-"
              />
            </div>
            <div className="field am-form-span">
              <label>Remarks</label>
              <textarea
                rows={2}
                value={form.remarks}
                onChange={(e) => setForm({ ...form, remarks: e.target.value })}
              />
            </div>
          </div>
          <div className="logistics-form-actions">
            <button className="btn" type="submit" disabled={busy}>
              {busy ? 'Saving…' : editingId ? 'Update invoice' : 'Save invoice'}
            </button>
          </div>
        </form>
      )}

      <div className="card card--flush table-wrap">
        <table className="inv-table">
          <thead>
            <tr>
              <th>Key</th>
              <th>Invoice no.</th>
              <th>Vendor</th>
              <th>Date</th>
              <th>Due</th>
              <th>Status</th>
              <th className="num">Total</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r._id}>
                <td className="mono-sm">{r.invoiceKey || '-'}</td>
                <td>
                  <strong>{r.invoiceNumber}</strong>
                </td>
                <td>{r.vendorName || '-'}</td>
                <td>{r.invoiceDate || '-'}</td>
                <td>{r.dueDate || '-'}</td>
                <td>
                  <span className="badge tone-neutral">{r.status || '-'}</span>
                </td>
                <td className="num mono-sm">{formatMoney(r.totalAmount)}</td>
                <td>
                  {canWrite && (
                    <div className="inv-row-actions">
                      <button type="button" className="inv-link" onClick={() => openEdit(r)}>
                        Edit
                      </button>
                      <button type="button" className="inv-link" onClick={() => remove(r)}>
                        Delete
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={8} className="muted">
                  No invoices yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
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
  );
}
