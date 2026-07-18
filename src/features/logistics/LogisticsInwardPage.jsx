import { useCallback, useEffect, useMemo, useState } from 'react';
import AdaptiveSelect from '../../components/ui/AdaptiveSelect.jsx';
import FilePicker from '../../components/ui/FilePicker.jsx';
import { api, apiUrl } from '../../shared/api.js';
import { useAuth } from '../../shared/auth.jsx';
import {
  FALLBACK_CAT_DEFAULTS,
  FALLBACK_PRODUCT,
  Field,
  SHORT_EXPIRY_APPROVAL_MONTHS,
  emptyTxnForm,
  nowLocal,
  requiresShortExpiryApproval,
  resolveProductType,
} from './logisticsTxnShared.jsx';

const SOURCES = [
  {
    id: 'seller',
    label: 'Seller / Purchase',
    entryType: 'Inward',
    remarkPrefix: '',
    blurb: 'Goods receipt from a supplier or vendor into warehouse',
  },
  {
    id: 'return',
    label: 'Field return / Callback',
    entryType: 'Return',
    remarkPrefix: 'Field return / Callback',
    blurb: 'Stock returned from a Contact Directory person (HCW / field), including callbacks',
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
  const uoms = meta?.uoms || [];
  const parties = useMemo(() => {
    const list = [...(meta?.suppliers || []), ...(meta?.vendors || [])];
    const seen = new Set();
    return list
      .filter((p) => {
        if (!p?._id || seen.has(p._id)) return false;
        seen.add(p._id);
        return p.isActive !== false;
      })
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  }, [meta?.suppliers, meta?.vendors]);
  const defaultWarehouseName = cfg.defaultWarehouseName || 'Mumbai';

  const partyLabel = (p) => {
    if (!p) return '';
    const type = p.partyType === 'Vendor' ? 'Vendor' : 'Supplier';
    return `${p.name || p.code || '—'}${p.code ? ` (${p.code})` : ''} · ${type}`;
  };

  const uomLabel = useCallback(
    (uomId) => {
      if (!uomId) return '';
      const u = uoms.find((x) => x._id === uomId);
      return u?.name || u?.code || '';
    },
    [uoms]
  );

  const defaultWarehouseId = useMemo(() => {
    const hit =
      warehouses.find((w) => w.name === defaultWarehouseName) ||
      warehouses.find((w) => String(w.code || '').toUpperCase() === 'WH-MUM') ||
      warehouses.find((w) => /mumbai/i.test(w.name || '') || /mumbai/i.test(w.city || '')) ||
      warehouses[0];
    return hit?._id || '';
  }, [warehouses, defaultWarehouseName]);

  const productsForType = useMemo(
    () =>
      products.filter(
        (p) => !form.productType || resolveProductType(p.productType) === form.productType
      ),
    [products, form.productType]
  );

  const load = useCallback(async () => {
    setError('');
    try {
      const params = new URLSearchParams({ limit: '200', entryTypes: 'Inward,Return' });
      if (q.trim()) params.set('q', q.trim());
      const res = await api(`/logistics/in-out?${params}`);
      setRows(res.data || []);
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
      uomId: '',
      expiryApplicable: !!defaults.expiryApplicable,
      trackingKind: defaults.trackingKind || 'None',
      expiryDate: defaults.expiryApplicable ? f.expiryDate : '',
      batchOrSerial: defaults.trackingKind === 'None' ? 'N/A' : '',
    }));
  };

  const productLabel = (p) => p?.model || p?.partNumber || p?.name || '';

  const pickProduct = (productId) => {
    const p = products.find((x) => x._id === productId);
    if (!p) {
      setForm((f) => ({
        ...f,
        productId: '',
        productName: '',
        programProject: '',
        uomId: '',
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
    const unitCost =
      p.defaultPerUnitCost != null
        ? p.defaultPerUnitCost
        : p.standardCost != null
          ? p.standardCost
          : p.purchaseCost != null
            ? p.purchaseCost
            : null;
    setForm((f) => {
      const qty = Number(f.qty) || 0;
      const perUnitCost = unitCost != null ? Number(unitCost) : Number(f.perUnitCost) || 0;
      const invoiceAmount =
        qty > 0 && perUnitCost > 0 ? String(Number((qty * perUnitCost).toFixed(2))) : f.invoiceAmount;
      return {
        ...f,
        productId: p._id,
        productName: productLabel(p),
        programProject: p.programProject || '',
        productType: p.productType || f.productType,
        uomId: p.uomId || '',
        expiryApplicable,
        trackingKind,
        batchOrSerial: trackingKind === 'None' ? 'N/A' : f.batchOrSerial === 'N/A' ? '' : f.batchOrSerial,
        expiryDate: expiryApplicable ? f.expiryDate : '',
        perUnitCost: unitCost != null ? String(unitCost) : f.perUnitCost,
        invoiceAmount,
      };
    });
  };

  const setQtyOrCost = (key, value) => {
    setForm((f) => {
      const next = { ...f, [key]: value };
      const qty = Number(key === 'qty' ? value : next.qty) || 0;
      const perUnitCost = Number(key === 'perUnitCost' ? value : next.perUnitCost) || 0;
      if (qty > 0 && perUnitCost > 0) {
        next.invoiceAmount = String(Number((qty * perUnitCost).toFixed(2)));
      }
      return next;
    });
  };

  const pickContact = (contactId) => {
    const c = contacts.find((x) => x._id === contactId);
    if (!c) {
      setForm((f) => ({
        ...f,
        contactId: '',
        recipientName: '',
        empId: '',
        number: '',
        city: '',
      }));
      return;
    }
    setForm((f) => ({
      ...f,
      contactId: c._id,
      supplierId: '',
      vendor: '',
      recipientName: c.name || '',
      empId: c.employeeId || c.email || '',
      number: c.contact || c.mobile || '',
      city: c.city || '',
      state: c.state || f.state,
    }));
  };

  const pickParty = (partyId) => {
    const p = parties.find((x) => x._id === partyId);
    if (!p) {
      setForm((f) => ({
        ...f,
        supplierId: '',
        vendor: '',
        recipientName: '',
        number: '',
        city: '',
      }));
      return;
    }
    setForm((f) => ({
      ...f,
      supplierId: p._id,
      vendor: p.name || '',
      contactId: '',
      recipientName: p.name || '',
      empId: '',
      number: p.phone || '',
      city: p.city || '',
      state: p.state || f.state,
    }));
  };

  const tracked = form.trackingKind && form.trackingKind !== 'None';
  const asOfDate = new Date().toISOString().slice(0, 10);
  const needsShortExpiryApproval =
    form.expiryApplicable &&
    form.expiryDate &&
    requiresShortExpiryApproval(form.expiryDate, asOfDate);

  const save = async (e) => {
    e.preventDefault();
    if (!canWrite) return;
    if (source.id === 'seller' && !form.supplierId) {
      setError('Select a supplier or vendor as Source.');
      return;
    }
    if (source.id === 'return' && !form.contactId) {
      setError('Select a contact from Contact Directory as Source.');
      return;
    }
    if (needsShortExpiryApproval && !String(form.approvedBy || '').trim()) {
      setError(
        `Expiry is under ${SHORT_EXPIRY_APPROVAL_MONTHS} months. Enter Approved By before saving inward.`
      );
      return;
    }
    setBusy(true);
    setError('');
    setMsg('');
    try {
      const remark =
        source.remarkPrefix && !String(form.remark || '').startsWith(source.remarkPrefix)
          ? `${source.remarkPrefix}${form.remark ? `: ${form.remark}` : ''}`
          : form.remark;

      const capturedAt = nowLocal();
      const fd = new FormData();
      const payload = {
        ...form,
        entryType: source.entryType,
        warehouseId: defaultWarehouseId || form.warehouseId || '',
        sourceWarehouseId: defaultWarehouseId || form.warehouseId || '',
        contactId: source.id === 'return' ? form.contactId || '' : '',
        supplierId: source.id === 'seller' ? form.supplierId || '' : '',
        vendor: source.id === 'seller' ? form.vendor || form.recipientName || '' : '',
        productId: form.productId || '',
        employeeName: form.recipientName,
        name: form.recipientName,
        qty: String(Number(form.qty) || 0),
        uomId: form.uomId || '',
        perUnitCost: String(Number(form.perUnitCost) || 0),
        invoiceAmount: String(Number(form.invoiceAmount) || 0),
        batchOrSerial: tracked ? form.batchOrSerial : 'N/A',
        transactionDateTime: capturedAt,
        transactionDate: String(capturedAt).slice(0, 10),
        remark,
        expiryApplicable: form.expiryApplicable ? 'true' : 'false',
        approvedBy: needsShortExpiryApproval ? String(form.approvedBy || '').trim() : '',
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
      setMsg('Goods receipt saved. Warehouse stock updated.');
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
        Goods receipt: seller deliveries, field returns and callbacks, and other warehouse receipts.
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
            {formOpen ? 'Close form' : '+ Record goods receipt'}
          </button>
        )}
      </div>

      {canWrite && formOpen && (
        <form className="card logistics-form logistics-txn-form" onSubmit={save}>
          <h3>Record goods receipt</h3>
          <div className="logistics-form-grid logistics-form-grid--inout">
            {source.id === 'seller' && (
              <Field label="Source" required hint="Suppliers & Vendors from Master">
                <AdaptiveSelect
                  required
                  value={form.supplierId}
                  onChange={(e) => pickParty(e.target.value)}
                >
                  <option value="">Select supplier or vendor…</option>
                  {parties.map((p) => (
                    <option key={p._id} value={p._id}>
                      {partyLabel(p)}
                    </option>
                  ))}
                </AdaptiveSelect>
              </Field>
            )}
            {source.id === 'return' && (
              <Field label="Source" required hint="From Contact Directory">
                <AdaptiveSelect
                  required
                  value={form.contactId}
                  onChange={(e) => pickContact(e.target.value)}
                >
                  <option value="">Select contact…</option>
                  {contacts.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                      {c.city ? `: ${c.city}` : ''}
                    </option>
                  ))}
                </AdaptiveSelect>
              </Field>
            )}
            <Field label="Product category" required>
              <AdaptiveSelect
                required
                value={form.productType}
                onChange={(e) => onProductCategoryChange(e.target.value)}
              >
                {productTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </AdaptiveSelect>
            </Field>
            <Field label="Model/Variant/Name" required>
              <AdaptiveSelect
                required
                value={form.productId}
                onChange={(e) => pickProduct(e.target.value)}
              >
                <option value="">Select model / variant / name…</option>
                {productsForType.map((p) => (
                  <option key={p._id} value={p._id}>
                    {productLabel(p)}
                    {p.code ? ` (${p.code})` : ''}
                  </option>
                ))}
              </AdaptiveSelect>
            </Field>
            <Field label="UOM">
              <input
                readOnly
                value={uomLabel(form.uomId) || '—'}
                title="From Product Master"
              />
            </Field>
            <Field label="Total quantity received" required>
              <input
                type="number"
                min="0.0001"
                step="any"
                required
                value={form.qty}
                onChange={(e) => setQtyOrCost('qty', e.target.value)}
              />
            </Field>
            <Field label="Per unit cost">
              <input
                type="number"
                min="0"
                step="any"
                value={form.perUnitCost}
                onChange={(e) => setQtyOrCost('perUnitCost', e.target.value)}
              />
            </Field>
            <Field label="Total bill amount" required>
              <input
                type="number"
                min="0"
                step="any"
                required
                value={form.invoiceAmount}
                onChange={(e) => setField('invoiceAmount', e.target.value)}
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
            {needsShortExpiryApproval && (
              <Field
                label="Approved By"
                required
                hint={`Required: remaining life is under ${SHORT_EXPIRY_APPROVAL_MONTHS} months`}
              >
                <input
                  required
                  value={form.approvedBy || ''}
                  onChange={(e) => setField('approvedBy', e.target.value)}
                  placeholder="Approver name"
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
            <Field label="Remark">
              <input value={form.remark} onChange={(e) => setField('remark', e.target.value)} />
            </Field>
          </div>

          <h4 className="logistics-form-section">Attachments</h4>
          <div className="logistics-form-grid logistics-form-grid--inout">
            <Field label="Product photo" hint="JPG / PNG of the product received">
              <FilePicker
                accept="image/*"
                onChange={(e) => setProductPhoto(e.target.files?.[0] || null)}
              />
            </Field>
            <Field label="Invoice / document" hint="Invoice, challan, GRN, or other PDF / image">
              <FilePicker
                accept="image/*,.pdf,.doc,.docx"
                onChange={(e) => setInvoiceDoc(e.target.files?.[0] || null)}
              />
            </Field>
            <Field label="Additional documents" hint="Optional. Up to 5 files.">
              <FilePicker
                accept="image/*,.pdf,.doc,.docx"
                multiple
                onChange={(e) =>
                  setDocsExtra([...((e.target.files && Array.from(e.target.files)) || [])].slice(0, 5))
                }
              />
            </Field>
          </div>

          <div className="logistics-form-actions">
            <button className="btn" type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Save goods receipt'}
            </button>
            <button className="btn secondary" type="button" onClick={() => setFormOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="card card--flush table-wrap">
        <table className="inv-table">
          <thead>
            <tr>
              <th>TXN</th>
              <th>Type</th>
              <th>Date</th>
              <th>Model/Variant/Name</th>
              <th>UOM</th>
              <th className="num">Qty received</th>
              <th className="num">Bill amount</th>
              <th>Source</th>
              <th>Attachments</th>
              <th>Remark</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r._id}>
                <td className="mono-sm">{r.uniqueKey || '-'}</td>
                <td>{r.entryType}</td>
                <td className="mono-sm">{String(r.transactionDate || r.transactionDateTime || '').slice(0, 10)}</td>
                <td>
                  <strong>{r.productName || r.itemName || '-'}</strong>
                </td>
                <td>{uomLabel(r.uomId) || '-'}</td>
                <td className="num">{r.qty}</td>
                <td className="num">
                  {r.invoiceAmount != null && Number(r.invoiceAmount) > 0
                    ? Number(r.invoiceAmount).toLocaleString('en-IN', {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 2,
                      })
                    : '-'}
                </td>
                <td>{r.vendor || r.recipientName || r.employeeName || r.name || '-'}</td>
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
                    <span className="muted">-</span>
                  )}
                </td>
                <td className="muted">{r.remark || '-'}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={10} className="muted">
                  No goods receipt transactions yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
