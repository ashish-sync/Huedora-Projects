import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../shared/api.js';
import { useAuth } from '../../shared/auth.jsx';

const FALLBACK_ENTRY = ['Inward', 'Outward', 'Transfer', 'Return', 'Stock Adjustment'];
const FALLBACK_PRODUCT = [
  'Medical Device',
  'Non-Medical Device',
  'Consumable',
  'Spare Part / Accessory',
  'Document',
  'Miscellaneous',
];
const FALLBACK_DELIVERY = ['Hand Delivery', 'Porter', 'Blue Dart', 'DTDC', 'Other Courier'];
const FALLBACK_COURIER = ['Blue Dart', 'DTDC', 'Other Courier'];
const FALLBACK_CAT_DEFAULTS = {
  'Medical Device': { expiryApplicable: false, trackingKind: 'Serial' },
  'Non-Medical Device': { expiryApplicable: false, trackingKind: 'Serial' },
  Consumable: { expiryApplicable: true, trackingKind: 'Batch' },
  'Spare Part / Accessory': { expiryApplicable: false, trackingKind: 'Batch + Serial' },
  Document: { expiryApplicable: false, trackingKind: 'None' },
  Miscellaneous: { expiryApplicable: false, trackingKind: 'None' },
};

function nowLocal() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function emptyForm(user, defaultWarehouseId = '') {
  return {
    uniqueKey: '',
    warehouseId: defaultWarehouseId,
    entryType: 'Inward',
    transactionDateTime: nowLocal(),
    productType: 'Medical Device',
    productId: '',
    productName: '',
    programProject: '',
    qty: '1',
    state: '',
    city: '',
    contactId: '',
    recipientName: '',
    empId: '',
    number: '',
    expiryApplicable: false,
    trackingKind: 'Serial',
    expiryDate: '',
    batchOrSerial: '',
    deliveryMode: 'Hand Delivery',
    awbNumber: '',
    remark: '',
    createdBy: user?.email || user?.fullName || '',
  };
}

