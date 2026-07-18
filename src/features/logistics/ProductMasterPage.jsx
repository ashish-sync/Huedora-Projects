import { useCallback, useEffect, useMemo, useState } from 'react';
import AdaptiveSelect from '../../components/ui/AdaptiveSelect.jsx';
import FilePicker from '../../components/ui/FilePicker.jsx';
import { api, apiUrl } from '../../shared/api.js';
import { useAuth } from '../../shared/auth.jsx';

const PRODUCT_TYPES = [
  'Medical Device',
  'Non-Medical Device',
  'Peripheral Device',
  'Accessory',
  'Spare Part',
  'Consumable',
  'Document',
  'Other',
];

const INVENTORY_TYPES = [
  'Replacement Part for Asset',
  'Accessory of Asset',
  'Consumed by Device',
  'Multi-use',
];
const GST_PRESETS = [0, 5, 12, 18, 28];

const TYPE_DEFAULTS = {
  'Medical Device': {
    expiryApplicable: false,
    inventoryType: 'Multi-use',
  },
  'Non-Medical Device': {
    expiryApplicable: false,
    inventoryType: 'Multi-use',
  },
  'Peripheral Device': {
    expiryApplicable: false,
    inventoryType: 'Multi-use',
  },
  Accessory: {
    expiryApplicable: false,
    inventoryType: 'Accessory of Asset',
  },
  'Spare Part': {
    expiryApplicable: false,
    inventoryType: 'Replacement Part for Asset',
  },
  Consumable: {
    expiryApplicable: true,
    inventoryType: 'Consumed by Device',
  },
  Document: {
    expiryApplicable: false,
    inventoryType: 'Multi-use',
  },
  Other: {
    expiryApplicable: false,
    inventoryType: 'Consumed by Device',
  },
};

const LEGACY_TYPE = {
  Device: 'Medical Device',
  Consumables: 'Consumable',
  Misc: 'Other',
  Miscellaneous: 'Other',
};

const LEGACY_INVENTORY = {
  Asset: 'Replacement Part for Asset',
  'Inventory Item': 'Multi-use',
  'Associated to Asset': 'Replacement Part for Asset',
  'Used by Device': 'Consumed by Device',
};

function resolveType(raw) {
  const v = String(raw || '').trim();
  if (PRODUCT_TYPES.includes(v)) return v;
  return LEGACY_TYPE[v] || 'Other';
}

function resolveInventory(raw) {
  const v = String(raw || '').trim();
  if (INVENTORY_TYPES.includes(v)) return v;
  return LEGACY_INVENTORY[v] || 'Multi-use';
}

function needsLinkedDevice(inventoryType) {
  return (
    inventoryType === 'Replacement Part for Asset' ||
    inventoryType === 'Accessory of Asset' ||
    inventoryType === 'Consumed by Device'
  );
}

function emptyForm() {
  return {
    brand: '',
    model: '',
    uomId: '',
    unitsPerPack: '1',
    purchaseCost: '',
    gstRate: '18',
    gstCustom: false,
    inventoryType: 'Multi-use',
    linkedDeviceId: '',
    linkedDeviceLabel: '',
    expiryApplicable: false,
    stockLevelApplicable: false,
    minStock: '',
    maxStock: '',
    isActive: true,
    productType: 'Medical Device',
  };
}

