import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, apiUrl } from '../../shared/api.js';
import { useAuth } from '../../shared/auth.jsx';
import {
  FALLBACK_CAT_DEFAULTS,
  FALLBACK_PRODUCT,
  Field,
  emptyTxnForm,
  isInwardRow,
} from './logisticsTxnShared.jsx';

const SOURCES = [
  {
    id: 'seller',
    label: 'Seller / Purchase',
    entryType: 'Inward',
    remarkPrefix: '',
    blurb: 'Goods receipt from vendor into warehouse',
  },
  {
    id: 'return',
    label: 'Field return / Callback',
    entryType: 'Return',
    remarkPrefix: 'Field return / Callback',
    blurb: 'Stock returned from HCW / field, including callbacks and recalls',
  },
  {
    id: 'other',
    label: 'Other inward',
    entryType: 'Inward',
    remarkPrefix: 'Other inward',
    blurb: 'Any other receipt that ends at warehouse',
  },
];

export default function LogisticsInwardPage() {
  const { can, user } = useAuth();
  const canWrite = can('logistics:write') || can('*');
  const [sourceId, setSourceId] = useState('seller');
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(() => emptyTxnForm(user, { entryType: 'Inward' }));
  const [busy, setBusy] = useState(false);
  const [productPhoto, setProductPhoto] = useState(null);
  const [invoiceDoc, setInvoiceDoc] = useState(null);
  const [docsExtra, setDocsExtra] = useState([]);

  const source = SOURCES.find((s) => s.id === sourceId) || SOURCES[0];
  const cfg = meta?.inOut || {};
  const productTypes = cfg.productTypes || FALLBACK_PRODUCT;
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

  const load = useCallback(async () => {
    setError('');
    try {
      const params = new URLSearchParams({ limit: '300' });
      if (q.trim()) params.set('q', q.trim());
      const res = await api(`/logistics/in-out?${params}`);
      setRows((res.data || []).filter((r) => isInwardRow(r.entryType)));
    } catch (e) {
      setError(e.message);
    }
  }, [q]);

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

  const openCreate = () => {
    const base = emptyTxnForm(user, {
      entryType: source.entryType,
      warehouseId: defaultWarehouseId,
    });
    const defaults = categoryDefaults[base.productType] || FALLBACK_CAT_DEFAULTS[base.productType];
    base.expiryApplicable = !!defaults?.expiryApplicable;
    base.trackingKind = defaults?.trackingKind || 'Batch';
    base.batchOrSerial = base.trackingKind === 'None' ? 'N/A' : '';
    if (source.remarkPrefix) base.remark = source.remarkPrefix;
    setForm(base);
    setProductPhoto(null);
    setInvoiceDoc(null);
    setDocsExtra([]);
    setFormOpen(true);
    setMsg('');
    setError('');
  };

  const onProductCategoryChange = (next) => {
    const defaults = categoryDefaults[next] || FALLBACK_CAT_DEFAULTS[next] || {};
    setForm((f) => ({
      ...f,
      productType: next,
      productId: '',
      productName: '',
      programProject: '',
      expiryApplicable: !!defaults.expiryApplicable,
      trackingKind: defaults.trackingKind || 'None',
      expiryDate: defaults.expiryApplicable ? f.expiryDate : '',
      batchOrSerial: defaults.trackingKind === 'None' ? 'N/A' : '',
    }));
  };

  const pickProduct = (productId) => {
    const p = products.find((x) => x._id === productId);
    if (!p) {
      setForm((f) => ({ ...f, productId: '', productName: '', programProject: '' }));
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
      perUnitCost: p.defaultPerUnitCost != null ? String(p.defaultPerUnitCost) : f.perUnitCost,
    }));
  };

  const pickContact = (contactId) => {
    const c = contacts.find((x) => x._id === contactId);
    if (!c) {
      setForm((f) => ({ ...f, contactId: '', recipientName: '', empId: '', number: '', city: '' }));
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

  const tracked = form.trackingKind && form.trackingKind !== 'None';

  const save = async (e) => {
    e.preventDefault();
    if (!canWrite) return;
    setBusy(true);
    setError('');
    setMsg('');
    try {
      const remark =
        source.remarkPrefix && !String(form.remark || '').startsWith(source.remarkPrefix)
          ? `${source.remarkPrefix}${form.remark ? ` — ${form.remark}` : ''}`
          : form.remark;

      const fd = new FormData();
      const payload = {
        ...form,
        entryType: source.entryType,
        warehouseId: form.warehouseId || '',
        sourceWarehouseId: form.warehouseId || '',
        contactId: form.contactId || '',
        productId: form.productId || '',
        employeeName: form.recipientName,
        name: form.recipientName,
        qty: String(Number(form.qty) || 0),
        perUnitCost: String(Number(form.perUnitCost) || 0),
        batchOrSerial: tracked ? form.batchOrSerial : 'N/A',
        transactionDate: String(form.transactionDateTime || '').slice(0, 10),
        remark,
        expiryApplicable: form.expiryApplicable ? 'true' : 'false',
      };
      Object.entries(payload).forEach(([k, v]) => {
        if (v == null || v === '') return;
        if (typeof v === 'boolean') fd.append(k, v ? 'true' : 'false');
        else fd.append(k, String(v));
      });
      if (productPhoto) fd.append('productPhoto', productPhoto);
      if (invoiceDoc) fd.append('invoiceDoc', invoiceDoc);
      for (const f of docsExtra) fd.append('docsExtra', f);

      await api('/logistics/in-out', { method: 'POST', body: fd });
      setMsg('Inward saved — warehouse stock updated.');
      setFormOpen(false);
      setProductPhoto(null);
      setInvoiceDoc(null);
      setDocsExtra([]);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="logistics-inout ilog-flow">
      <p className="muted" style={{ marginTop: 0 }}>
        Inward — everything that ends at the warehouse: seller receipts, field returns / callbacks,
        and other receipts.
      </p>

      {(error || msg) && (
        <div className={`am-banner ${error ? 'is-error' : 'is-info'}`} role="status">
          {error || msg}
        </div>
      )}

      <div className="ilog-source-tabs" role="tablist" aria-label="Inward source">
        {SOURCES.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={sourceId === s.id}
            className={`ilog-source-tab${sourceId === s.id ? ' is-active' : ''}`}
            onClick={() => {
              setSourceId(s.id);
              setFormOpen(false);
            }}
            title={s.blurb}
          >
            {s.label}
          </button>
        ))}
      </div>
      <p className="muted ilog-source-hint">{source.blurb}</p>

      <div className="inv-toolbar logistics-toolbar">
        <input
          className="esign-search inv-search"
          placeholder="Search TXN, product…"
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
              if (formOpen) {
                setFormOpen(false);
                return;
              }
              openCreate();
            }}
          >
            {formOpen ? 'Close form' : '+ Record inward'}
          </button>
        )}
      </div>

      {canWrite && formOpen && (
        <form className="card logistics-form logistics-txn-form" onSubmit={save}>
          <h3>New {source.label}</h3>
          <div className="logistics-form-grid logistics-form-grid--inout">
            <Field label="Destination warehouse" required>
              <select
                required
                value={form.warehouseId}
                onChange={(e) => setField('warehouseId', e.target.value)}
              >
                <option value="">Select…</option>
                {warehouses.map((w) => (
                  <option key={w._id} value={w._id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Date & time" required>
              <input
                type="datetime-local"
                required
                value={form.transactionDateTime}
                onChange={(e) => setField('transactionDateTime', e.target.value)}
              />
            </Field>
            <Field label="Product category" required>
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
            <Field label="Product" required>
              <select
                required
                value={form.productId}
                onChange={(e) => pickProduct(e.target.value)}
              >
                <option value="">Select product…</option>
                {productsForType.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Qty" required>
              <input
                type="number"
                min="0"
                step="any"
                required
                value={form.qty}
                onChange={(e) => setField('qty', e.target.value)}
              />
            </Field>
            <Field label="Per unit cost">
              <input
                type="number"
                min="0"
                step="any"
                value={form.perUnitCost}
                onChange={(e) => setField('perUnitCost', e.target.value)}
              />
            </Field>
            {form.expiryApplicable && (
              <Field label="Expiry date" required>
                <input
                  type="date"
                  required
                  value={form.expiryDate}
                  onChange={(e) => setField('expiryDate', e.target.value)}
                />
              </Field>
            )}
            {tracked && (
              <Field label="Batch / Serial" required>
                <input
                  required
                  value={form.batchOrSerial}
                  onChange={(e) => setField('batchOrSerial', e.target.value)}
                />
              </Field>
            )}
            {source.id === 'return' && (
              <Field label="Returned by (contact)">
                <select value={form.contactId} onChange={(e) => pickContact(e.target.value)}>
                  <option value="">—</option>
                  {contacts.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                      {c.city ? ` — ${c.city}` : ''}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Field label="Remark">
              <input value={form.remark} onChange={(e) => setField('remark', e.target.value)} />
            </Field>
          </div>

          <h4 className="logistics-form-section">Attachments</h4>
          <div className="logistics-form-grid logistics-form-grid--inout">
            <Field label="Product photo" hint="JPG / PNG of the product received">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setProductPhoto(e.target.files?.[0] || null)}
              />
              {productPhoto && (
                <span className="muted mono-sm">{productPhoto.name}</span>
              )}
            </Field>
            <Field label="Invoice / document" hint="Invoice, challan, GRN, or other PDF / image">
              <input
                type="file"
                accept="image/*,.pdf,.doc,.docx"
                onChange={(e) => setInvoiceDoc(e.target.files?.[0] || null)}
              />
              {invoiceDoc && <span className="muted mono-sm">{invoiceDoc.name}</span>}
            </Field>
            <Field label="Additional documents" hint="Optional — up to 5 files">
              <input
                type="file"
                accept="image/*,.pdf,.doc,.docx"
                multiple
                onChange={(e) => setDocsExtra([...((e.target.files && Array.from(e.target.files)) || [])].slice(0, 5))}
              />
              {!!docsExtra.length && (
                <span className="muted mono-sm">{docsExtra.length} file(s) selected</span>
              )}
            </Field>
          </div>

          <div className="logistics-form-actions">
            <button className="btn" type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Save inward'}
            </button>
            <button className="btn secondary" type="button" onClick={() => setFormOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="card table-wrap" style={{ padding: 0 }}>
        <table className="inv-table">
          <thead>
            <tr>
              <th>TXN</th>
              <th>Type</th>
              <th>Date</th>
              <th>Product</th>
              <th className="num">Qty</th>
              <th>From / Contact</th>
              <th>Attachments</th>
              <th>Remark</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r._id}>
                <td className="mono-sm">{r.uniqueKey || '—'}</td>
                <td>{r.entryType}</td>
                <td className="mono-sm">{String(r.transactionDate || r.transactionDateTime || '').slice(0, 10)}</td>
                <td>
                  <strong>{r.productName || r.itemName || '—'}</strong>
                </td>
                <td className="num">{r.qty}</td>
                <td>{r.recipientName || r.employeeName || r.name || '—'}</td>
                <td className="ilog-attach-cell">
                  {r.productPhoto?.url && (
                    <a href={apiUrl(r.productPhoto.url)} target="_blank" rel="noreferrer">
                      Photo
                    </a>
                  )}
                  {r.invoiceDoc?.url && (
                    <a href={apiUrl(r.invoiceDoc.url)} target="_blank" rel="noreferrer">
                      Invoice
                    </a>
                  )}
                  {(r.attachments || []).map((a, i) => (
                    <a key={a.filename || i} href={apiUrl(a.url)} target="_blank" rel="noreferrer">
                      Doc {i + 1}
                    </a>
                  ))}
                  {!r.productPhoto?.url && !r.invoiceDoc?.url && !(r.attachments || []).length && (
                    <span className="muted">—</span>
                  )}
                </td>
                <td className="muted">{r.remark || '—'}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={8} className="muted">
                  No inward transactions yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
