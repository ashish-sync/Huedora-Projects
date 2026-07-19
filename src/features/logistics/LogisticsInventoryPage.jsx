import { useCallback, useEffect, useMemo, useState } from 'react';
import AdaptiveSelect from '../../components/ui/AdaptiveSelect.jsx';
import PaginationBar from '../../components/ui/PaginationBar.jsx';
import { api } from '../../shared/api.js';
import { useAuth } from '../../shared/auth.jsx';

const emptyForm = {
  name: '',
  sku: '',
  serialNumber: '',
  imei: '',
  batchNumber: '',
  categoryId: '',
  uomId: '',
  warehouseId: '',
  locationId: '',
  status: 'Available',
  quantity: '1',
  unitValue: '',
  lowStockThreshold: '',
  remarks: '',
};

function formatMoney(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return '-';
  return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function resolveDefaultWarehouseId(warehouses, preferredName = 'Mumbai') {
  const list = warehouses || [];
  const hit =
    list.find((w) => w.name === preferredName) ||
    list.find((w) => String(w.code || '').toUpperCase() === 'WH-MUM') ||
    list.find((w) => /mumbai/i.test(w.name || '') || /mumbai/i.test(w.city || '')) ||
    list[0];
  return hit?._id || '';
}

export default function LogisticsInventoryPage({ productType = '' } = {}) {
  const { can } = useAuth();
  const canWrite = can('logistics:write') || can('*');
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [meta, setMeta] = useState(null);
  const [locations, setLocations] = useState([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [listMeta, setListMeta] = useState({ page: 1, limit: 25, total: 0, pages: 0 });
  const [listLoading, setListLoading] = useState(false);
  const scopedType = String(productType || '').trim();

  const defaultWarehouseName = meta?.inOut?.defaultWarehouseName || 'Mumbai';
  const defaultWarehouseId = useMemo(
    () => resolveDefaultWarehouseId(meta?.warehouses, defaultWarehouseName),
    [meta, defaultWarehouseName]
  );

  const loadMeta = useCallback(async () => {
    try {
      const { data } = await api('/logistics/meta');
      setMeta(data);
    } catch {
      /* ignore */
    }
  }, []);

  const load = useCallback(async () => {
    setError('');
    setListLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (q.trim()) params.set('q', q.trim());
      if (status) params.set('status', status);
      if (warehouseId) params.set('warehouseId', warehouseId);
      if (scopedType) params.set('productType', scopedType);
      const res = await api(`/logistics/inventory?${params}`);
      setRows(res.data || []);
      setSummary(res.summary || null);
      setListMeta(res.meta || { page, limit, total: 0, pages: 0 });
    } catch (e) {
      setError(e.message);
    } finally {
      setListLoading(false);
    }
  }, [q, status, warehouseId, scopedType, page, limit]);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    if (!warehouseId && defaultWarehouseId) {
      setWarehouseId(defaultWarehouseId);
    }
  }, [warehouseId, defaultWarehouseId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!form.warehouseId) {
      setLocations([]);
      return;
    }
    api(`/logistics/locations?warehouseId=${form.warehouseId}&limit=200`)
      .then((r) => setLocations(r.data || []))
      .catch(() => setLocations([]));
  }, [form.warehouseId]);

  const openCreate = () => {
    setForm({
      ...emptyForm,
      warehouseId: defaultWarehouseId || '',
    });
    setFormOpen(true);
    setMsg('');
    setError('');
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMsg('');
    try {
      await api('/logistics/inventory', {
        method: 'POST',
        body: {
          ...form,
          productType: scopedType || form.productType || undefined,
          categoryId: form.categoryId || null,
          uomId: form.uomId || null,
          warehouseId: form.warehouseId || defaultWarehouseId || null,
          locationId: form.locationId || null,
          quantity: Number(form.quantity) || 1,
          unitValue: form.unitValue === '' ? 0 : Number(form.unitValue),
          lowStockThreshold: form.lowStockThreshold === '' ? 0 : Number(form.lowStockThreshold),
        },
      });
      setMsg('Stock item added.');
      setForm({ ...emptyForm, warehouseId: defaultWarehouseId || '' });
      setFormOpen(false);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const nameOf = (list, id) => {
    const hit = (list || []).find((x) => x._id === id);
    return hit?.name || hit?.code || '-';
  };

  const kpis = [
    { label: 'Inventory value', value: formatMoney(summary?.totalValue) },
    { label: 'Available', value: summary?.availableQty ?? '-' },
    { label: 'Reserved', value: summary?.reservedQty ?? '-' },
    { label: 'Low stock', value: summary?.lowStock ?? '-' },
    { label: 'Damaged', value: summary?.damagedQty ?? '-' },
    { label: 'Repair', value: summary?.repairQty ?? '-' },
    { label: 'Pending goods issue', value: summary?.pendingDispatch ?? '-' },
  ];

  return (
    <div className="logistics-inventory">
      <p className="muted" style={{ marginTop: 0 }}>
        {scopedType
          ? `Current ${scopedType} stock on hand by warehouse and status.`
          : 'Current stock on hand by warehouse and status.'}
      </p>

      {(error || msg) && (
        <div className={`am-banner ${error ? 'is-error' : 'is-info'}`} role="status">
          {error || msg}
        </div>
      )}

      <div className="module-dash-kpis" data-count={kpis.length} role="group" aria-label="Inventory summary">
        {kpis.map((k) => (
          <div key={k.label} className="module-kpi">
            <strong>{k.value}</strong>
            <span title={k.label}>{k.label}</span>
          </div>
        ))}
      </div>

      <div className="inv-toolbar logistics-toolbar">
        <input
          className="esign-search inv-search"
          placeholder="Search name, SKU, serial, IMEI…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load()}
        />
        <AdaptiveSelect value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
          <option value="">All warehouses</option>
          {(meta?.warehouses || []).map((w) => (
            <option key={w._id} value={w._id}>
              {w.name}
            </option>
          ))}
        </AdaptiveSelect>
        <AdaptiveSelect value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {(meta?.statuses || []).map((s) => (
            <option key={s._id || s.code} value={s.name}>
              {s.name}
            </option>
          ))}
        </AdaptiveSelect>
        <button className="btn secondary" type="button" onClick={load}>
          Search
        </button>
        {canWrite && (
          <button className="btn" type="button" onClick={() => (formOpen ? setFormOpen(false) : openCreate())}>
            {formOpen ? 'Close form' : '+ Add stock item'}
          </button>
        )}
      </div>

      {canWrite && formOpen && (
        <form className="card logistics-form" onSubmit={save}>
          <h3>Add stock line</h3>
          <p className="muted" style={{ marginTop: 0 }}>
            Seed serialised stock for balance. Goods receipts update quantities automatically.
          </p>
          <div className="logistics-form-grid">
            <div className="field">
              <label>Name *</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="field">
              <label>SKU</label>
              <input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
            </div>
            <div className="field">
              <label>Serial</label>
              <input
                value={form.serialNumber}
                onChange={(e) => setForm({ ...form, serialNumber: e.target.value })}
              />
            </div>
            <div className="field">
              <label>IMEI</label>
              <input value={form.imei} onChange={(e) => setForm({ ...form, imei: e.target.value })} />
            </div>
            <div className="field">
              <label>Batch</label>
              <input
                value={form.batchNumber}
                onChange={(e) => setForm({ ...form, batchNumber: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Category</label>
              <AdaptiveSelect
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              >
                <option value="">-</option>
                {(meta?.categories || []).map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </AdaptiveSelect>
            </div>
            <div className="field">
              <label>UOM</label>
              <AdaptiveSelect value={form.uomId} onChange={(e) => setForm({ ...form, uomId: e.target.value })}>
                <option value="">-</option>
                {(meta?.uoms || []).map((u) => (
                  <option key={u._id} value={u._id}>
                    {u.name}
                  </option>
                ))}
              </AdaptiveSelect>
            </div>
            <div className="field">
              <label>Warehouse</label>
              <AdaptiveSelect
                value={form.warehouseId}
                onChange={(e) => setForm({ ...form, warehouseId: e.target.value, locationId: '' })}
              >
                <option value="">-</option>
                {(meta?.warehouses || []).map((w) => (
                  <option key={w._id} value={w._id}>
                    {w.name}
                  </option>
                ))}
              </AdaptiveSelect>
            </div>
            <div className="field">
              <label>Location</label>
              <AdaptiveSelect
                value={form.locationId}
                onChange={(e) => setForm({ ...form, locationId: e.target.value })}
              >
                <option value="">-</option>
                {locations.map((l) => (
                  <option key={l._id} value={l._id}>
                    {l.level}: {l.name}
                  </option>
                ))}
              </AdaptiveSelect>
            </div>
            <div className="field">
              <label>Status</label>
              <AdaptiveSelect value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {(meta?.statuses || [{ name: 'Available' }]).map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </AdaptiveSelect>
            </div>
            <div className="field">
              <label>Qty</label>
              <input
                type="number"
                min={0}
                step="1"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Unit value</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.unitValue}
                onChange={(e) => setForm({ ...form, unitValue: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Low-stock threshold</label>
              <input
                type="number"
                min={0}
                value={form.lowStockThreshold}
                onChange={(e) => setForm({ ...form, lowStockThreshold: e.target.value })}
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
              {busy ? 'Saving…' : 'Add stock item'}
            </button>
          </div>
        </form>
      )}

      <div className="card card--flush table-wrap">
        <table className="inv-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>SKU</th>
              <th>Serial</th>
              <th>Warehouse</th>
              <th>Status</th>
              <th className="num">Qty</th>
              <th className="num">Value</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r._id}>
                <td>
                  <strong>{r.name}</strong>
                </td>
                <td className="mono-sm">{r.sku || '-'}</td>
                <td className="mono-sm">{r.serialNumber || '-'}</td>
                <td>{nameOf(meta?.warehouses, r.warehouseId)}</td>
                <td>
                  <span className="badge tone-neutral">{r.status || '-'}</span>
                </td>
                <td className="num mono-sm">{r.quantity}</td>
                <td className="num mono-sm">
                  {formatMoney((Number(r.unitValue) || 0) * (Number(r.quantity) || 0))}
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={7}>
                  <div className="inv-empty">
                    <strong>No stock balance yet</strong>
                    <p className="muted">
                      Maintain products, UOM, and warehouses in Master One, then add stock here, or receive via Goods Receipt.
                    </p>
                  </div>
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
