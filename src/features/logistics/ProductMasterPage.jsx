import { useCallback, useEffect, useMemo, useState } from 'react';
import AdaptiveSelect from '../../components/ui/AdaptiveSelect.jsx';
import FilePicker from '../../components/ui/FilePicker.jsx';
import { api, apiUrl } from '../../shared/api.js';
import { useAuth } from '../../shared/auth.jsx';

const PRODUCT_TYPES = ['Device', 'Consumable', 'Accessory', 'Spare Part', 'Document', 'Misc'];
const INVENTORY_TYPES = ['Asset', 'Inventory Item'];
const TRACKING_KINDS = ['None', 'Serial', 'Batch', 'Batch + Serial'];

const TYPE_DEFAULTS = {
  Device: { trackingKind: 'Serial', expiryApplicable: false, inventoryType: 'Asset' },
  Consumable: { trackingKind: 'Batch', expiryApplicable: true, inventoryType: 'Inventory Item' },
  Accessory: { trackingKind: 'Serial', expiryApplicable: false, inventoryType: 'Inventory Item' },
  'Spare Part': {
    trackingKind: 'Batch + Serial',
    expiryApplicable: false,
    inventoryType: 'Inventory Item',
  },
  Document: { trackingKind: 'None', expiryApplicable: false, inventoryType: 'Inventory Item' },
  Misc: { trackingKind: 'None', expiryApplicable: false, inventoryType: 'Inventory Item' },
};

function emptyForm() {
  return {
    name: '',
    categoryId: '',
    brand: '',
    manufacturer: '',
    description: '',
    isActive: true,
    productType: 'Device',
    inventoryType: 'Asset',
    trackingKind: 'Serial',
    uomId: '',
    expiryApplicable: false,
    standardCost: '',
  };
}

