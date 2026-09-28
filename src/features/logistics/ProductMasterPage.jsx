import { useCallback, useEffect, useMemo, useState } from 'react';
import { FeedbackAlerts } from '../../components/ui/FeedbackBanner.jsx';
import AdaptiveSelect from '../../components/ui/AdaptiveSelect.jsx';
import ProductImagesPanel from '../../components/products/ProductImagesPanel.jsx';
import { uploadProductImages } from '../../shared/productImages.js';
import { api } from '../../shared/api.js';
import { useDebouncedValue } from '../../shared/useDebouncedValue.js';
import { useAuth } from '../../shared/auth.jsx';
import MasterExcelToolbar from '../../components/masters/MasterExcelToolbar.jsx';
import MasterFilterShell from '../../components/masters/MasterFilterShell.jsx';
import MasterListHeader from '../../components/masters/MasterListHeader.jsx';
import MasterSearchField from '../../components/masters/MasterSearchField.jsx';
import PaginationBar from '../../components/ui/PaginationBar.jsx';
import { masterExcelFor } from '../masters/masterExcelConfig.js';
import {
  INVENTORY_TRACKING_OPTIONS,
  PRODUCT_CLASSIFICATIONS,
  PRODUCT_CATEGORY_KINDS,
  applyClassificationCategoryChange,
  associatedProductTypesFor,
  categoriesForType,
  emptyProductForm,
  formToPayload,
  inventoryTrackingLabel,
  isExpiryLocked,
  rowToForm,
  showReorderLevelField,
  suggestProductName,
  validateProductForm,
  decomposeProductType,
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
  const [listMeta, setListMeta] = useState({ page: 1, limit: 50, total: 0, pages: 0 });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [catalog, setCatalog] = useState([]);
  const [uoms, setUoms] = useState([]);
  const [q, setQ] = useState('');
  const debouncedQ = useDebouncedValue(q, 300);
  const [typeFilter, setTypeFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState(() => new Set());
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(() => emptyProductForm());
  const [editingId, setEditingId] = useState('');
  const [editingCode, setEditingCode] = useState('');
  const [productRecord, setProductRecord] = useState(null);
  const [pendingImages, setPendingImages] = useState([]);
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
        api('/logistics/products?limit=200&isActive=true'),
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
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (debouncedQ.trim()) params.set('q', debouncedQ.trim());
      if (typeFilter) params.set('productType', typeFilter);
      if (categoryFilter) params.set('productCategory', categoryFilter);
      if (statusFilter === 'active') params.set('isActive', 'true');
      if (statusFilter === 'inactive') params.set('isActive', 'false');
      const res = await api(`/logistics/products?${params}`);
      const data = res.data || [];
      setRows(data);
      setListMeta(
        res.meta || {
          page,
          limit,
          total: data.length,
          pages: Math.ceil(data.length / limit) || 0,
        }
      );
      setSelected(new Set());
    } catch (e) {
      setError(e.message);
    }
  }, [debouncedQ, typeFilter, categoryFilter, statusFilter, page, limit]);

  useEffect(() => {
    loadLookups();
  }, [loadLookups]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, typeFilter, categoryFilter, statusFilter]);

  useEffect(() => {
    if (mode === 'list') load();
  }, [mode, load]);

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const onClassificationChange = (next) => {
    setForm((f) => ({
      ...f,
      ...applyClassificationCategoryChange(next, f.productCategoryKind || 'Device', f),
    }));
  };

  const onCategoryKindChange = (next) => {
    setForm((f) => ({
      ...f,
      ...applyClassificationCategoryChange(f.productClassification || 'Medical', next, f),
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
    setProductRecord(null);
    setPendingImages([]);
    setForm(emptyProductForm());
    setAssocQuery('');
    setMsg('');
    setError('');
    setMode('create');
  };

  const startEdit = (row) => {
    setEditingId(row._id);
    setEditingCode(row.code || '');
    setProductRecord(row);
    setPendingImages([]);
    setForm(rowToForm(row));
    setAssocQuery('');
    setMsg('');
    setError('');
    setMode('edit');
  };

  const onProductMediaUpdated = (row) => {
    setProductRecord(row);
    setRows((prev) => prev.map((r) => (String(r._id) === String(row._id) ? { ...r, ...row } : r)));
    setCatalog((prev) => prev.map((r) => (String(r._id) === String(row._id) ? { ...r, ...row } : r)));
  };

  const backToList = () => {
    setMode('list');
    setEditingId('');
    setPendingImages([]);
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
        setProductRecord(res.data || productRecord);
        setMsg('Product updated.');
      } else {
        const res = await api('/logistics/products', { method: 'POST', body });
        const createdId = res.data?._id || '';
        const hadPending = pendingImages.length > 0;
        let saved = res.data || null;
        if (createdId && hadPending) {
          try {
            saved = await uploadProductImages(createdId, pendingImages);
            setPendingImages([]);
          } catch (uploadErr) {
            setEditingId(createdId);
            setEditingCode(res.data?.code || '');
            setProductRecord(res.data || null);
            setMode('edit');
            setError(
              `Product created as ${res.data?.code || 'saved'}, but image upload failed: ${uploadErr.message}`
            );
            loadLookups();
            return;
          }
        }
        setEditingId(saved?._id || createdId);
        setEditingCode(saved?.code || res.data?.code || '');
        setProductRecord(saved);
        setPendingImages([]);
        setMode('edit');
        setMsg(
          hadPending
            ? `Product created as ${saved?.code || res.data?.code || 'saved'} with images.`
            : `Product created as ${saved?.code || res.data?.code || 'saved'}.`
        );
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
        <MasterListHeader
          title="Products"
          subtitle="Unified catalog for assets, inventory, procurement, and movements."
          actions={
            <>
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
              {canWrite ? (
                <button type="button" className="btn btn-compact" onClick={startCreate}>
                  + New product
                </button>
              ) : null}
            </>
          }
        />

        {(error || msg) && <FeedbackAlerts error={error} message={msg} />}

        <MasterFilterShell
          actions={
            <button type="button" className="btn secondary btn-compact" onClick={load} disabled={busy}>
              Refresh
            </button>
          }
        >
          <MasterSearchField
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
              aria-label="Filter by method"
            >
              <option value="">All methods</option>
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
        </MasterFilterShell>

        {canWrite && selected.size > 0 && (
          <div className="master-bulk-bar">
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
                <th>Classification</th>
                <th>Category</th>
                <th>Method</th>
                <th>Code</th>
                <th>Display Name</th>
                <th>Brand</th>
                <th>UOM</th>
                <th>Track By</th>
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
                  <td>
                    {
                      decomposeProductType(row.productType, row.productClassification)
                        .classification
                    }
                  </td>
                  <td>
                    {
                      decomposeProductType(row.productType, row.productClassification)
                        .categoryKind
                    }
                  </td>
                  <td>{row.productCategory || '—'}</td>
                  <td className="mono-sm">{row.code || '—'}</td>
                  <td>
                    <strong>{row.name || '—'}</strong>
                    {row.model ? (
                      <div className="muted pm-cell-sub">{row.model}</div>
                    ) : null}
                  </td>
                  <td>{row.brand || row.manufacturer || '—'}</td>
                  <td>{uomLabel(row.uomId)}</td>
                  <td>{inventoryTrackingLabel(row.trackingKind)}</td>
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
                  <td colSpan={canWrite ? 10 : 9}>
                    <p className="muted pm-empty">No products match your filters.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <PaginationBar
          page={listMeta.page || page}
          limit={listMeta.limit || limit}
          total={listMeta.total || 0}
          pages={listMeta.pages || 0}
          onPageChange={setPage}
          onLimitChange={(n) => {
            setLimit(n);
            setPage(1);
          }}
        />
      </div>
    );
  }

  const showAssoc = associatedProductTypesFor(form.productType).length > 0;
  const assocSelected = (form.associatedProductIds || []).length;

  return (
    <div className="product-master pm-enterprise">
      <div className="pm-form-shell">
        <button type="button" className="btn btn-ghost btn-compact pm-back" onClick={backToList}>
          ← Catalog
        </button>

        {(error || msg) && <FeedbackAlerts error={error} message={msg} />}

        <form className="card pm-form" onSubmit={save}>
          <header className="pm-form-head">
            <h3 className="product-master-title">
              {mode === 'edit' ? 'Edit product' : 'New product'}
            </h3>
          </header>

          <Section title="Product">
            <Field id="pm-classification" label="Product Classification" required>
              <AdaptiveSelect
                id="pm-classification"
                required
                disabled={!canWrite}
                value={form.productClassification || 'Medical'}
                onChange={(e) => onClassificationChange(e.target.value)}
              >
                {PRODUCT_CLASSIFICATIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </AdaptiveSelect>
            </Field>
            <Field id="pm-category-kind" label="Product Category" required>
              <AdaptiveSelect
                id="pm-category-kind"
                required
                disabled={!canWrite}
                value={form.productCategoryKind || 'Device'}
                onChange={(e) => onCategoryKindChange(e.target.value)}
              >
                {PRODUCT_CATEGORY_KINDS.map((c) => (
                  <option key={c} value={c}>
                    {c === 'Consumable' ? 'Consumables' : c}
                  </option>
                ))}
              </AdaptiveSelect>
            </Field>
            <Field id="pm-method" label="Method" required>
              <AdaptiveSelect
                id="pm-method"
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
            <Field id="pm-brand" label="Brand - Manufacturer" required>
              <input
                id="pm-brand"
                required
                readOnly={!canWrite}
                value={form.brand}
                onChange={(e) => onBrandOrModelChange('brand', e.target.value)}
              />
            </Field>
            <Field id="pm-model" label="Model - Variant" required>
              <input
                id="pm-model"
                required
                readOnly={!canWrite}
                value={form.model}
                onChange={(e) => onBrandOrModelChange('model', e.target.value)}
                placeholder="Model or variant"
              />
            </Field>
            <Field id="pm-status" label="Status">
              <AdaptiveSelect
                id="pm-status"
                disabled={!canWrite}
                value={form.isActive !== false ? 'Active' : 'Inactive'}
                onChange={(e) => setField('isActive', e.target.value === 'Active')}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </AdaptiveSelect>
            </Field>
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
            <Field id="pm-tracking" label="Track Inventory By" required>
              <AdaptiveSelect
                id="pm-tracking"
                required
                disabled={!canWrite}
                value={form.trackingKind || 'None'}
                onChange={(e) => setField('trackingKind', e.target.value)}
              >
                {INVENTORY_TRACKING_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </AdaptiveSelect>
            </Field>
            <Field id="pm-expiry" label="Expiry Applicable">
              <BoolSelect
                id="pm-expiry"
                disabled={!canWrite || expiryLocked}
                value={form.expiryApplicable}
                onChange={(v) => setField('expiryApplicable', v)}
              />
            </Field>
            {showReorderLevelField(form.productType) ? (
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
          </Section>

          <section className="pm-section pm-section--last pm-section--split-row">
            <div className="pm-split-row">
              <div className="pm-split-col pm-split-col--name">
                <h3 className="pm-section-title">Display Name</h3>
                <div className="pm-split-col__body">
                  <div className="field pm-field">
                    <input
                      id="pm-name"
                      required
                      readOnly={!canWrite}
                      value={form.name}
                      onChange={(e) => setField('name', e.target.value)}
                      placeholder="Brand — Model"
                      aria-label="Display Name"
                    />
                  </div>
                </div>
              </div>

              <div className="pm-split-col pm-split-col--images">
                <h3 className="pm-section-title">Product images</h3>
                <div className="pm-split-col__body">
                  <ProductImagesPanel
                    productId={mode === 'edit' ? editingId : ''}
                    product={productRecord}
                    canWrite={canWrite}
                    showTitle={false}
                    compact
                    onUpdated={onProductMediaUpdated}
                    pendingFiles={pendingImages}
                    onPendingChange={setPendingImages}
                    hint={
                      mode === 'edit'
                        ? 'Upload photos for asset identification.'
                        : 'Optional — selected images upload when you create the product.'
                    }
                  />
                </div>
              </div>

              <div className="pm-split-col pm-split-col--assoc">
                <h3 className="pm-section-title">Associated products</h3>
                <div className="pm-split-col__body">
                  {showAssoc ? (
                    <div className="pm-assoc-panel">
                      {assocSelected > 0 ? (
                        <div className="pm-assoc-head">
                          <span className="pm-assoc-count">{assocSelected} selected</span>
                        </div>
                      ) : null}
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
                  ) : (
                    <p className="muted pm-split-placeholder">
                      Available for Device products.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </section>

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