export default function ProductMasterPage() {
  const { can } = useAuth();
  const canWrite = can('logistics:master') || can('logistics:write') || can('*');

  const [mode, setMode] = useState('list'); // list | create | edit
  const [rows, setRows] = useState([]);
  const [uoms, setUoms] = useState([]);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState('');
  const [editingMeta, setEditingMeta] = useState({ code: '', sku: '', image: null });
  const [deviceQuery, setDeviceQuery] = useState('');
  const [deviceOptions, setDeviceOptions] = useState([]);

  const uomName = useMemo(() => {
    const map = Object.fromEntries(uoms.map((u) => [u._id, u.name || u.code]));
    return (id) => map[id] || '-';
  }, [uoms]);

  const loadLookups = useCallback(async () => {
    try {
      const uom = await api('/logistics/uoms?limit=500');
      setUoms(uom.data || []);
    } catch {
      /* lookups optional for list */
    }
  }, []);

  const load = useCallback(async () => {
    setError('');
    try {
      const params = new URLSearchParams({ limit: '500' });
      if (q.trim()) params.set('q', q.trim());
      if (statusFilter === 'active') params.set('isActive', 'true');
      if (statusFilter === 'inactive') params.set('isActive', 'false');
      const res = await api(`/logistics/products?${params}`);
      setRows(res.data || []);
    } catch (e) {
      setError(e.message);
    }
  }, [q, statusFilter]);

  useEffect(() => {
    loadLookups();
  }, [loadLookups]);

  useEffect(() => {
    if (mode === 'list') load();
  }, [mode, load]);

  useEffect(() => {
    if (!needsLinkedDevice(form.inventoryType)) {
      setDeviceOptions([]);
      return;
    }
    const term = deviceQuery.trim();
    if (term.length < 2 && !form.linkedDeviceId) {
      setDeviceOptions([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ limit: '30' });
        if (term) params.set('q', term);
        const res = await api(`/assets?${params}`);
        if (!cancelled) setDeviceOptions(res.data || []);
      } catch {
        if (!cancelled) setDeviceOptions([]);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [deviceQuery, form.inventoryType, form.linkedDeviceId]);

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const onProductTypeChange = (next) => {
    const defaults = TYPE_DEFAULTS[next] || TYPE_DEFAULTS.Other;
    setForm((f) => ({
      ...f,
      productType: next,
      expiryApplicable: defaults.expiryApplicable,
      inventoryType: defaults.inventoryType,
      linkedDeviceId: needsLinkedDevice(defaults.inventoryType) ? f.linkedDeviceId : '',
      linkedDeviceLabel: needsLinkedDevice(defaults.inventoryType) ? f.linkedDeviceLabel : '',
    }));
  };

  const onInventoryTypeChange = (next) => {
    setForm((f) => ({
      ...f,
      inventoryType: next,
      linkedDeviceId: needsLinkedDevice(next) ? f.linkedDeviceId : '',
      linkedDeviceLabel: needsLinkedDevice(next) ? f.linkedDeviceLabel : '',
    }));
    if (!needsLinkedDevice(next)) setDeviceQuery('');
  };

  const startCreate = () => {
    setEditingId('');
    setEditingMeta({ code: '', sku: '', image: null });
    setForm(emptyForm());
    setDeviceQuery('');
    setDeviceOptions([]);
    setMsg('');
    setError('');
    setMode('create');
  };

  const startEdit = (row) => {
    const gst = Number(row.gstRate ?? 0);
    const gstCustom = !GST_PRESETS.includes(gst);
    const inventoryType = resolveInventory(row.inventoryType);
    setEditingId(row._id);
    setEditingMeta({
      code: row.code || '',
      sku: row.sku || '',
      image: row.image || null,
    });
    setForm({
      brand: row.brand || row.manufacturer || '',
      model: row.model || row.partNumber || row.name || '',
      uomId: row.uomId || '',
      unitsPerPack: String(row.unitsPerPack ?? 1),
      purchaseCost: row.standardCost ?? row.defaultPerUnitCost ?? '',
      gstRate: String(gst),
      gstCustom,
      inventoryType,
      linkedDeviceId: row.linkedDeviceId || '',
      linkedDeviceLabel: '',
      expiryApplicable: !!row.expiryApplicable,
      stockLevelApplicable: Number(row.minStock) > 0 || Number(row.maxStock) > 0,
      minStock: row.minStock ?? '',
      maxStock: row.maxStock ?? '',
      isActive: row.isActive !== false,
      productType: resolveType(row.productType),
    });
    setDeviceQuery('');
    setMsg('');
    setError('');
    setMode('edit');
    if (row.linkedDeviceId) {
      api(`/assets/${row.linkedDeviceId}`)
        .then((res) => {
          const a = res.data;
          if (!a) return;
          const label = [a.assetTag || a.code, a.name || a.model].filter(Boolean).join(' · ');
          setForm((f) => ({ ...f, linkedDeviceLabel: label || String(row.linkedDeviceId) }));
        })
        .catch(() => {});
    }
  };

  const backToList = () => {
    setMode('list');
    setEditingId('');
    setMsg('');
    setError('');
  };

  const buildPayload = () => {
    const modelVariantName = String(form.model || '').trim();
    return {
      name: modelVariantName,
      brand: form.brand,
      manufacturer: form.brand,
      model: modelVariantName,
      partNumber: modelVariantName,
      uomId: form.uomId || null,
      unitsPerPack: form.unitsPerPack === '' ? 1 : Number(form.unitsPerPack),
      purchaseCost: form.purchaseCost === '' ? 0 : Number(form.purchaseCost),
      standardCost: form.purchaseCost === '' ? 0 : Number(form.purchaseCost),
      gstRate: form.gstRate === '' ? 0 : Number(form.gstRate),
      inventoryType: form.inventoryType,
      linkedDeviceId: needsLinkedDevice(form.inventoryType) ? form.linkedDeviceId || null : null,
      expiryApplicable: form.expiryApplicable,
      minStock:
        form.stockLevelApplicable && form.minStock !== '' ? Number(form.minStock) : 0,
      maxStock:
        form.stockLevelApplicable && form.maxStock !== '' ? Number(form.maxStock) : 0,
      isActive: form.isActive,
      productType: form.productType,
    };
  };

  const save = async (e) => {
    e.preventDefault();
    if (!canWrite) return;
    setBusy(true);
    setError('');
    setMsg('');
    try {
      const body = buildPayload();
      if (mode === 'edit' && editingId) {
        const res = await api(`/logistics/products/${editingId}`, { method: 'PATCH', body });
        setEditingMeta({
          code: res.data?.code || editingMeta.code,
          sku: res.data?.sku || editingMeta.sku,
          image: res.data?.image || editingMeta.image,
        });
        setMsg('Product updated.');
      } else {
        const res = await api('/logistics/products', { method: 'POST', body });
        setEditingId(res.data?._id || '');
        setEditingMeta({
          code: res.data?.code || '',
          sku: res.data?.sku || '',
          image: res.data?.image || null,
        });
        setMode('edit');
        setMsg(`Product created as ${res.data?.code || 'saved'}.`);
      }
      loadLookups();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const deactivate = async (row) => {
    if (!canWrite) return;
    const next = row.isActive === false;
    if (!window.confirm(next ? `Activate “${row.name}”?` : `Deactivate “${row.name}”?`)) return;
    try {
      await api(`/logistics/products/${row._id}`, {
        method: 'PATCH',
        body: { isActive: next },
      });
      setMsg(next ? 'Activated.' : 'Deactivated.');
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const uploadImage = async (file) => {
    if (!editingId) {
      setError('Save the product first, then upload a photo.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('slot', 'image');
      fd.append('file', file);
      const res = await api(`/logistics/products/${editingId}/files`, { method: 'POST', body: fd });
      setEditingMeta({
        code: res.data?.code || editingMeta.code,
        sku: res.data?.sku || editingMeta.sku,
        image: res.data?.image || null,
      });
      setMsg('Photo uploaded.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const selectDevice = (asset) => {
    const label = [asset.assetTag || asset.code, asset.name || asset.model]
      .filter(Boolean)
      .join(' · ');
    setForm((f) => ({
      ...f,
      linkedDeviceId: asset._id,
      linkedDeviceLabel: label || asset._id,
    }));
    setDeviceQuery('');
    setDeviceOptions([]);
  };

  if (mode === 'list') {
    return (
      <div className="product-master">
        <div className="product-master-toolbar">
          <div>
            <h3 className="product-master-title">Product Master</h3>
            <p className="muted" style={{ margin: 0 }}>
              Catalog for inventory, linked devices, and costing.
            </p>
          </div>
          {canWrite && (
            <button type="button" className="btn" onClick={startCreate}>
              New product
            </button>
          )}
        </div>

        {(error || msg) && (
          <div className={`am-banner ${error ? 'is-error' : 'is-info'}`} role="status">
            {error || msg}
          </div>
        )}

        <div className="logistics-filter-bar">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search code, name, brand…"
          />
          <AdaptiveSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </AdaptiveSelect>
          <button type="button" className="btn btn-ghost" onClick={load}>
            Refresh
          </button>
        </div>

        <div className="card card--flush table-wrap">
          <table className="inv-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Model/Variant/Name</th>
                <th>Type</th>
                <th>Brand</th>
                <th>UOM</th>
                <th>Inventory</th>
                <th>Status</th>
                <th className="inv-col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row._id}>
                  <td className="mono-sm">{row.code || '-'}</td>
                  <td>{row.model || row.partNumber || row.name || '-'}</td>
                  <td>{resolveType(row.productType)}</td>
                  <td>{row.brand || row.manufacturer || '-'}</td>
                  <td>{uomName(row.uomId)}</td>
                  <td>{resolveInventory(row.inventoryType)}</td>
                  <td>{row.isActive === false ? 'Inactive' : 'Active'}</td>
                  <td className="inv-col-actions">
                    <div className="inv-row-actions">
                      {canWrite && (
                        <button type="button" className="inv-link" onClick={() => startEdit(row)}>
                          Edit
                        </button>
                      )}
                      {canWrite && (
                        <button type="button" className="inv-link" onClick={() => deactivate(row)}>
                          {row.isActive === false ? 'Activate' : 'Deactivate'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={8}>
                    <p className="muted" style={{ padding: 16, margin: 0 }}>
                      No products yet.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  const showLinked = needsLinkedDevice(form.inventoryType);
  const codeHint =
    {
      'Medical Device': 'MD0001',
      'Non-Medical Device': 'NM0001',
      'Peripheral Device': 'PD0001',
      Accessory: 'AC0001',
      'Spare Part': 'SP0001',
      Consumable: 'CN0001',
      Document: 'DC0001',
      Other: 'OT0001',
    }[form.productType] || 'Auto';

  return (
    <div className="product-master">
      <div className="product-master-toolbar">
        <div>
          <button type="button" className="btn btn-ghost" onClick={backToList}>
            ← Back to list
          </button>
          <h3 className="product-master-title" style={{ marginTop: 8 }}>
            {mode === 'edit' ? 'Edit product' : 'New product'}
          </h3>
          {mode === 'edit' ? (
            <p className="muted" style={{ margin: 0 }}>
              Code <strong>{editingMeta.code || '—'}</strong>
            </p>
          ) : (
            <p className="muted" style={{ margin: 0 }}>
              Product code is assigned automatically on save (e.g. {codeHint}).
            </p>
          )}
        </div>
      </div>

      {(error || msg) && (
        <div className={`am-banner ${error ? 'is-error' : 'is-info'}`} role="status">
          {error || msg}
        </div>
      )}

      <form className="card product-master-form" onSubmit={save}>
        <div className="logistics-form-grid">
          <div className="field">
            <label htmlFor="pm-type">Product Type *</label>
            <AdaptiveSelect
              id="pm-type"
              required
              value={form.productType}
              onChange={(e) => onProductTypeChange(e.target.value)}
            >
              {PRODUCT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </AdaptiveSelect>
          </div>
          <div className="field">
            <label htmlFor="pm-code">Product Code</label>
            <input id="pm-code" value={editingMeta.code || 'Auto-generated'} readOnly disabled />
          </div>

          <div className="field">
            <label htmlFor="pm-brand">Brand / Manufacturer *</label>
            <input
              id="pm-brand"
              required
              value={form.brand}
              onChange={(e) => setField('brand', e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="pm-model">Model/Variant/Name *</label>
            <input
              id="pm-model"
              required
              value={form.model}
              onChange={(e) => setField('model', e.target.value)}
              placeholder="Unique model, variant, or name"
            />
          </div>

          <div className="field">
            <label htmlFor="pm-uom">Unit of Measure (UOM)</label>
            <AdaptiveSelect
              id="pm-uom"
              value={form.uomId}
              onChange={(e) => setField('uomId', e.target.value)}
            >
              <option value="">Select UOM</option>
              {uoms.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.name} ({u.code})
                </option>
              ))}
            </AdaptiveSelect>
          </div>
          <div className="field">
            <label htmlFor="pm-upp">Units per Pack</label>
            <input
              id="pm-upp"
              type="number"
              min="1"
              step="1"
              value={form.unitsPerPack}
              onChange={(e) => setField('unitsPerPack', e.target.value)}
              placeholder="e.g. 100"
            />
          </div>

          <div className="field">
            <label htmlFor="pm-cost">Purchase Cost</label>
            <input
              id="pm-cost"
              type="number"
              min="0"
              step="0.01"
              value={form.purchaseCost}
              onChange={(e) => setField('purchaseCost', e.target.value)}
              placeholder="Per UOM"
            />
          </div>
          <div className="field">
            <label htmlFor="pm-gst">GST / Tax (%)</label>
            <AdaptiveSelect
              id="pm-gst"
              value={form.gstCustom ? 'custom' : String(form.gstRate)}
              onChange={(e) => {
                const v = e.target.value;
                if (v === 'custom') {
                  setForm((f) => ({ ...f, gstCustom: true }));
                } else {
                  setForm((f) => ({ ...f, gstCustom: false, gstRate: v }));
                }
              }}
            >
              {GST_PRESETS.map((r) => (
                <option key={r} value={String(r)}>
                  {r}%
                </option>
              ))}
              <option value="custom">Custom</option>
            </AdaptiveSelect>
            {form.gstCustom && (
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={form.gstRate}
                onChange={(e) => setField('gstRate', e.target.value)}
                aria-label="Custom GST rate"
                placeholder="Enter %"
                style={{ marginTop: 8 }}
              />
            )}
          </div>

          <div className="field">
            <label htmlFor="pm-inv-type">Inventory Type *</label>
            <AdaptiveSelect
              id="pm-inv-type"
              required
              value={form.inventoryType}
              onChange={(e) => onInventoryTypeChange(e.target.value)}
            >
              {INVENTORY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </AdaptiveSelect>
          </div>
          <div className="field">
            <label htmlFor="pm-expiry">Expiry Applicable</label>
            <AdaptiveSelect
              id="pm-expiry"
              value={form.expiryApplicable ? 'true' : 'false'}
              onChange={(e) => setField('expiryApplicable', e.target.value === 'true')}
            >
              <option value="false">No</option>
              <option value="true">Yes</option>
            </AdaptiveSelect>
          </div>

          {showLinked && (
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="pm-device">Linked Device</label>
              {form.linkedDeviceId ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <span>{form.linkedDeviceLabel || form.linkedDeviceId}</span>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() =>
                      setForm((f) => ({ ...f, linkedDeviceId: '', linkedDeviceLabel: '' }))
                    }
                  >
                    Clear
                  </button>
                </div>
              ) : null}
              <input
                id="pm-device"
                type="search"
                value={deviceQuery}
                onChange={(e) => setDeviceQuery(e.target.value)}
                placeholder="Search Asset Master…"
              />
              {deviceOptions.length > 0 && (
                <ul className="product-master-device-list" role="listbox">
                  {deviceOptions.map((a) => (
                    <li key={a._id}>
                      <button type="button" className="inv-link" onClick={() => selectDevice(a)}>
                        {[a.assetTag || a.code, a.name || a.model].filter(Boolean).join(' · ') ||
                          a._id}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="field">
            <label htmlFor="pm-stock-level">Stock Level</label>
            <AdaptiveSelect
              id="pm-stock-level"
              value={form.stockLevelApplicable ? 'true' : 'false'}
              onChange={(e) => {
                const on = e.target.value === 'true';
                setForm((f) => ({
                  ...f,
                  stockLevelApplicable: on,
                  minStock: on ? f.minStock : '',
                  maxStock: on ? f.maxStock : '',
                }));
              }}
            >
              <option value="false">No</option>
              <option value="true">Yes</option>
            </AdaptiveSelect>
          </div>

          {form.stockLevelApplicable && (
            <>
              <div className="field">
                <label htmlFor="pm-min">Minimum Stock Level</label>
                <input
                  id="pm-min"
                  type="number"
                  min="0"
                  step="1"
                  value={form.minStock}
                  onChange={(e) => setField('minStock', e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="pm-max">Maximum Stock Level</label>
                <input
                  id="pm-max"
                  type="number"
                  min="0"
                  step="1"
                  value={form.maxStock}
                  onChange={(e) => setField('maxStock', e.target.value)}
                />
              </div>
            </>
          )}

          <div className="field">
            <label htmlFor="pm-status">Status *</label>
            <AdaptiveSelect
              id="pm-status"
              value={form.isActive ? 'true' : 'false'}
              onChange={(e) => setField('isActive', e.target.value === 'true')}
            >
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </AdaptiveSelect>
          </div>

          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label>Upload Photo</label>
            {editingMeta.image?.url ? (
              <p className="muted" style={{ margin: '0 0 6px' }}>
                <a href={apiUrl(editingMeta.image.url)} target="_blank" rel="noreferrer">
                  {editingMeta.image.name || 'View photo'}
                </a>
              </p>
            ) : (
              <p className="muted" style={{ margin: '0 0 6px' }}>
                {editingId ? 'No photo yet' : 'Save first to upload a photo'}
              </p>
            )}
            <FilePicker
              accept="image/*"
              disabled={busy || !editingId}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadImage(f);
                e.target.value = '';
              }}
            />
          </div>
        </div>

        {canWrite && (
          <div className="logistics-form-actions">
            <button className="btn" type="submit" disabled={busy}>
              {busy ? 'Saving…' : mode === 'edit' ? 'Save changes' : 'Create product'}
            </button>
            <button className="btn btn-ghost" type="button" onClick={backToList}>
              Cancel
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
