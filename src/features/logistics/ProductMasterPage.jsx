import { useCallback, useEffect, useMemo, useState } from 'react';
import AdaptiveSelect from '../../components/ui/AdaptiveSelect.jsx';
import { api } from '../../shared/api.js';
import { useAuth } from '../../shared/auth.jsx';
import MasterExcelToolbar from '../../components/masters/MasterExcelToolbar.jsx';
import { masterExcelFor } from '../masters/masterExcelConfig.js';
import {
  GST_RATE_PRESETS,
  applyProductTypeRules,
  associatedProductTypesFor,
  categoriesForType,
  emptyProductForm,
  formToPayload,
  isConsumableType,
  isExpiryLocked,
  rowToForm,
  showReorderLevelField,
  showWarrantyField,
  suggestProductName,
  validateProductForm,
} from '../../shared/productMasterConfig.js';
import { PRODUCT_TYPES, resolveProductType } from '../../shared/productTypes.js';

function BoolSelect({ id, value, onChange, disabled }) {
  return (
    <AdaptiveSelect
      id={id}
      disabled={disabled}
      value={value ? 'true' : 'false'}
      onChange={(e) => onChange(e.target.value === 'true')}
    >
      <option value="true">Yes</option>
      <option value="false">No</option>
    </AdaptiveSelect>
  );
}

function Section({ title, children, className = '' }) {
  return (
    <section className={`pm-section ${className}`.trim()}>
      <h3 className="pm-section-title">{title}</h3>
      <div className="pm-section-grid">{children}</div>
    </section>
  );
}

function Field({ id, label, required, span = 1, children }) {
  return (
    <div className={`field pm-field ${span === 2 ? 'pm-span-2' : ''}`.trim()}>
      <label htmlFor={id}>
        {label}
        {required ? ' *' : ''}
      </label>
      {children}
    </div>
  );
}

