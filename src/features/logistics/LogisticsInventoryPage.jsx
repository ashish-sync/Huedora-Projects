import { useCallback, useEffect, useState } from 'react';
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
  if (!Number.isFinite(num)) return '—';
  return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export default function LogisticsInventoryPage() {
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
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (q.trim()) params.set('q', q.trim());
      if (status) params.set('status', status);
      if (warehouseId) params.set('warehouseId', warehouseId);
      const res = await api(`/logistics/inventory?${params}`);
      setRows(res.data || []);
      setSummary(res.summary || null);
    } catch (e) {
      setError(e.message);
    }
  }, [q, status, warehouseId]);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

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
          categoryId: form.categoryId || null,
          uomId: form.uomId || null,
          warehouseId: form.warehouseId || null,
          locationId: form.locationId || null,
          quantity: Number(form.quantity) || 1,
          unitValue: form.unitValue === '' ? 0 : Number(form.unitValue),
          lowStockThreshold: form.lowStockThreshold === '' ? 0 : Number(form.lowStockThreshold),
        },
      });
      setMsg('Stock item added.');
      setForm(emptyForm);
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
    return hit?.name || hit?.code || '—';
  };

  const kpis = [
    { label: 'Inventory value', value: formatMoney(summary?.totalValue) },
    { label: 'Available', value: summary?.availableQty ?? '—' },
    { label: 'Reserved', value: summary?.reservedQty ?? '—' },
    { label: 'Low stock', value: summary?.lowStock ?? '—' },
    { label: 'Damaged', value: summary?.damagedQty ?? '—' },
    { label: 'Repair', value: summary?.repairQty ?? '—' },
    { label: 'Pending dispatch', value: summary?.pendingDispatch ?? '—' },
  ];

  return (
    <div className="logistics-inventory">
      <p className="muted" style={{ marginTop: 0 }}>
        Balance Stats — current stock calculation across warehouses and statuses.
      </p>

      {(error || msg) && (
        <div className={`am-banner ${error ? 'is-error' : 'is-info'}`} role="status">
          {error || msg}
        </div>
      )}

      <div className="logistics-kpis" role="group" aria-label="Inventory summary">
        {kpis.map((k) => (
          <div key={k.label} className="logistics-kpi">
            <strong>{k.value}</strong>
            <span>{k.label}</span>
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
        <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
          <option value="">All warehouses</option>
          {(meta?.warehouses || []).map((w) => (
            <option key={w._id} value={w._id}>
              {w.name}
            </option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {(meta?.statuses || []).map((s) => (
            <option key={s._id || s.code} value={s.name}>
              {s.name}
            </option>
          ))}
        </select>
        <button className="btn secondary" type="button" onClick={load}>
          Search
        </button>
        {canWrite && (
          <button className="btn" type="button" onClick={() => setFormOpen((v) => !v)}>
            {formOpen ? 'Close form' : '+ Add stock item'}
          </button>
        )}
      </div>

      {canWrite && formOpen && (
        <form className="card logistics-form" onSubmit={save}>
          <h3>Add stock line</h3>
          <p className="muted" style={{ marginTop: 0 }}>
            Seed serialised stock for balance stats. Goods Receipt on In_Out will drive inbound
            updates when that workflow ships.
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
              <select
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              >
                <option value="">—</option>
                {(meta?.categories || []).map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>UoM</label>
              <select value={form.uomId} onChange={(e) => setForm({ ...form, uomId: e.target.value })}>
                <option value="">—</option>
                {(meta?.uoms || []).map((u) => (
                  <option key={u._id} value={u._id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Warehouse</label>
              <select
                value={form.warehouseId}
                onChange={(e) => setForm({ ...form, warehouseId: e.target.value, locationId: '' })}
              >
                <option value="">—</option>
                {(meta?.warehouses || []).map((w) => (
                  <option key={w._id} value={w._id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Location</label>
              <select
                value={form.locationId}
                onChange={(e) => setForm({ ...form, locationId: e.target.value })}
              >
                <option value="">—</option>
                {locations.map((l) => (
                  <option key={l._id} value={l._id}>
                    {l.level}: {l.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {(meta?.statuses || [{ name: 'Available' }]).map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
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

      <div className="card table-wrap" style={{ padding: 0 }}>
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
                <td className="mono-sm">{r.sku || '—'}</td>
                <td className="mono-sm">{r.serialNumber || '—'}</td>
                <td>{nameOf(meta?.warehouses, r.warehouseId)}</td>
                <td>
                  <span className="badge tone-neutral">{r.status || '—'}</span>
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
                      Set up Inventory &amp; Vendor Master, then add stock here — or receive via
                      In_Out → Goods Receipt when that workflow is live.
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
