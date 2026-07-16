import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../shared/api.js';
import { useAuth } from '../../shared/auth.jsx';
import {
  FALLBACK_CAT_DEFAULTS,
  FALLBACK_COURIER,
  FALLBACK_DELIVERY,
  FALLBACK_PRODUCT,
  Field,
  emptyTxnForm,
  isOutwardRow,
} from './logisticsTxnShared.jsx';

export default function LogisticsOutwardPage() {
  const { can, user } = useAuth();
  const canWrite = can('logistics:write') || can('*');
  const [mode, setMode] = useState('manual'); // manual | requests
  const [rows, setRows] = useState([]);
  const [requests, setRequests] = useState([]);
  const [meta, setMeta] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(() => emptyTxnForm(user, { entryType: 'Outward' }));
  const [busy, setBusy] = useState(false);
  const [fulfillingId, setFulfillingId] = useState('');

  const cfg = meta?.inOut || {};
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

  const needsAwb = courierModes.includes(form.deliveryMode);
  const tracked = form.trackingKind && form.trackingKind !== 'None';

  const loadRows = useCallback(async () => {
    setError('');
    try {
      const params = new URLSearchParams({ limit: '300' });
      if (q.trim()) params.set('q', q.trim());
      const res = await api(`/logistics/in-out?${params}`);
      setRows((res.data || []).filter((r) => isOutwardRow(r.entryType)));
    } catch (e) {
      setError(e.message);
    }
  }, [q]);

  const loadRequests = useCallback(async () => {
    try {
      const res = await api('/asset-requests?requestType=LOGISTICS&limit=100');
      const list = (res.data || []).filter((r) =>
        ['REQUESTED', 'APPROVED'].includes(String(r.status || ''))
      );
      setRequests(list);
    } catch {
      setRequests([]);
    }
  }, []);

  useEffect(() => {
    api('/logistics/meta')
      .then((r) => setMeta(r.data))
      .catch(() => {});
    api('/contacts?limit=500')
      .then((r) => setContacts(r.data || []))
      .catch(() => setContacts([]));
  }, []);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  useEffect(() => {
    if (mode === 'requests') loadRequests();
  }, [mode, loadRequests]);

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const openManual = () => {
    const base = emptyTxnForm(user, {
      entryType: 'Outward',
      warehouseId: defaultWarehouseId,
    });
    const defaults = categoryDefaults[base.productType] || FALLBACK_CAT_DEFAULTS[base.productType];
    base.expiryApplicable = !!defaults?.expiryApplicable;
    base.trackingKind = defaults?.trackingKind || 'Batch';
    base.batchOrSerial = base.trackingKind === 'None' ? 'N/A' : '';
    setFulfillingId('');
    setForm(base);
    setFormOpen(true);
    setMode('manual');
    setMsg('');
    setError('');
  };

  const openFromRequest = (req) => {
    const base = emptyTxnForm(user, {
      entryType: 'Outward',
      warehouseId: defaultWarehouseId,
    });
    const defaults = categoryDefaults[base.productType] || FALLBACK_CAT_DEFAULTS[base.productType];
    base.expiryApplicable = !!defaults?.expiryApplicable;
    base.trackingKind = defaults?.trackingKind || 'Batch';
    base.batchOrSerial = base.trackingKind === 'None' ? 'N/A' : '';
    base.contactId = req.toContactId || req.contactId || '';
    base.recipientName = req.custodianName || '';
    base.city = req.toCity || req.custodianCity || '';
    base.state = req.custodianState || '';
    base.number = req.custodianContact || '';
    base.productName = req.assetName || '';
    base.qty = '1';
    base.remark = `Fulfill ${req.requestNumber || req._id}${req.logisticsKind ? ` · ${req.logisticsKind}` : ''}`;
    base.assetRequestId = req._id;
    // Try match product by name
    const match = products.find(
      (p) => String(p.name || '').toLowerCase() === String(req.assetName || '').toLowerCase()
    );
    if (match) {
      base.productId = match._id;
      base.productName = match.name;
      base.productType = match.productType || base.productType;
    }
    setFulfillingId(req._id);
    setForm(base);
    setFormOpen(true);
    setMode('manual');
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

  const pickRecipient = (contactId) => {
    const c = contacts.find((x) => x._id === contactId);
    if (!c) {
      setForm((f) => ({
        ...f,
        contactId: '',
        recipientName: '',
        empId: '',
        number: '',
      }));
      return;
    }
    setForm((f) => ({
      ...f,
      contactId: c._id,
      recipientName: c.name || '',
      empId: c.employeeId || c.email || '',
      number: c.contact || c.mobile || '',
      city: c.city || f.city,
      state: c.state || f.state,
    }));
  };

  const save = async (e) => {
    e.preventDefault();
    if (!canWrite) return;
    setBusy(true);
    setError('');
    setMsg('');
    try {
      await api('/logistics/in-out', {
        method: 'POST',
        body: {
          ...form,
          entryType: 'Outward',
          warehouseId: form.warehouseId || null,
          sourceWarehouseId: form.warehouseId || null,
          contactId: form.contactId || null,
          productId: form.productId || null,
          employeeName: form.recipientName,
          name: form.recipientName,
          qty: Number(form.qty) || 0,
          perUnitCost: Number(form.perUnitCost) || 0,
          batchOrSerial: tracked ? form.batchOrSerial : 'N/A',
          transactionDate: String(form.transactionDateTime || '').slice(0, 10),
          awbNumber: needsAwb ? form.awbNumber : '',
        },
      });

      if (fulfillingId) {
        try {
          const req = requests.find((r) => String(r._id) === String(fulfillingId));
          if (req?.status === 'REQUESTED') {
            await api(`/asset-requests/${fulfillingId}/approve`, { method: 'POST', body: {} });
          }
          await api(`/asset-requests/${fulfillingId}/complete`, { method: 'POST', body: {} });
        } catch {
          // Dispatch still succeeded; request may need separate approval
        }
      }

      setMsg(
        fulfillingId
          ? 'Dispatch saved and linked logistics request updated.'
          : 'Outward dispatch saved — stock updated.'
      );
      setFormOpen(false);
      setFulfillingId('');
      loadRows();
      loadRequests();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="logistics-inout ilog-flow">
      <p className="muted" style={{ marginTop: 0 }}>
        Outward — stock leaving the warehouse. Dispatch manually or fulfill an approved logistics
        request from The Request Center.
      </p>

      {(error || msg) && (
        <div className={`am-banner ${error ? 'is-error' : 'is-info'}`} role="status">
          {error || msg}
        </div>
      )}

      <div className="ilog-source-tabs" role="tablist" aria-label="Outward mode">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'manual'}
          className={`ilog-source-tab${mode === 'manual' ? ' is-active' : ''}`}
          onClick={() => setMode('manual')}
        >
          Manual dispatch
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'requests'}
          className={`ilog-source-tab${mode === 'requests' ? ' is-active' : ''}`}
          onClick={() => {
            setMode('requests');
            setFormOpen(false);
          }}
        >
          From Request Center
        </button>
      </div>

      {mode === 'manual' && (
        <>
          <div className="inv-toolbar logistics-toolbar">
            <input
              className="esign-search inv-search"
              placeholder="Search TXN, product, recipient…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadRows()}
            />
            <button className="btn secondary" type="button" onClick={loadRows}>
              Search
            </button>
            {canWrite && (
              <button
                className="btn"
                type="button"
                onClick={() => {
                  if (formOpen && !fulfillingId) {
                    setFormOpen(false);
                    return;
                  }
                  openManual();
                }}
              >
                {formOpen && !fulfillingId ? 'Close form' : '+ Manual dispatch'}
              </button>
            )}
            <Link className="btn secondary" to="/asset-requests?type=LOGISTICS">
              Create logistics request
            </Link>
          </div>

          {canWrite && formOpen && (
            <form className="card logistics-form logistics-txn-form" onSubmit={save}>
              <h3>{fulfillingId ? 'Dispatch from request' : 'Manual dispatch'}</h3>
              <div className="logistics-form-grid logistics-form-grid--inout">
                <Field label="Source warehouse" required>
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
                    required={Boolean(productsForType.length)}
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
                {!form.productId && (
                  <Field label="Product name" required>
                    <input
                      required
                      value={form.productName}
                      onChange={(e) => setField('productName', e.target.value)}
                    />
                  </Field>
                )}
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
                <Field label="Recipient" required>
                  <select
                    required
                    value={form.contactId}
                    onChange={(e) => pickRecipient(e.target.value)}
                  >
                    <option value="">Select contact…</option>
                    {contacts.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                        {c.city ? ` — ${c.city}` : ''}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="City">
                  <input value={form.city} onChange={(e) => setField('city', e.target.value)} />
                </Field>
                <Field label="Delivery mode" required>
                  <select
                    required
                    value={form.deliveryMode}
                    onChange={(e) => setField('deliveryMode', e.target.value)}
                  >
                    {deliveryModes.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </Field>
                {needsAwb && (
                  <Field label="AWB number" required>
                    <input
                      required
                      value={form.awbNumber}
                      onChange={(e) => setField('awbNumber', e.target.value)}
                    />
                  </Field>
                )}
                {form.expiryApplicable && (
                  <Field label="Expiry date">
                    <input
                      type="date"
                      value={form.expiryDate}
                      onChange={(e) => setField('expiryDate', e.target.value)}
                    />
                  </Field>
                )}
                {tracked && (
                  <Field label="Batch / Serial">
                    <input
                      value={form.batchOrSerial}
                      onChange={(e) => setField('batchOrSerial', e.target.value)}
                    />
                  </Field>
                )}
                <Field label="Remark">
                  <input value={form.remark} onChange={(e) => setField('remark', e.target.value)} />
                </Field>
              </div>
              <div className="logistics-form-actions">
                <button className="btn" type="submit" disabled={busy}>
                  {busy ? 'Saving…' : 'Save dispatch'}
                </button>
                <button
                  className="btn secondary"
                  type="button"
                  onClick={() => {
                    setFormOpen(false);
                    setFulfillingId('');
                  }}
                >
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
                  <th>Date</th>
                  <th>Product</th>
                  <th className="num">Qty</th>
                  <th>Recipient</th>
                  <th>City</th>
                  <th>Mode</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r._id}>
                    <td className="mono-sm">{r.uniqueKey || '—'}</td>
                    <td className="mono-sm">
                      {String(r.transactionDate || r.transactionDateTime || '').slice(0, 10)}
                    </td>
                    <td>
                      <strong>{r.productName || r.itemName || '—'}</strong>
                    </td>
                    <td className="num">{r.qty}</td>
                    <td>{r.recipientName || r.employeeName || r.name || '—'}</td>
                    <td>{r.city || '—'}</td>
                    <td>{r.deliveryMode || r.mode || '—'}</td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td colSpan={7} className="muted">
                      No outward dispatches yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {mode === 'requests' && (
        <>
          <div className="inv-toolbar logistics-toolbar">
            <button className="btn secondary" type="button" onClick={loadRequests}>
              Refresh
            </button>
            <Link className="btn" to="/asset-requests?type=LOGISTICS">
              + New logistics request
            </Link>
          </div>
          <div className="card table-wrap" style={{ padding: 0 }}>
            <table className="inv-table">
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Status</th>
                  <th>Kind</th>
                  <th>Asset / Item</th>
                  <th>Destination</th>
                  <th>Requestor</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r._id}>
                    <td className="mono-sm">{r.requestNumber}</td>
                    <td>
                      <span className="badge tone-neutral">{r.status}</span>
                    </td>
                    <td>{r.logisticsKind || '—'}</td>
                    <td>
                      <strong>{r.assetName || '—'}</strong>
                    </td>
                    <td>
                      {r.toCity || r.custodianCity || '—'}
                      <div className="muted mono-sm">{r.custodianName || ''}</div>
                    </td>
                    <td>{r.requestorId?.fullName || r.requestorId?.email || '—'}</td>
                    <td>
                      {canWrite && (
                        <button
                          type="button"
                          className="btn btn-compact"
                          onClick={() => openFromRequest(r)}
                        >
                          Dispatch
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {!requests.length && (
                  <tr>
                    <td colSpan={7} className="muted">
                      No open logistics requests. Create one in The Request Center.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
