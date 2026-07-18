import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import AdaptiveSelect from '../../components/ui/AdaptiveSelect.jsx';
import { api } from '../../shared/api.js';
import { useAuth } from '../../shared/auth.jsx';
import {
  FALLBACK_CAT_DEFAULTS,
  FALLBACK_COURIER,
  FALLBACK_DELIVERY,
  FALLBACK_PRODUCT,
  Field,
  emptyTxnForm,
} from './logisticsTxnShared.jsx';

const REQUEST_DELIVERY_MODES = ['Hand Delivery', 'Regular Courier', 'Apex', 'Porter', 'Other'];
const DELIVERY_MODE_ALIASES = {
  'Hand-carry': 'Hand Delivery',
  Courier: 'Regular Courier',
  Road: 'Regular Courier',
};

function refId(value) {
  if (!value) return '';
  if (typeof value === 'object') return String(value._id || value.id || '');
  return String(value);
}

function requestLines(request) {
  if (Array.isArray(request?.logisticsProducts) && request.logisticsProducts.length) {
    return request.logisticsProducts;
  }
  return [
    {
      productType: request?.productType || '',
      productId: request?.productId || '',
      productName: request?.assetName || request?.productName || '',
      qty: request?.qty || 1,
    },
  ];
}

function lineId(line) {
  return String(line?.assetRequestLineId || line?.lineId || line?._id || line?.id || '');
}

function lineIsFulfilled(line) {
  const status = String(line?.fulfillmentStatus || line?.status || '').toUpperCase();
  return (
    status === 'FULFILLED' ||
    status === 'DISPATCHED' ||
    Boolean(line?.fulfilledAt || line?.outwardTransactionId || line?.dispatchId)
  );
}

function fulfilledLineIds(request) {
  const candidates = [
    request?.fulfilledLineIds,
    request?.fulfilledAssetRequestLineIds,
    request?.fulfilledProductLineIds,
    request?.fulfilledLogisticsProductLineIds,
    request?.logisticsFulfillment?.fulfilledLineIds,
  ];
  return new Set(candidates.find(Array.isArray)?.map(String) || []);
}

function requestLineIsFulfilled(request, line, index) {
  if (lineIsFulfilled(line)) return true;
  const fulfilledIds = fulfilledLineIds(request);
  const id = lineId(line);
  return Boolean((id && fulfilledIds.has(id)) || fulfilledIds.has(String(index)));
}

function fulfillmentProgress(request) {
  const lines = requestLines(request);
  const fulfilled = lines.filter((line, index) => requestLineIsFulfilled(request, line, index)).length;
  return { lines, fulfilled, total: lines.length, allFulfilled: lines.length > 0 && fulfilled === lines.length };
}

function mapDeliveryMode(mode) {
  return DELIVERY_MODE_ALIASES[mode] || mode || 'Hand Delivery';
}

