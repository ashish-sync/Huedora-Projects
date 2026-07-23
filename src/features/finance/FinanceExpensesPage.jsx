import { useCallback, useEffect, useState } from 'react';
import AdaptiveSelect from '../../components/ui/AdaptiveSelect.jsx';
import OtherAwareSelect from '../../components/ui/OtherAwareSelect.jsx';
import PaginationBar from '../../components/ui/PaginationBar.jsx';
import DateInput from '../../components/ui/DateInput.jsx';
import { api } from '../../shared/api.js';
import { formatDate, todayIso } from '../../shared/dateFormat.js';
import { useAuth } from '../../shared/auth.jsx';
import { usePicklistOptions } from '../../shared/usePicklistOptions.js';

const FALLBACK_CATEGORIES = [
  'Travel',
  'Training',
  'Camp',
  'Maintenance',
  'Courier',
  'Utilities',
  'Professional fees',
  'Other',
];
const FALLBACK_PAYMENT_MODES = ['Bank transfer', 'UPI', 'Cheque', 'Cash', 'Card', 'Other'];

const emptyForm = {
  title: '',
  category: '',
  amount: '',
  expenseDate: '',
  status: 'Draft',
  paymentMode: '',
  payeeName: '',
  remarks: '',
};

function formatMoney(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return '-';
  return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export default function FinanceExpensesPage() {
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

  const categoriesMeta = meta?.expenseCategories || FALLBACK_CATEGORIES;
  const statuses = meta?.expenseStatuses || [];
  const paymentModesMeta = meta?.paymentModes || FALLBACK_PAYMENT_MODES;
  const { options: categoryOptions } = usePicklistOptions('finance.category', FALLBACK_CATEGORIES);
  const { options: paymentModeOptions } = usePicklistOptions(
    'finance.paymentMode',
    FALLBACK_PAYMENT_MODES
  );
  const categories = categoryOptions.length ? categoryOptions : categoriesMeta;
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
      const res = await api(`/finance/expenses?${params}`);
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
    setForm({ ...emptyForm, expenseDate: todayIso() });
    setFormOpen(true);
    setMsg('');
    setError('');
  };

  const openEdit = (row) => {
    setEditingId(row._id);
    setForm({
      title: row.title || '',
      category: row.category || 'Other',
      amount: row.amount == null ? '' : String(row.amount),
      expenseDate: row.expenseDate || '',
      status: row.status || 'Draft',
      paymentMode: row.paymentMode || '',
      payeeName: row.payeeName || '',
      remarks: row.remarks || '',
    });
    setFormOpen(true);
    setMsg('');
    setError('');
  };

  const save = async (e) => {
    e.preventDefault();
    if (!canWrite) return;
    const category = String(form.category || '').trim();
    if (!category || /^other$/i.test(category)) {
      setError('Select a category (use Other to enter a custom value).');
      return;
    }
    const paymentMode = String(form.paymentMode || '').trim();
    if (paymentMode && /^other$/i.test(paymentMode)) {
      setError('Enter a specific payment mode instead of Other.');
      return;
    }
    setBusy(true);
    setError('');
    setMsg('');
    try {
      const body = {
        ...form,
        amount: form.amount === '' ? 0 : Number(form.amount),
      };
      if (editingId) {
        await api(`/finance/expenses/${editingId}`, { method: 'PATCH', body });
        setMsg('Expense updated.');
      } else {
        await api('/finance/expenses', { method: 'POST', body });
        setMsg('Expense recorded.');
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
    if (!canWrite || !window.confirm(`Delete expense “${row.title}”?`)) return;
    try {
      await api(`/finance/expenses/${row._id}`, { method: 'DELETE' });
      setMsg('Expense deleted.');
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="finance-expenses">
      <p className="muted" style={{ marginTop: 0 }}>
        Operational expenses with status from draft through paid.
      </p>

      {(error || msg) && (
        <div className={`am-banner ${error ? 'is-error' : 'is-info'}`} role="status">
          {error || msg}
        </div>
      )}

      <div className="inv-toolbar logistics-toolbar">
        <input
          className="esign-search inv-search"
          placeholder="Search key, title, payee…"
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
            {formOpen ? 'Close form' : '+ Add expense'}
          </button>
        )}
      </div>

      {canWrite && formOpen && (
        <form className="card logistics-form" onSubmit={save}>
          <h3>{editingId ? 'Edit expense' : 'New expense'}</h3>
          <div className="logistics-form-grid">
            <div className="field">
              <label>Title *</label>
              <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="field">
              <label>Category *</label>
              <OtherAwareSelect
                required
                picklistKey="finance.category"
                source="finance-expense"
                options={categories}
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Amount *</label>
              <input
                required
                type="number"
                min={0.01}
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </div>
            <DateInput
              label="Date *"
              required
              value={form.expenseDate}
              onChange={(value) => setForm({ ...form, expenseDate: value })}
            />
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
                source="finance-expense"
                options={paymentModes}
                value={form.paymentMode}
                onChange={(e) => setForm({ ...form, paymentMode: e.target.value })}
                placeholder="-"
              />
            </div>
            <div className="field">
              <label>Payee</label>
              <input value={form.payeeName} onChange={(e) => setForm({ ...form, payeeName: e.target.value })} />
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
              {busy ? 'Saving…' : editingId ? 'Update expense' : 'Save expense'}
            </button>
          </div>
        </form>
      )}

      <div className="card card--flush table-wrap">
        <table className="inv-table">
          <thead>
            <tr>
              <th>Key</th>
              <th>Title</th>
              <th>Category</th>
              <th>Date</th>
              <th>Status</th>
              <th className="num">Amount</th>
              <th>Payee</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r._id}>
                <td className="mono-sm">{r.expenseKey || '-'}</td>
                <td>
                  <strong>{r.title}</strong>
                </td>
                <td>{r.category || '-'}</td>
                <td>{r.expenseDate ? formatDate(r.expenseDate) : '-'}</td>
                <td>
                  <span className="badge tone-neutral">{r.status || '-'}</span>
                </td>
                <td className="num mono-sm">{formatMoney(r.amount)}</td>
                <td>{r.payeeName || '-'}</td>
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
                  No expenses yet.
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