function Field({ label, required, children, hint }) {
  return (
    <div className="field">
      <label>
        {label}
        {required ? ' *' : ''}
      </label>
      {children}
      {hint ? (
        <span className="muted" style={{ fontSize: '0.72rem' }}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}

export default function LogisticsInOutPage() {
  const { can, user } = useAuth();
  const canWrite = can('logistics:write') || can('*');
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [entryTypeFilter, setEntryTypeFilter] = useState('');
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [form, setForm] = useState(() => emptyForm(user));
  const [busy, setBusy] = useState(false);

  const cfg = meta?.inOut || {};
  const entryTypes = cfg.entryTypes || FALLBACK_ENTRY;
  const productTypes = cfg.productTypes || FALLBACK_PRODUCT;
  const deliveryModes = cfg.deliveryModes || FALLBACK_DELIVERY;
  const courierModes = cfg.courierModes || FALLBACK_COURIER;
  const categoryDefaults = cfg.categoryDefaults || FALLBACK_CAT_DEFAULTS;
  const warehouses = meta?.warehouses || [];
  const products = meta?.products || [];
  const defaultWarehouseName = cfg.defaultWarehouseName || 'Mumbai Warehouse';

  const defaultWarehouseId = useMemo(() => {
    const hit =
      warehouses.find((w) => w.name === defaultWarehouseName) ||
      warehouses.find((w) => /mumbai/i.test(w.name || '')) ||
      warehouses[0];
    return hit?._id || '';
  }, [warehouses, defaultWarehouseName]);

  const productsForType = useMemo(
    () => products.filter((p) => !form.productType || p.productType === form.productType),
    [products, form.productType]
  );

  const states = useMemo(() => {
    const set = new Set(contacts.map((c) => c.state).filter(Boolean));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [contacts]);

  const recipientsForState = useMemo(() => {
    if (!form.state) return contacts;
    return contacts.filter((c) => c.state === form.state);
  }, [contacts, form.state]);

  const needsAwb = courierModes.includes(form.deliveryMode);
  const tracked = form.trackingKind && form.trackingKind !== 'None';

  const load = useCallback(async () => {
    setError('');
    try {
      const params = new URLSearchParams({ limit: '200' });
      if (entryTypeFilter) params.set('entryType', entryTypeFilter);
      if (q.trim()) params.set('q', q.trim());
      const res = await api(`/logistics/in-out?${params}`);
      setRows(res.data || []);
    } catch (e) {
      setError(e.message);
    }
  }, [entryTypeFilter, q]);

  useEffect(() => {
    api('/logistics/meta')
      .then((r) => setMeta(r.data))
      .catch(() => {});
    api('/contacts?limit=500')
      .then((r) => setContacts(r.data || []))
      .catch(() => setContacts([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const onProductCategoryChange = (next) => {
    const defaults = categoryDefaults[next] || FALLBACK_CAT_DEFAULTS[next] || {
      expiryApplicable: false,
      trackingKind: 'None',
    };
    setForm((f) => ({
      ...f,
      productType: next,
      productId: '',
      productName: '',
      programProject: '',
      expiryApplicable: !!defaults.expiryApplicable,
      trackingKind: defaults.trackingKind,
      expiryDate: defaults.expiryApplicable ? f.expiryDate : '',
      batchOrSerial: defaults.trackingKind === 'None' ? 'N/A' : '',
    }));
  };

  const pickProduct = (productId) => {
    const p = products.find((x) => x._id === productId);
    if (!p) {
      setForm((f) => ({
        ...f,
        productId: '',
        productName: '',
        programProject: '',
      }));
      return;
    }
    const defaults =
      categoryDefaults[p.productType || form.productType] ||
      FALLBACK_CAT_DEFAULTS[p.productType || form.productType] ||
      {};
    const expiryApplicable =
      p.expiryApplicable != null ? !!p.expiryApplicable : !!defaults.expiryApplicable;
    const trackingKind = p.trackingKind || defaults.trackingKind || 'None';
    setForm((f) => ({
      ...f,
      productId: p._id,
      productName: p.name || '',
      programProject: p.programProject || '',
      productType: p.productType || f.productType,
      expiryApplicable,
      trackingKind,
      batchOrSerial: trackingKind === 'None' ? 'N/A' : f.batchOrSerial === 'N/A' ? '' : f.batchOrSerial,
      expiryDate: expiryApplicable ? f.expiryDate : '',
    }));
  };

  const onStateChange = (state) => {
    setForm((f) => ({
      ...f,
      state,
      city: '',
      contactId: '',
      recipientName: '',
      empId: '',
      number: '',
    }));
  };

  const pickRecipient = (contactId) => {
    const c = contacts.find((x) => x._id === contactId);
    if (!c) {
      setForm((f) => ({
        ...f,
        contactId: '',
        recipientName: '',
        empId: '',
        number: '',
        city: f.state ? f.city : '',
      }));
      return;
    }
    setForm((f) => ({
      ...f,
      contactId: c._id,
      recipientName: c.name || '',
      empId: c.employeeId || c.email || '',
      number: c.contact || c.mobile || '',
      city: c.city || '',
      state: c.state || f.state,
    }));
  };

  const openCreate = () => {
    const base = emptyForm(user, defaultWarehouseId);
    const defaults = categoryDefaults[base.productType] || FALLBACK_CAT_DEFAULTS[base.productType];
    base.expiryApplicable = !!defaults?.expiryApplicable;
    base.trackingKind = defaults?.trackingKind || 'Serial';
    base.batchOrSerial = base.trackingKind === 'None' ? 'N/A' : '';
    setEditingId('');
    setForm(base);
    setFormOpen(true);
    setMsg('');
    setError('');
  };

  const openEdit = (row) => {
    setEditingId(row._id);
    setForm({
      uniqueKey: row.uniqueKey || '',
      warehouseId: row.warehouseId || row.sourceWarehouseId || defaultWarehouseId,
      entryType: row.entryType || 'Inward',
      transactionDateTime: String(row.transactionDateTime || nowLocal()).slice(0, 16),
      productType: row.productType || row.inventoryType || 'Medical Device',
      productId: row.productId || '',
      productName: row.productName || '',
      programProject: row.programProject || '',
      qty: String(row.qty ?? '1'),
      state: row.state || '',
      city: row.city || '',
      contactId: row.contactId || '',
      recipientName: row.recipientName || row.employeeName || row.name || '',
      empId: row.empId || '',
      number: row.number || '',
      expiryApplicable: !!row.expiryApplicable,
      trackingKind: row.trackingKind || row.trackingType || 'None',
      expiryDate: String(row.expiryDate || row.expDate || '').slice(0, 10),
      batchOrSerial: row.batchOrSerial || row.serialNumber || row.batchNumber || '',
      deliveryMode: row.deliveryMode || row.mode || row.courier || 'Hand Delivery',
      awbNumber: row.awbNumber || '',
      remark: row.remark || '',
      createdBy: row.createdBy || '',
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
        warehouseId: form.warehouseId || null,
        sourceWarehouseId: form.warehouseId || null,
        contactId: form.contactId || null,
        productId: form.productId || null,
        employeeName: form.recipientName,
        name: form.recipientName,
        qty: Number(form.qty) || 0,
        batchOrSerial: tracked ? form.batchOrSerial : 'N/A',
        transactionDate: String(form.transactionDateTime || '').slice(0, 10),
      };
      if (editingId) {
        await api(`/logistics/in-out/${editingId}`, { method: 'PATCH', body });
        setMsg('Transaction updated.');
      } else {
        await api('/logistics/in-out', { method: 'POST', body });
        setMsg('Transaction saved — inventory updated.');
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
    if (!canWrite) return;
    if (!window.confirm(`Delete transaction ${row.uniqueKey || row._id}?`)) return;
    try {
      await api(`/logistics/in-out/${row._id}`, { method: 'DELETE' });
      setMsg('Transaction deleted.');
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const warehouseName = useMemo(() => {
    const map = Object.fromEntries(warehouses.map((w) => [w._id, w.name || w.code]));
    return (id) => (id ? map[id] || '—' : '—');
  }, [warehouses]);

  return (
    <div className="logistics-inout">
      <p className="muted" style={{ marginTop: 0 }}>
        Inventory Ledger — product details from Product Master, recipient from Contact Directory.
        Expiry / Batch / Serial and AWB follow product and delivery rules.
      </p>

      {(error || msg) && (
        <div className={`am-banner ${error ? 'is-error' : 'is-info'}`} role="status">
          {error || msg}
        </div>
      )}

      <div className="logistics-entity-tabs" role="tablist" aria-label="Filter by Entry Type">
        <button
          type="button"
          role="tab"
          aria-selected={!entryTypeFilter}
          className={`logistics-entity-tab${!entryTypeFilter ? ' is-active' : ''}`}
          onClick={() => setEntryTypeFilter('')}
        >
          All
        </button>
        {entryTypes.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={entryTypeFilter === t}
            className={`logistics-entity-tab${entryTypeFilter === t ? ' is-active' : ''}`}
            onClick={() => setEntryTypeFilter(t)}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="inv-toolbar logistics-toolbar">
        <input
          className="esign-search inv-search"
          placeholder="Search TXN, product, recipient…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load()}
        />
        <button className="btn secondary" type="button" onClick={load}>
          Search
        </button>
        {canWrite && (
          <button
            className="btn"
            type="button"
            onClick={() => {
              if (formOpen && !editingId) {
                setFormOpen(false);
                return;
              }
              openCreate();
            }}
          >
            {formOpen && !editingId ? 'Close form' : '+ New transaction'}
          </button>
        )}
      </div>

      {canWrite && formOpen && (
        <form className="card logistics-form logistics-txn-form" onSubmit={save}>
          <h3>{editingId ? 'Edit transaction' : 'Inventory transaction'}</h3>

          <h4 className="logistics-form-section">1. Source</h4>
          <div className="logistics-form-grid logistics-form-grid--inout">
            <Field label="Source Warehouse" required hint={`Default: ${defaultWarehouseName}`}>
              <select
                required
                value={form.warehouseId}
                onChange={(e) => setField('warehouseId', e.target.value)}
              >
                <option value="">Select warehouse…</option>
                {warehouses.map((w) => (
                  <option key={w._id} value={w._id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <h4 className="logistics-form-section">2. Transaction</h4>
          <div className="logistics-form-grid logistics-form-grid--inout">
            <Field label="Entry Type" required>
              <select
                required
                value={form.entryType}
                onChange={(e) => setField('entryType', e.target.value)}
              >
                {entryTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Transaction Date" required hint="Auto — current date & time">
              <input
                type="datetime-local"
                required
                value={form.transactionDateTime}
                onChange={(e) => setField('transactionDateTime', e.target.value)}
              />
            </Field>
          </div>

          <h4 className="logistics-form-section">3. Product</h4>
          <div className="logistics-form-grid logistics-form-grid--inout">
            <Field label="Product Category" required>
              <select
                required
                value={form.productType}
                onChange={(e) => onProductCategoryChange(e.target.value)}
              >
                {productTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Product Name" required hint="From Product Master">
              <select
                required
                value={form.productId}
                onChange={(e) => pickProduct(e.target.value)}
              >
                <option value="">Select product…</option>
                {productsForType.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name}
                    {p.programProject ? ` · ${p.programProject}` : ''}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Program / Project" hint="From Product Master">
              <input readOnly className="is-readonly" value={form.programProject} />
            </Field>
            <Field label="Quantity" required>
              <input
                type="number"
                min={1}
                step="1"
                required
                value={form.qty}
                onChange={(e) => setField('qty', e.target.value)}
              />
            </Field>
          </div>

          <h4 className="logistics-form-section">4. Recipient</h4>
          <div className="logistics-form-grid logistics-form-grid--inout">
            <Field label="State" hint="From Contact Directory">
              <select value={form.state} onChange={(e) => onStateChange(e.target.value)}>
                <option value="">All states…</option>
                {states.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="City" hint="Auto based on selected recipient">
              <input readOnly className="is-readonly" value={form.city} />
            </Field>
            <Field label="Recipient Name" required hint="From Contact Directory">
              <select
                required
                value={form.contactId}
                onChange={(e) => pickRecipient(e.target.value)}
              >
                <option value="">Select recipient…</option>
                {recipientsForState.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                    {c.city ? ` · ${c.city}` : ''}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Employee ID" hint="Auto from contact">
              <input readOnly className="is-readonly" value={form.empId} />
            </Field>
            <Field label="Mobile Number" hint="Auto from contact">
              <input readOnly className="is-readonly" value={form.number} />
            </Field>
          </div>

          <h4 className="logistics-form-section">5. Inventory Tracking</h4>
          <div className="logistics-form-grid logistics-form-grid--inout">
            <Field label="Expiry Applicable" hint="Auto from Product Master">
              <input
                readOnly
                className="is-readonly"
                value={form.expiryApplicable ? 'Yes' : 'No'}
              />
            </Field>
            {form.expiryApplicable && (
              <Field label="Expiry Date" required>
                <input
                  type="date"
                  required
                  value={form.expiryDate}
                  onChange={(e) => setField('expiryDate', e.target.value)}
                />
              </Field>
            )}
            <Field
              label="Batch / Serial Number"
              required={tracked}
              hint={
                tracked
                  ? `Required (${form.trackingKind})`
                  : 'N/A — not applicable for this product'
              }
            >
              {tracked ? (
                <input
                  required
                  value={form.batchOrSerial}
                  onChange={(e) => setField('batchOrSerial', e.target.value)}
                  placeholder={form.trackingKind}
                />
              ) : (
                <input readOnly className="is-readonly" value="N/A" />
              )}
            </Field>
          </div>

          <h4 className="logistics-form-section">6. Logistics</h4>
          <div className="logistics-form-grid logistics-form-grid--inout">
            <Field label="Delivery Mode" required>
              <select
                required
                value={form.deliveryMode}
                onChange={(e) => {
                  const mode = e.target.value;
                  setForm((f) => ({
                    ...f,
                    deliveryMode: mode,
                    awbNumber: courierModes.includes(mode) ? f.awbNumber : '',
                  }));
                }}
              >
                {deliveryModes.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </Field>
            {needsAwb && (
              <Field label="AWB Number" required hint="Required for courier deliveries">
                <input
                  required
                  value={form.awbNumber}
                  onChange={(e) => setField('awbNumber', e.target.value)}
                />
              </Field>
            )}
            <Field label="Remarks">
              <textarea
                rows={2}
                value={form.remark}
                onChange={(e) => setField('remark', e.target.value)}
              />
            </Field>
          </div>

          <div className="logistics-form-actions">
            <button className="btn" type="submit" disabled={busy}>
              {busy ? 'Saving…' : editingId ? 'Save changes' : 'Save transaction'}
            </button>
            <button
              className="btn secondary"
              type="button"
              onClick={() => {
                setFormOpen(false);
                setEditingId('');
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="card table-wrap logistics-inout-table-wrap" style={{ padding: 0 }}>
        <table className="inv-table logistics-inout-table">
          <thead>
            <tr>
              <th>TXN ID</th>
              <th>Entry Type</th>
              <th>Date</th>
              <th>Warehouse</th>
              <th>Category</th>
              <th>Product</th>
              <th>Program</th>
              <th className="num">Qty</th>
              <th>Recipient</th>
              <th>City</th>
              <th>Delivery</th>
              <th>Tracking</th>
              {canWrite && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r._id}>
                <td className="mono-sm">{r.uniqueKey || '—'}</td>
                <td>
                  <span className="badge tone-neutral">{r.entryType || '—'}</span>
                </td>
                <td className="mono-sm">
                  {r.transactionDateTime
                    ? String(r.transactionDateTime).replace('T', ' ').slice(0, 16)
                    : r.transactionDate || '—'}
                </td>
                <td>{warehouseName(r.warehouseId || r.sourceWarehouseId)}</td>
                <td>{r.productType || r.inventoryType || '—'}</td>
                <td>
                  <strong>{r.productName || '—'}</strong>
                </td>
                <td>{r.programProject || '—'}</td>
                <td className="num mono-sm">{r.qty ?? '—'}</td>
                <td>{r.recipientName || r.employeeName || r.name || '—'}</td>
                <td>{r.city || '—'}</td>
                <td>{r.deliveryMode || r.mode || r.courier || '—'}</td>
                <td className="mono-sm">
                  {r.batchOrSerial || r.serialNumber || r.batchNumber || 'N/A'}
                </td>
                {canWrite && (
                  <td className="inv-actions">
                    <button type="button" className="linkish" onClick={() => openEdit(r)}>
                      Edit
                    </button>
                    <button type="button" className="linkish" onClick={() => remove(r)}>
                      Delete
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={canWrite ? 13 : 12}>
                  <div className="inv-empty">
                    <strong>No transactions yet</strong>
                    <p className="muted">
                      Add products in Inventory &amp; Vendor Master and contacts in Contact Directory,
                      then create a transaction.
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