export default function LogisticsOutwardPage() {
  const { can, user } = useAuth();
  const canWrite = can('logistics:write') || can('*');
  const canCompleteRequest =
    can('asset-requests:approve') || can('movements:approve') || can('*');
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
  const [fulfillingLineId, setFulfillingLineId] = useState('');
  const [fulfillingLineIndex, setFulfillingLineIndex] = useState(null);
  const [dispatchedLines, setDispatchedLines] = useState(() => new Set());

  const cfg = meta?.inOut || {};
  const productTypes = cfg.productTypes || FALLBACK_PRODUCT;
  const deliveryModes = [
    ...new Set([...(cfg.deliveryModes || FALLBACK_DELIVERY), ...REQUEST_DELIVERY_MODES]),
  ];
  const courierModes = [
    ...new Set([...(cfg.courierModes || FALLBACK_COURIER), 'Regular Courier', 'Apex', 'Other']),
  ];
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
    try {
      const params = new URLSearchParams({ limit: '200', entryType: 'Outward' });
      if (q.trim()) params.set('q', q.trim());
      const res = await api(`/logistics/in-out?${params}`);
      setRows(res.data || []);
    } catch (e) {
      setError(e.message);
    }
  }, [q]);

  const loadRequests = useCallback(async () => {
    try {
      const res = await api('/asset-requests?requestType=LOGISTICS&limit=100');
      const list = (res.data || []).filter((r) => String(r.status || '') === 'APPROVED');
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
    setFulfillingLineId('');
    setFulfillingLineIndex(null);
    setForm(base);
    setFormOpen(true);
    setMode('manual');
    setMsg('');
    setError('');
  };

  const openFromRequest = (req, line, lineIndex) => {
    const base = emptyTxnForm(user, {
      entryType: 'Outward',
      warehouseId: defaultWarehouseId,
    });
    const requestedType = line?.productType || base.productType;
    const defaults = categoryDefaults[requestedType] || FALLBACK_CAT_DEFAULTS[requestedType] || {};
    base.expiryApplicable = !!defaults?.expiryApplicable;
    base.trackingKind = defaults?.trackingKind || 'Batch';
    base.batchOrSerial = base.trackingKind === 'None' ? 'N/A' : '';
    base.contactId = refId(req.toContactId);
    base.recipientName = req.toName || req.toContactId?.name || '';
    base.city = req.toCity || req.toContactId?.city || '';
    base.state = req.toState || req.toContactId?.state || '';
    base.number = req.toNumber || req.toContactId?.contact || req.toContactId?.mobile || '';
    base.productType = requestedType;
    base.productId = refId(line?.productId);
    base.productName = line?.productName || line?.productId?.name || '';
    base.qty = String(line?.qty || 1);
    base.deliveryMode = mapDeliveryMode(req.transportMode);
    base.remark = `Fulfill ${req.requestNumber || req._id} line ${lineIndex + 1}${
      req.logisticsKind ? ` · ${req.logisticsKind}` : ''
    }`;
    base.assetRequestId = req._id;
    base.assetRequestLineId = lineId(line);
    base.assetRequestLineIndex = lineIndex;
    const match =
      products.find((product) => String(product._id) === refId(line?.productId)) ||
      products.find(
        (product) =>
          String(product.name || '').toLowerCase() ===
          String(line?.productName || '').toLowerCase()
      );
    if (match) {
      base.productId = match._id;
      base.productName = match.name;
      base.productType = match.productType || base.productType;
    }
    setFulfillingId(req._id);
    setFulfillingLineId(lineId(line));
    setFulfillingLineIndex(lineIndex);
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
    const dispatchKey =
      fulfillingId && fulfillingLineIndex != null
        ? `${fulfillingId}:${fulfillingLineId || fulfillingLineIndex}`
        : '';
    if (dispatchKey && dispatchedLines.has(dispatchKey)) {
      setBusy(false);
      setError('This request product line was already dispatched. Refresh the request list.');
      return;
    }
    try {
      const dispatchResult = await api('/logistics/in-out', {
        method: 'POST',
        body: {
          ...form,
          entryType: 'Outward',
          warehouseId: form.warehouseId || null,
          sourceWarehouseId: form.warehouseId || null,
          contactId: form.contactId || null,
          productId: form.productId || null,
          assetRequestId: fulfillingId || form.assetRequestId || null,
          assetRequestLineId: fulfillingId ? fulfillingLineId || null : null,
          assetRequestLineIndex: fulfillingId ? fulfillingLineIndex : null,
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
        if (dispatchKey) {
          setDispatchedLines((previous) => new Set(previous).add(dispatchKey));
        }
        const confirmedFulfillment = dispatchResult?.fulfillment;
        let progress = confirmedFulfillment
          ? {
              fulfilled: Number(confirmedFulfillment.fulfilledCount) || 0,
              total: Number(confirmedFulfillment.totalLines) || 0,
              allFulfilled: confirmedFulfillment.allProductLinesFulfilled === true,
            }
          : null;
        if (!progress) {
          try {
            const response = await api(`/asset-requests/${fulfillingId}`);
            progress = fulfillmentProgress(response.data);
          } catch (statusError) {
            setError(
              `Dispatch saved, but fulfillment status could not be confirmed: ${statusError.message}`
            );
          }
        }

        if (progress?.allFulfilled && canCompleteRequest) {
          try {
            await api(`/asset-requests/${fulfillingId}/complete`, { method: 'POST', body: {} });
            setMsg('Final product line dispatched and linked logistics request completed.');
          } catch (reqErr) {
            setError(
              `All product lines were dispatched, but request completion failed: ${reqErr.message}`
            );
          }
        } else if (progress?.allFulfilled) {
          setMsg(
            'All product lines are dispatched. An authorized approver must complete the request.'
          );
        } else if (progress) {
          setMsg(
            `Product line dispatched. ${progress.fulfilled} of ${progress.total} lines fulfilled.`
          );
        }
      } else {
        setMsg('Outward dispatch saved. Stock updated.');
      }

      setFormOpen(false);
      if (fulfillingId) setMode('requests');
      setFulfillingId('');
      setFulfillingLineId('');
      setFulfillingLineIndex(null);
      loadRows();
      loadRequests();
      return;
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="logistics-inout ilog-flow">
      <p className="muted" style={{ marginTop: 0 }}>
        Outward dispatch: leave warehouse stock manually, or fulfill an approved logistics request.
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
                  <AdaptiveSelect
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
                  </AdaptiveSelect>
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
                  <AdaptiveSelect
                    required
                    disabled={Boolean(fulfillingId)}
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
                <Field label="Product" required>
                  <AdaptiveSelect
                    required={Boolean(productsForType.length)}
                    disabled={Boolean(fulfillingId)}
                    value={form.productId}
                    onChange={(e) => pickProduct(e.target.value)}
                  >
                    <option value="">Select product…</option>
                    {productsForType.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.name}
                      </option>
                    ))}
                  </AdaptiveSelect>
                </Field>
                {!form.productId && (
                  <Field label="Product name" required>
                    <input
                      required
                      disabled={Boolean(fulfillingId)}
                      value={form.productName}
                      onChange={(e) => setField('productName', e.target.value)}
                    />
                  </Field>
                )}
                <Field label="Qty" required>
                  <input
                    type="number"
                    min="0.0001"
                    step="any"
                    required
                    disabled={Boolean(fulfillingId)}
                    value={form.qty}
                    onChange={(e) => setField('qty', e.target.value)}
                  />
                </Field>
                <Field label="Recipient" required>
                  <AdaptiveSelect
                    required
                    value={form.contactId}
                    onChange={(e) => pickRecipient(e.target.value)}
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
                <Field label="City">
                  <input value={form.city} onChange={(e) => setField('city', e.target.value)} />
                </Field>
                <Field label="Delivery mode" required>
                  <AdaptiveSelect
                    required
                    value={form.deliveryMode}
                    onChange={(e) => setField('deliveryMode', e.target.value)}
                  >
                    {deliveryModes.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </AdaptiveSelect>
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
                    setFulfillingLineId('');
                    setFulfillingLineIndex(null);
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
                    <td className="mono-sm">{r.uniqueKey || '-'}</td>
                    <td className="mono-sm">
                      {String(r.transactionDate || r.transactionDateTime || '').slice(0, 10)}
                    </td>
                    <td>
                      <strong>{r.productName || r.itemName || '-'}</strong>
                    </td>
                    <td className="num">{r.qty}</td>
                    <td>{r.recipientName || r.employeeName || r.name || '-'}</td>
                    <td>{r.city || '-'}</td>
                    <td>{r.deliveryMode || r.mode || '-'}</td>
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
                {requests.map((r) => {
                  const progress = fulfillmentProgress(r);
                  return (
                  <tr key={r._id}>
                    <td className="mono-sm">{r.requestNumber}</td>
                    <td>
                      <span className="badge tone-neutral">{r.status}</span>
                    </td>
                    <td>{r.logisticsKind || '-'}</td>
                    <td>
                      {progress.lines.map((line, index) => (
                        <div key={lineId(line) || index} className="logistics-request-line">
                          <strong>{line.productName || r.assetName || '-'}</strong>
                          <span className="muted mono-sm">
                            {line.productType || 'Product'} · Qty {line.qty || 0}
                          </span>
                        </div>
                      ))}
                      <div className="muted mono-sm">
                        {progress.fulfilled}/{progress.total} lines dispatched
                      </div>
                    </td>
                    <td>
                      {r.toCity || r.toContactId?.city || '-'}
                      <div className="muted mono-sm">
                        {r.toName || r.toContactId?.name || ''}
                      </div>
                    </td>
                    <td>{r.requestorId?.fullName || r.requestorId?.email || '-'}</td>
                    <td>
                      {canWrite &&
                        progress.lines.map((line, index) => {
                          const key = `${r._id}:${lineId(line) || index}`;
                          const fulfilled =
                            requestLineIsFulfilled(r, line, index) || dispatchedLines.has(key);
                          return (
                            <button
                              key={lineId(line) || index}
                              type="button"
                              className="btn btn-compact"
                              disabled={busy || fulfilled}
                              onClick={() => openFromRequest(r, line, index)}
                            >
                              {fulfilled ? `Line ${index + 1} dispatched` : `Dispatch line ${index + 1}`}
                            </button>
                          );
                        })}
                    </td>
                  </tr>
                  );
                })}
                {!requests.length && (
                  <tr>
                    <td colSpan={7} className="muted">
                      No open logistics requests. Create one in Request Center.
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