export default function ProductMasterPage() {
  const { can } = useAuth();
  const canWrite = can('logistics:master') || can('logistics:write') || can('*');
  const excelConfig = masterExcelFor('products');

  const [mode, setMode] = useState('list');
  const [rows, setRows] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [uoms, setUoms] = useState([]);
  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState(() => new Set());
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(emptyProductForm);
  const [editingId, setEditingId] = useState('');
  const [editingCode, setEditingCode] = useState('');
  const [assocQuery, setAssocQuery] = useState('');

  const categoryOptions = useMemo(
    () => (typeFilter ? categoriesForType(typeFilter) : []),
    [typeFilter]
  );
  const formCategories = useMemo(() => categoriesForType(form.productType), [form.productType]);

  const uomLabel = useMemo(() => {
    const map = Object.fromEntries(uoms.map((u) => [u._id, `${u.name} (${u.code})`]));
    return (id) => map[id] || '—';
  }, [uoms]);

  const assocCandidates = useMemo(() => {
    const allowed = new Set(associatedProductTypesFor(form.productType));
    const term = assocQuery.trim().toLowerCase();
    return catalog
      .filter((p) => p._id !== editingId && allowed.has(resolveProductType(p.productType)))
      .filter((p) => {
        if (!term) return true;
        const hay = [p.code, p.name, p.brand, p.model, p.productCategory]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(term);
      })
      .slice(0, 40);
  }, [catalog, form.productType, editingId, assocQuery]);

  const loadLookups = useCallback(async () => {
    try {
      const [uomRes, productRes] = await Promise.all([
        api('/logistics/uoms?limit=200'),
        api('/logistics/products?limit=500&isActive=true'),
      ]);
      setUoms(uomRes.data || []);
      setCatalog(productRes.data || []);
    } catch {
      /* optional */
    }
  }, []);

  const load = useCallback(async () => {
    setError('');
    try {
      const params = new URLSearchParams({ limit: '500' });
      if (q.trim()) params.set('q', q.trim());
      if (typeFilter) params.set('productType', typeFilter);
      if (categoryFilter) params.set('productCategory', categoryFilter);
      if (statusFilter === 'active') params.set('isActive', 'true');
      if (statusFilter === 'inactive') params.set('isActive', 'false');
      const res = await api(`/logistics/products?${params}`);
      setRows(res.data || []);
      setSelected(new Set());
    } catch (e) {
      setError(e.message);
    }
  }, [q, typeFilter, categoryFilter, statusFilter]);

  useEffect(() => {
    loadLookups();
  }, [loadLookups]);

  useEffect(() => {
    if (mode === 'list') load();
  }, [mode, load]);

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const onProductTypeChange = (next) => {
    setForm((f) => ({
      ...f,
      productType: next,
      ...applyProductTypeRules(next, f),
    }));
  };

  const expiryLocked = isExpiryLocked(form.productType);

  const onBrandOrModelChange = (key, value) => {
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (!f.name || f.name === suggestProductName(f.brand, f.model)) {
        next.name = suggestProductName(
          key === 'brand' ? value : f.brand,
          key === 'model' ? value : f.model
        );
      }
      return next;
    });
  };

  const toggleAssoc = (id) => {
    setForm((f) => {
      const set = new Set(f.associatedProductIds || []);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return { ...f, associatedProductIds: [...set] };
    });
  };

  const startCreate = () => {
    setEditingId('');
    setEditingCode('');
    setForm(emptyProductForm());
    setAssocQuery('');
    setMsg('');
    setError('');
    setMode('create');
  };

  const startEdit = (row) => {
    setEditingId(row._id);
    setEditingCode(row.code || '');
    setForm(rowToForm(row));
    setAssocQuery('');
    setMsg('');
    setError('');
    setMode('edit');
  };

  const backToList = () => {
    setMode('list');
    setEditingId('');
    setMsg('');
    setError('');
    loadLookups();
  };

  const save = async (e) => {
    e.preventDefault();
    if (!canWrite) return;
    const validation = validateProductForm(form);
    if (validation) {
      setError(validation);
      return;
    }
    setBusy(true);
    setError('');
    setMsg('');
    try {
      const body = formToPayload(form);
      if (mode === 'edit' && editingId) {
        const res = await api(`/logistics/products/${editingId}`, { method: 'PATCH', body });
        setEditingCode(res.data?.code || editingCode);
        setMsg('Product updated.');
      } else {
        const res = await api('/logistics/products', { method: 'POST', body });
        setEditingId(res.data?._id || '');
        setEditingCode(res.data?.code || '');
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

  const runBulk = async (action) => {
    if (!canWrite || !selected.size) return;
    const label = action === 'delete' ? 'delete' : action;
    if (!window.confirm(`${label} ${selected.size} selected product(s)?`)) return;
    setBusy(true);
    setError('');
    try {
      await api('/logistics/products/bulk', {
        method: 'POST',
        body: { action, ids: [...selected] },
      });
      setMsg(`Bulk ${label} completed.`);
      load();
      loadLookups();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleRow = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === rows.length) setSelected(new Set());
    else setSelected(new Set(rows.map((r) => r._id)));
  };

  if (mode === 'list') {
    return (
      <div className="product-master pm-enterprise">
        <header className="product-master-toolbar pm-header">
          <div>
            <h3 className="product-master-title">Product Master</h3>
            <p className="muted pm-subtitle">
              Unified catalog for assets, inventory, procurement, and movements.
            </p>
          </div>
          {canWrite && (
            <button type="button" className="btn" onClick={startCreate}>
              + New product
            </button>
          )}
        </header>

        {(error || msg) && (
          <div className={`am-banner ${error ? 'is-error' : 'is-info'}`} role="status">
            {error || msg}
          </div>
        )}

        <div className="pm-filter-bar logistics-filter-bar">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search code, name, brand, model…"
            aria-label="Search products"
          />
          <AdaptiveSelect
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setCategoryFilter('');
            }}
            aria-label="Filter by product type"
          >
            <option value="">All types</option>
            {PRODUCT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </AdaptiveSelect>
          <AdaptiveSelect
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            disabled={!typeFilter}
            aria-label="Filter by category"
          >
            <option value="">All categories</option>
            {categoryOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </AdaptiveSelect>
          <AdaptiveSelect
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by status"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </AdaptiveSelect>
          <button type="button" className="btn btn-ghost" onClick={load}>
            Refresh
          </button>
          {excelConfig ? (
            <MasterExcelToolbar
              {...excelConfig}
              canImport={canWrite}
              onImportComplete={() => {
                load();
                loadLookups();
              }}
              onError={(message) => setError(message)}
              compact
            />
          ) : null}
        </div>

        {canWrite && selected.size > 0 && (
          <div className="pm-bulk-bar">
            <span>{selected.size} selected</span>
            <button type="button" className="btn btn-ghost" onClick={() => runBulk('activate')}>
              Activate
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => runBulk('deactivate')}>
              Deactivate
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => runBulk('delete')}>
              Delete
            </button>
          </div>
        )}

        <div className="card card--flush table-wrap">
          <table className="inv-table pm-table">
            <thead>
              <tr>
                {canWrite && (
                  <th className="pm-col-check">
                    <input
                      type="checkbox"
                      checked={rows.length > 0 && selected.size === rows.length}
                      onChange={toggleAll}
                      aria-label="Select all"
                    />
                  </th>
                )}
                <th>Code</th>
                <th>Product Name</th>
                <th>Type</th>
                <th>Category</th>
                <th>Brand</th>
                <th>UOM</th>
                <th>Inventory</th>
                <th>Cost</th>
                <th>Status</th>
                <th className="inv-col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row._id} className={selected.has(row._id) ? 'is-selected' : ''}>
                  {canWrite && (
                    <td className="pm-col-check">
                      <input
                        type="checkbox"
                        checked={selected.has(row._id)}
                        onChange={() => toggleRow(row._id)}
                        aria-label={`Select ${row.code || row.name}`}
                      />
                    </td>
                  )}
                  <td className="mono-sm">{row.code || '—'}</td>
                  <td>
                    <strong>{row.name || '—'}</strong>
                    {row.model ? (
                      <div className="muted pm-cell-sub">{row.model}</div>
                    ) : null}
                  </td>
                  <td>{resolveProductType(row.productType)}</td>
                  <td>{row.productCategory || '—'}</td>
                  <td>{row.brand || row.manufacturer || '—'}</td>
                  <td>{uomLabel(row.uomId)}</td>
                  <td>{row.inventoryType || '—'}</td>
                  <td className="mono-sm">
                    {Number(row.standardCost || 0).toLocaleString(undefined, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td>
                    <span className={`pm-status ${row.isActive === false ? 'is-inactive' : 'is-active'}`}>
                      {row.isActive === false ? 'Inactive' : 'Active'}
                    </span>
                  </td>
                  <td className="inv-col-actions">
                    <div className="inv-row-actions">
                      <button type="button" className="inv-link" onClick={() => startEdit(row)}>
                        {canWrite ? 'Edit' : 'View'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={canWrite ? 11 : 10}>
                    <p className="muted pm-empty">No products match your filters.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  const showAssoc = associatedProductTypesFor(form.productType).length > 0;
  const assocSelected = (form.associatedProductIds || []).length;
  const isConsumable = isConsumableType(form.productType);
  const showWarranty = showWarrantyField(form.productType);
  const showReorder = showReorderLevelField(form.productType);

  return (
    <div className="product-master pm-enterprise">
      <div className="pm-form-shell">
        <button type="button" className="btn btn-ghost btn-compact pm-back" onClick={backToList}>
          ← Catalog
        </button>

        {(error || msg) && (
          <div className={`am-banner ${error ? 'is-error' : 'is-info'}`} role="status">
            {error || msg}
          </div>
        )}

        <form className="card pm-form" onSubmit={save}>
          <header className="pm-form-head">
            <h3 className="product-master-title">
              {mode === 'edit' ? 'Edit product' : 'New product'}
            </h3>
            {editingCode ? <span className="pm-code-badge mono-sm">{editingCode}</span> : null}
          </header>
          <Section title="Classification">
            <Field id="pm-type" label="Product Type" required>
              <AdaptiveSelect
                id="pm-type"
                required
                disabled={!canWrite}
                value={form.productType}
                onChange={(e) => onProductTypeChange(e.target.value)}
              >
                {PRODUCT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </AdaptiveSelect>
            </Field>
            <Field id="pm-category" label="Product Category" required>
              <AdaptiveSelect
                id="pm-category"
                required
                disabled={!canWrite}
                value={form.productCategory}
                onChange={(e) => setField('productCategory', e.target.value)}
              >
                {formCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </AdaptiveSelect>
            </Field>
          </Section>

          <Section title="Product details">
            <Field id="pm-brand" label="Brand / Manufacturer" required>
              <input
                id="pm-brand"
                required
                readOnly={!canWrite}
                value={form.brand}
                onChange={(e) => onBrandOrModelChange('brand', e.target.value)}
              />
            </Field>
            <Field id="pm-model" label="Model / Variant" required>
              <input
                id="pm-model"
                required
                readOnly={!canWrite}
                value={form.model}
                onChange={(e) => onBrandOrModelChange('model', e.target.value)}
                placeholder="Model or variant"
              />
            </Field>
            <Field id="pm-name" label="Product Name" required>
              <input
                id="pm-name"
                required
                readOnly={!canWrite}
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                placeholder="Brand — Model"
              />
            </Field>
            <Field id="pm-desc" label="Description">
              <textarea
                id="pm-desc"
                rows={2}
                readOnly={!canWrite}
                value={form.description}
                onChange={(e) => setField('description', e.target.value)}
                placeholder="Optional"
              />
            </Field>
          </Section>

          <Section title="Commercial">
            <Field id="pm-uom" label="UOM">
              <AdaptiveSelect
                id="pm-uom"
                disabled={!canWrite}
                value={form.uomId}
                onChange={(e) => setField('uomId', e.target.value)}
              >
                <option value="">—</option>
                {uoms.map((u) => (
                  <option key={u._id} value={u._id}>
                    {u.name} ({u.code})
                  </option>
                ))}
              </AdaptiveSelect>
            </Field>
            {isConsumable ? (
              <Field id="pm-upp" label="Units per Pack" required>
                <input
                  id="pm-upp"
                  type="number"
                  min="1"
                  step="1"
                  required
                  readOnly={!canWrite}
                  value={form.unitsPerPack}
                  onChange={(e) => setField('unitsPerPack', e.target.value)}
                />
              </Field>
            ) : showWarranty ? (
              <Field id="pm-warranty" label="Warranty (Months)">
                <input
                  id="pm-warranty"
                  type="number"
                  min="0"
                  step="1"
                  readOnly={!canWrite}
                  value={form.warrantyMonths}
                  onChange={(e) => setField('warrantyMonths', e.target.value)}
                />
              </Field>
            ) : showReorder ? (
              <Field id="pm-reorder" label="Reorder Level">
                <input
                  id="pm-reorder"
                  type="number"
                  min="0"
                  step="1"
                  readOnly={!canWrite}
                  value={form.reorderLevel}
                  onChange={(e) => setField('reorderLevel', e.target.value)}
                />
              </Field>
            ) : null}
            <Field id="pm-cost" label="Default Purchase Cost">
              <input
                id="pm-cost"
                type="number"
                min="0"
                step="0.01"
                readOnly={!canWrite}
                value={form.purchaseCost}
                onChange={(e) => setField('purchaseCost', e.target.value)}
                placeholder="0.00"
              />
            </Field>
            {!isConsumable ? (
              <Field id="pm-gst" label="Default GST (%)">
                <div className="pm-gst-stack">
                  <AdaptiveSelect
                    id="pm-gst"
                    disabled={!canWrite}
                    value={form.gstCustom ? 'custom' : String(form.gstRate)}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === 'custom') setForm((f) => ({ ...f, gstCustom: true }));
                      else setForm((f) => ({ ...f, gstCustom: false, gstRate: v }));
                    }}
                  >
                    {GST_RATE_PRESETS.map((r) => (
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
                      readOnly={!canWrite}
                      value={form.gstRate}
                      onChange={(e) => setField('gstRate', e.target.value)}
                      aria-label="Custom GST rate"
                      placeholder="Rate %"
                    />
                  )}
                </div>
              </Field>
            ) : showReorder ? (
              <Field id="pm-reorder" label="Reorder Level">
                <input
                  id="pm-reorder"
                  type="number"
                  min="0"
                  step="1"
                  readOnly={!canWrite}
                  value={form.reorderLevel}
                  onChange={(e) => setField('reorderLevel', e.target.value)}
                />
              </Field>
            ) : null}
            {isConsumable && (
              <Field id="pm-gst" label="Default GST (%)" span={2}>
                <div className="pm-gst-stack pm-gst-stack--inline">
                  <AdaptiveSelect
                    id="pm-gst"
                    disabled={!canWrite}
                    value={form.gstCustom ? 'custom' : String(form.gstRate)}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === 'custom') setForm((f) => ({ ...f, gstCustom: true }));
                      else setForm((f) => ({ ...f, gstCustom: false, gstRate: v }));
                    }}
                  >
                    {GST_RATE_PRESETS.map((r) => (
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
                      readOnly={!canWrite}
                      value={form.gstRate}
                      onChange={(e) => setField('gstRate', e.target.value)}
                      aria-label="Custom GST rate"
                      placeholder="Rate %"
                    />
                  )}
                </div>
              </Field>
            )}
          </Section>

          <Section title="Status">
            <Field id="pm-expiry" label="Expiry Applicable">
              <BoolSelect
                id="pm-expiry"
                disabled={!canWrite || expiryLocked}
                value={form.expiryApplicable}
                onChange={(v) => setField('expiryApplicable', v)}
              />
              {expiryLocked && (
                <p className="pm-field-hint">Set automatically for this product type.</p>
              )}
            </Field>
            <Field id="pm-active" label="Active">
              <BoolSelect
                id="pm-active"
                disabled={!canWrite}
                value={form.isActive}
                onChange={(v) => setField('isActive', v)}
              />
            </Field>
            <Field id="pm-remarks" label="Remarks" span={2}>
              <textarea
                id="pm-remarks"
                rows={2}
                readOnly={!canWrite}
                value={form.remarks}
                onChange={(e) => setField('remarks', e.target.value)}
                placeholder="Internal notes"
              />
            </Field>
          </Section>

          {showAssoc && (
            <Section title="Associated products" className="pm-section--last pm-section--assoc">
              <div className="pm-assoc-panel pm-span-2">
                <div className="pm-assoc-head">
                  <p className="pm-assoc-desc">
                    Link compatible{' '}
                    {associatedProductTypesFor(form.productType)
                      .map((t) => t.toLowerCase())
                      .join(', ')}
                  </p>
                  {assocSelected > 0 ? (
                    <span className="pm-assoc-count">{assocSelected} selected</span>
                  ) : null}
                </div>
                <input
                  id="pm-assoc-search"
                  className="pm-assoc-search"
                  type="search"
                  disabled={!canWrite}
                  value={assocQuery}
                  onChange={(e) => setAssocQuery(e.target.value)}
                  placeholder="Search product catalog…"
                  aria-label="Search compatible products"
                />
                <ul className="pm-assoc-list" role="group" aria-label="Compatible products">
                  {assocCandidates.map((p) => {
                    const checked = (form.associatedProductIds || []).includes(p._id);
                    const name = p.name || suggestProductName(p.brand, p.model);
                    const typeLabel = resolveProductType(p.productType);
                    return (
                      <li key={p._id} className={`pm-assoc-row ${checked ? 'is-checked' : ''}`}>
                        <label className="pm-assoc-item">
                          <input
                            className="pm-assoc-check"
                            type="checkbox"
                            disabled={!canWrite}
                            checked={checked}
                            onChange={() => toggleAssoc(p._id)}
                          />
                          <span className="pm-assoc-body">
                            <span className="pm-assoc-primary">
                              {p.code ? (
                                <span className="pm-assoc-code mono-sm">{p.code}</span>
                              ) : null}
                              <span className="pm-assoc-name">{name || '—'}</span>
                            </span>
                            <span className="pm-assoc-meta">
                              {typeLabel}
                              {p.productCategory ? ` · ${p.productCategory}` : ''}
                            </span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
                {!assocCandidates.length && (
                  <p className="muted pm-assoc-empty">No matching products in the catalog.</p>
                )}
              </div>
            </Section>
          )}

          {!showAssoc && <div className="pm-section-divider" aria-hidden="true" />}

          {canWrite && (
            <div className="pm-form-actions">
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
    </div>
  );
}
