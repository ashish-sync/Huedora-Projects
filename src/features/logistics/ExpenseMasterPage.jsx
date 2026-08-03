import { useCallback, useEffect, useMemo, useState } from 'react';
import { FeedbackAlerts } from '../../components/ui/FeedbackBanner.jsx';
import AdaptiveSelect from '../../components/ui/AdaptiveSelect.jsx';
import MasterExcelToolbar from '../../components/masters/MasterExcelToolbar.jsx';
import MasterFilterShell from '../../components/masters/MasterFilterShell.jsx';
import MasterListHeader from '../../components/masters/MasterListHeader.jsx';
import MasterSearchField from '../../components/masters/MasterSearchField.jsx';
import { api } from '../../shared/api.js';
import { useAuth } from '../../shared/auth.jsx';
import { masterExcelFor } from '../masters/masterExcelConfig.js';

const TABS = [
  { id: 'categories', label: 'Categories' },
  { id: 'subcategories', label: 'Sub Categories' },
];

const emptyCategoryForm = { code: '', name: '' };
const emptySubForm = { categoryId: '', name: '' };

export default function ExpenseMasterPage() {
  const { can } = useAuth();
  const canWrite = can('logistics:master') || can('logistics:write') || can('*');
  const excelConfig = masterExcelFor('expense-categories');

  const [tab, setTab] = useState('categories');
  const [categories, setCategories] = useState([]);
  const [subCategories, setSubCategories] = useState([]);
  const [q, setQ] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const [categoryForm, setCategoryForm] = useState(emptyCategoryForm);
  const [subForm, setSubForm] = useState(emptySubForm);
  const [editingCategoryId, setEditingCategoryId] = useState('');
  const [editingSubId, setEditingSubId] = useState('');

  const subCountByCategory = useMemo(() => {
    const map = new Map();
    for (const row of subCategories) {
      const key = String(row.categoryId || '');
      map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  }, [subCategories]);

  const loadAll = useCallback(async () => {
    setError('');
    try {
      const [catRes, subRes] = await Promise.all([
        api('/logistics/expense-categories?limit=500'),
        api('/logistics/expense-subcategories?limit=1000'),
      ]);
      setCategories(catRes.data || []);
      setSubCategories(subRes.data || []);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const term = q.trim().toLowerCase();

  const filteredCategories = useMemo(() => {
    if (!term) return categories;
    return categories.filter((row) =>
      [row.code, row.name].some((v) => String(v || '').toLowerCase().includes(term))
    );
  }, [categories, term]);

  const filteredSubs = useMemo(() => {
    return subCategories.filter((row) => {
      if (categoryFilter && String(row.categoryId) !== String(categoryFilter)) return false;
      if (!term) return true;
      return [row.categoryName, row.name].some((v) => String(v || '').toLowerCase().includes(term));
    });
  }, [subCategories, categoryFilter, term]);

  const resetForms = () => {
    setCategoryForm(emptyCategoryForm);
    setSubForm(emptySubForm);
    setEditingCategoryId('');
    setEditingSubId('');
  };

  const saveCategory = async (e) => {
    e.preventDefault();
    if (!canWrite) return;
    setBusy(true);
    setError('');
    setMsg('');
    try {
      const body = { code: categoryForm.code.trim().toUpperCase(), name: categoryForm.name.trim() };
      if (editingCategoryId) {
        await api(`/logistics/expense-categories/${editingCategoryId}`, { method: 'PUT', body });
        setMsg('Category updated.');
      } else {
        await api('/logistics/expense-categories', { method: 'POST', body });
        setMsg('Category added.');
      }
      resetForms();
      loadAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const saveSub = async (e) => {
    e.preventDefault();
    if (!canWrite) return;
    const cat = categories.find((c) => String(c._id) === String(subForm.categoryId));
    if (!cat) {
      setError('Select an expense category.');
      return;
    }
    setBusy(true);
    setError('');
    setMsg('');
    try {
      const body = {
        categoryId: cat._id,
        categoryName: cat.name,
        name: subForm.name.trim(),
      };
      if (editingSubId) {
        await api(`/logistics/expense-subcategories/${editingSubId}`, { method: 'PUT', body });
        setMsg('Sub category updated.');
      } else {
        await api('/logistics/expense-subcategories', { method: 'POST', body });
        setMsg('Sub category added.');
      }
      resetForms();
      loadAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const removeRow = async (path, id, label) => {
    if (!canWrite || !window.confirm(`Delete “${label}”?`)) return;
    setError('');
    try {
      await api(`${path}/${id}`, { method: 'DELETE' });
      setMsg('Deleted.');
      if (editingCategoryId === id || editingSubId === id) resetForms();
      loadAll();
    } catch (err) {
      setError(err.message);
    }
  };

  const startEditCategory = (row) => {
    setEditingCategoryId(row._id);
    setCategoryForm({ code: row.code || '', name: row.name || '' });
  };

  const startEditSub = (row) => {
    setEditingSubId(row._id);
    setSubForm({ categoryId: row.categoryId || '', name: row.name || '' });
  };

  const searchPlaceholder =
    tab === 'categories' ? 'Search code or category…' : 'Search category or sub category…';

  return (
    <div className="expense-master">
      <MasterListHeader
        title="Expense Master"
        subtitle="Expense categories and sub-categories used for Finance One Requests and finance tagging."
        actions={
          excelConfig ? (
            <MasterExcelToolbar
              {...excelConfig}
              canImport={canWrite}
              onImportComplete={loadAll}
              onError={(message) => setError(message)}
              compact
            />
          ) : null
        }
      />

      <div className="expense-master-kpis" role="group" aria-label="Expense master summary">
        <div className="expense-master-kpi">
          <strong>{categories.length}</strong>
          <span>Categories</span>
        </div>
        <div className="expense-master-kpi">
          <strong>{subCategories.length}</strong>
          <span>Sub categories</span>
        </div>
      </div>

      {(error || msg) && <FeedbackAlerts error={error} message={msg} />}

      <div className="expense-master-tabs" role="tablist" aria-label="Expense master views">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={`expense-master-tab${tab === item.id ? ' is-active' : ''}`}
            onClick={() => {
              setTab(item.id);
              setQ('');
              resetForms();
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      <MasterFilterShell
        actions={
          <button type="button" className="btn secondary btn-compact" onClick={loadAll} disabled={busy}>
            Refresh
          </button>
        }
      >
        <MasterSearchField
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label="Search expense master"
        />
        {tab === 'subcategories' ? (
          <AdaptiveSelect
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label="Filter by expense category"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c._id} value={c._id}>
                {c.code ? `${c.code} · ${c.name}` : c.name}
              </option>
            ))}
          </AdaptiveSelect>
        ) : null}
      </MasterFilterShell>

      {canWrite && tab === 'categories' ? (
        <form className="card expense-master-form" onSubmit={saveCategory}>
          <div className="expense-master-form-grid expense-master-form-grid--category">
            <div className="field">
              <label htmlFor="em-code">Code</label>
              <input
                id="em-code"
                value={categoryForm.code}
                onChange={(e) => setCategoryForm({ ...categoryForm, code: e.target.value.toUpperCase() })}
                placeholder="e.g. MED"
                required
                maxLength={12}
                disabled={Boolean(editingCategoryId)}
              />
            </div>
            <div className="field">
              <label htmlFor="em-category">Expense Category</label>
              <input
                id="em-category"
                value={categoryForm.name}
                onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                placeholder="e.g. Medical Devices"
                required
              />
            </div>
            <div className="logistics-form-actions logistics-form-actions--inline">
              <button className="btn" type="submit" disabled={busy}>
                {busy ? 'Saving…' : editingCategoryId ? 'Save' : 'Add'}
              </button>
              {editingCategoryId ? (
                <button className="btn secondary" type="button" onClick={resetForms}>
                  Cancel
                </button>
              ) : null}
            </div>
          </div>
        </form>
      ) : null}

      {canWrite && tab === 'subcategories' ? (
        <form className="card expense-master-form" onSubmit={saveSub}>
          <div className="expense-master-form-grid expense-master-form-grid--sub">
            <div className="field">
              <label htmlFor="em-sub-category">Expense Category</label>
              <AdaptiveSelect
                id="em-sub-category"
                value={subForm.categoryId}
                onChange={(e) => setSubForm({ ...subForm, categoryId: e.target.value })}
                required
              >
                <option value="">Select category…</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.code ? `${c.code} · ${c.name}` : c.name}
                  </option>
                ))}
              </AdaptiveSelect>
            </div>
            <div className="field">
              <label htmlFor="em-sub-name">Expense Sub-Category</label>
              <input
                id="em-sub-name"
                value={subForm.name}
                onChange={(e) => setSubForm({ ...subForm, name: e.target.value })}
                placeholder="e.g. ECG Machine"
                required
              />
            </div>
            <div className="logistics-form-actions logistics-form-actions--inline">
              <button className="btn" type="submit" disabled={busy}>
                {busy ? 'Saving…' : editingSubId ? 'Save' : 'Add'}
              </button>
              {editingSubId ? (
                <button className="btn secondary" type="button" onClick={resetForms}>
                  Cancel
                </button>
              ) : null}
            </div>
          </div>
        </form>
      ) : null}

      <div className="card card--flush table-wrap">
        {tab === 'categories' ? (
          <table className="inv-table expense-master-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Expense Category</th>
                <th className="num">Sub categories</th>
                <th>Status</th>
                <th className="inv-col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCategories.map((row) => (
                <tr key={row._id}>
                  <td className="mono-sm">{row.code || '—'}</td>
                  <td>
                    <strong>{row.name}</strong>
                  </td>
                  <td className="num">{subCountByCategory.get(String(row._id)) || 0}</td>
                  <td>{row.isActive === false ? 'Inactive' : 'Active'}</td>
                  <td className="inv-col-actions">
                    <div className="inv-row-actions">
                      {canWrite ? (
                        <>
                          <button type="button" className="inv-link" onClick={() => startEditCategory(row)}>
                            Edit
                          </button>
                          <button
                            type="button"
                            className="inv-link"
                            onClick={() => removeRow('/logistics/expense-categories', row._id, row.name)}
                          >
                            Delete
                          </button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {!filteredCategories.length ? (
                <tr>
                  <td colSpan={5}>
                    <p className="muted" style={{ padding: 16, margin: 0 }}>
                      No categories yet.
                    </p>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        ) : null}

        {tab === 'subcategories' ? (
          <table className="inv-table expense-master-table">
            <thead>
              <tr>
                <th>Expense Category</th>
                <th>Expense Sub-Category</th>
                <th>Status</th>
                <th className="inv-col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSubs.map((row) => (
                <tr key={row._id}>
                  <td>{row.categoryName || '—'}</td>
                  <td>
                    <strong>{row.name}</strong>
                  </td>
                  <td>{row.isActive === false ? 'Inactive' : 'Active'}</td>
                  <td className="inv-col-actions">
                    <div className="inv-row-actions">
                      {canWrite ? (
                        <>
                          <button type="button" className="inv-link" onClick={() => startEditSub(row)}>
                            Edit
                          </button>
                          <button
                            type="button"
                            className="inv-link"
                            onClick={() => removeRow('/logistics/expense-subcategories', row._id, row.name)}
                          >
                            Delete
                          </button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {!filteredSubs.length ? (
                <tr>
                  <td colSpan={4}>
                    <p className="muted" style={{ padding: 16, margin: 0 }}>
                      No sub categories yet.
                    </p>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        ) : null}
      </div>

      <p className="muted expense-master-footnote">
        Example transaction: Expense Category → Expense Sub-Category → Amount.
      </p>
    </div>
  );
}