export default function ProductMasterPage() {
  const { can } = useAuth();
  const canWrite = can('logistics:master') || can('logistics:write') || can('*');

  const [mode, setMode] = useState('list'); // list | create | edit
  const [rows, setRows] = useState([]);
  const [categories, setCategories] = useState([]);
  const [uoms, setUoms] = useState([]);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState('');
  const [editingMeta, setEditingMeta] = useState({ code: '', sku: '', image: null });

  const categoryName = useMemo(() => {
    const map = Object.fromEntries(categories.map((c) => [c._id, c.name || c.code]));
    return (id) => map[id] || '-';
  }, [categories]);

  const uomName = useMemo(() => {
    const map = Object.fromEntries(uoms.map((u) => [u._id, u.name || u.code]));
    return (id) => map[id] || '-';
  }, [uoms]);

  const loadLookups = useCallback(async () => {
    try {
      const [cat, uom] = await Promise.all([
        api('/logistics/categories?limit=500'),
        api('/logistics/uoms?limit=500'),
      ]);
      setCategories(cat.data || []);
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

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const onProductTypeChange = (next) => {
    const defaults = TYPE_DEFAULTS[next] || TYPE_DEFAULTS.Misc;
    setForm((f) => ({
      ...f,
      productType: next,
      trackingKind: defaults.trackingKind,
      expiryApplicable: defaults.expiryApplicable,
      inventoryType: defaults.inventoryType,
    }));
  };

  const startCreate = () => {
    setEditingId('');
    setEditingMeta({ code: '', sku: '', image: null });
    setForm(emptyForm());
    setMsg('');
    setError('');
    setMode('create');
  };

  const startEdit = (row) => {
    setEditingId(row._id);
    setEditingMeta({
      code: row.code || '',
      sku: row.sku || '',
      image: row.image || null,
    });
    setForm({
      name: row.name || '',
      categoryId: row.categoryId || '',
      brand: row.brand || '',
      manufacturer: row.manufacturer || '',
      description: row.description || '',
      isActive: row.isActive !== false,
      productType: row.productType || 'Device',
      inventoryType: row.inventoryType || 'Inventory Item',
      trackingKind: row.trackingKind || 'None',
      uomId: row.uomId || '',
      expiryApplicable: !!row.expiryApplicable,
      standardCost: row.standardCost ?? row.defaultPerUnitCost ?? '',
    });
    setMsg('');
    setError('');
    setMode('edit');
  };

  const backToList = () => {
    setMode('list');
    setEditingId('');
    setMsg('');
    setError('');
  };

  const buildPayload = () => ({
    name: form.name,
    categoryId: form.categoryId || null,
    brand: form.brand,
    manufacturer: form.manufacturer,
    description: form.description,
    isActive: form.isActive,
    productType: form.productType,
    inventoryType: form.inventoryType,
    trackingKind: form.trackingKind,
    uomId: form.uomId || null,
    expiryApplicable: form.expiryApplicable,
    standardCost: form.standardCost === '' ? 0 : Number(form.standardCost),
    defaultPerUnitCost: form.standardCost === '' ? 0 : Number(form.standardCost),
  });

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
      setError('Save the product first, then upload an image.');
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
      setMsg('Image uploaded.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (mode === 'list') {
    return (
      <div className="product-master">
        <div className="product-master-toolbar">
          <div>
            <h3 className="product-master-title">Products</h3>
            <p className="muted" style={{ margin: 0 }}>
              Product catalog for inventory and custody.
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
                <th>Product</th>
                <th>Type</th>
                <th>Category</th>
                <th>Brand</th>
                <th>UOM</th>
                <th>Tracking</th>
                <th>Status</th>
                <th className="inv-col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row._id}>
                  <td className="mono-sm">{row.code || '-'}</td>
                  <td>{row.name || '-'}</td>
                  <td>{row.productType || '-'}</td>
                  <td>{categoryName(row.categoryId)}</td>
                  <td>{row.brand || '-'}</td>
                  <td>{uomName(row.uomId)}</td>
                  <td>{row.trackingKind || '-'}</td>
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
                  <td colSpan={9}>
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
              {' · '}
              SKU <strong>{editingMeta.sku || '—'}</strong>
            </p>
          ) : (
            <p className="muted" style={{ margin: 0 }}>
              Product code and SKU are assigned automatically on save.
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
          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label htmlFor="pm-name">Product Name *</label>
            <input
              id="pm-name"
              required
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="pm-code">Product Code</label>
            <input id="pm-code" value={editingMeta.code || 'Auto generated'} readOnly disabled />
          </div>
          <div className="field">
            <label htmlFor="pm-sku">SKU</label>
            <input id="pm-sku" value={editingMeta.sku || 'Auto generated'} readOnly disabled />
          </div>

          <div className="field">
            <label htmlFor="pm-category">Category *</label>
            <AdaptiveSelect
              id="pm-category"
              required
              value={form.categoryId}
              onChange={(e) => setField('categoryId', e.target.value)}
            >
              <option value="">Select category</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </AdaptiveSelect>
          </div>
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
            <label htmlFor="pm-brand">Brand *</label>
            <input
              id="pm-brand"
              required
              value={form.brand}
              onChange={(e) => setField('brand', e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="pm-mfr">Manufacturer *</label>
            <input
              id="pm-mfr"
              required
              value={form.manufacturer}
              onChange={(e) => setField('manufacturer', e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="pm-uom">Unit of Measure</label>
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
            <label htmlFor="pm-track">Tracking</label>
            <AdaptiveSelect
              id="pm-track"
              value={form.trackingKind}
              onChange={(e) => setField('trackingKind', e.target.value)}
            >
              {TRACKING_KINDS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </AdaptiveSelect>
          </div>

          <div className="field">
            <label htmlFor="pm-inv-type">Inventory Type</label>
            <AdaptiveSelect
              id="pm-inv-type"
              value={form.inventoryType}
              onChange={(e) => setField('inventoryType', e.target.value)}
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

          <div className="field">
            <label htmlFor="pm-cost">Standard Cost</label>
            <input
              id="pm-cost"
              type="number"
              min="0"
              step="0.01"
              value={form.standardCost}
              onChange={(e) => setField('standardCost', e.target.value)}
            />
          </div>
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
            <label htmlFor="pm-desc">Description</label>
            <textarea
              id="pm-desc"
              rows={2}
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
            />
          </div>

          <div className="field">
            <label>Image</label>
            {editingMeta.image?.url ? (
              <p className="muted" style={{ margin: '0 0 6px' }}>
                <a href={apiUrl(editingMeta.image.url)} target="_blank" rel="noreferrer">
                  {editingMeta.image.name || 'View image'}
                </a>
              </p>
            ) : (
              <p className="muted" style={{ margin: '0 0 6px' }}>
                {editingId ? 'No image yet' : 'Save first to upload'}
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
