import { useCallback, useEffect, useMemo, useState } from 'react';
import { FeedbackAlerts } from '../../components/ui/FeedbackBanner.jsx';
import AdaptiveSelect from '../../components/ui/AdaptiveSelect.jsx';
import ConfirmDialog from '../../components/ui/ConfirmDialog.jsx';
import MasterFilterShell from '../../components/masters/MasterFilterShell.jsx';
import MasterSearchField from '../../components/masters/MasterSearchField.jsx';
import { api } from '../../shared/api.js';
import { useAuth } from '../../shared/auth.jsx';
import { useDebouncedValue } from '../../shared/useDebouncedValue.js';

const FALLBACK_CATEGORIES = [
  { id: 'PUBLIC_CAMP_REQUEST', label: 'Public Camp Request' },
  { id: 'INTERNAL', label: 'Internal' },
  { id: 'OTHER', label: 'Other' },
];

const FALLBACK_FIELD_TYPES = [
  { id: 'text', label: 'Text' },
  { id: 'textarea', label: 'Long text' },
  { id: 'number', label: 'Number' },
  { id: 'date', label: 'Date' },
  { id: 'time', label: 'Time' },
  { id: 'phone', label: 'Phone' },
  { id: 'email', label: 'Email' },
  { id: 'select', label: 'Dropdown' },
];

const emptyField = () => ({
  key: '',
  label: '',
  type: 'text',
  required: false,
  options: '',
  placeholder: '',
  helpText: '',
});

const emptyForm = {
  name: '',
  code: '',
  category: 'PUBLIC_CAMP_REQUEST',
  description: '',
  isActive: true,
  fields: [emptyField()],
};

function toFormState(row) {
  return {
    name: row.name || '',
    code: row.code || '',
    category: row.category || 'OTHER',
    description: row.description || '',
    isActive: row.isActive !== false,
    fields: Array.isArray(row.fields) && row.fields.length
      ? row.fields.map((field) => ({
          key: field.key || '',
          label: field.label || '',
          type: field.type || 'text',
          required: Boolean(field.required),
          options: Array.isArray(field.options) ? field.options.join(', ') : String(field.options || ''),
          placeholder: field.placeholder || '',
          helpText: field.helpText || '',
        }))
      : [emptyField()],
  };
}

function categoryLabel(categories, id) {
  return categories.find((row) => row.id === id)?.label || id || '—';
}

export default function FormMasterPage({ embedded = false } = {}) {
  const { can } = useAuth();
  const canWrite = can('agreements:write') || can('*');
  const canDelete = can('*');

  const [rows, setRows] = useState([]);
  const [categories, setCategories] = useState(FALLBACK_CATEGORIES);
  const [fieldTypes, setFieldTypes] = useState(FALLBACK_FIELD_TYPES);
  const [templates, setTemplates] = useState([]);
  const [q, setQ] = useState('');
  const debouncedQ = useDebouncedValue(q, 250);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [removeTarget, setRemoveTarget] = useState(null);

  const loadMeta = useCallback(() => {
    api('/forms/meta')
      .then((res) => {
        if (res.data?.categories?.length) setCategories(res.data.categories);
        if (res.data?.fieldTypes?.length) setFieldTypes(res.data.fieldTypes);
        setTemplates(Array.isArray(res.data?.templates) ? res.data.templates : []);
      })
      .catch(() => {});
  }, []);

  const load = useCallback(() => {
    setError('');
    const params = new URLSearchParams({ all: 'true', limit: '200' });
    if (debouncedQ.trim()) params.set('q', debouncedQ.trim());
    if (categoryFilter) params.set('category', categoryFilter);
    return api(`/forms?${params}`)
      .then((res) => setRows(res.data || []))
      .catch((e) => setError(e.message));
  }, [debouncedQ, categoryFilter]);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditId(null);
  };

  const applyTemplate = (template) => {
    if (!template) return;
    setForm(toFormState(template));
    setEditId(null);
    setMsg(`Loaded “${template.name}” template. Review fields and save.`);
  };

  const updateField = (index, patch) => {
    setForm((prev) => ({
      ...prev,
      fields: prev.fields.map((field, i) => (i === index ? { ...field, ...patch } : field)),
    }));
  };

  const addField = () => {
    setForm((prev) => ({ ...prev, fields: [...prev.fields, emptyField()] }));
  };

  const removeField = (index) => {
    setForm((prev) => ({
      ...prev,
      fields: prev.fields.length <= 1 ? [emptyField()] : prev.fields.filter((_, i) => i !== index),
    }));
  };

  const moveField = (index, direction) => {
    setForm((prev) => {
      const next = [...prev.fields];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...prev, fields: next };
    });
  };

  const save = async (event) => {
    event.preventDefault();
    if (!canWrite) return;
    setBusy(true);
    setError('');
    setMsg('');
    try {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim(),
        category: form.category,
        description: form.description.trim(),
        isActive: form.isActive,
        fields: form.fields
          .filter((field) => field.label.trim())
          .map((field) => ({
            key: field.key.trim(),
            label: field.label.trim(),
            type: field.type,
            required: Boolean(field.required),
            options: field.options,
            placeholder: field.placeholder.trim(),
            helpText: field.helpText.trim(),
          })),
      };
      if (editId) {
        await api(`/forms/${editId}`, { method: 'PATCH', body: payload });
        setMsg('Form format updated.');
      } else {
        await api('/forms', { method: 'POST', body: payload });
        setMsg('Form format created.');
      }
      resetForm();
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (row) => {
    setEditId(row._id);
    setForm(toFormState(row));
    setMsg('');
    setError('');
  };

  const handleConfirmRemove = async () => {
    if (!removeTarget || !canDelete) return;
    const id = removeTarget._id;
    setRemoveTarget(null);
    setError('');
    try {
      await api(`/forms/${id}`, { method: 'DELETE' });
      setMsg('Form format deleted.');
      if (editId === id) resetForm();
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const publicCampTemplate = useMemo(
    () => templates.find((row) => row.category === 'PUBLIC_CAMP_REQUEST') || templates[0],
    [templates],
  );

  return (
    <div className={embedded ? '' : 'card'}>
      {!embedded ? <h3 style={{ marginTop: 0 }}>Form Master</h3> : null}
      <p className="muted" style={{ marginTop: 0 }}>
        Create reusable formats for Public Camp Request forms and other TYLO forms. Field layouts are stored here for reuse.
      </p>

      {(error || msg) && <FeedbackAlerts error={error} message={msg} />}

      <MasterFilterShell>
        <MasterSearchField
          value={q}
          onChange={setQ}
          placeholder="Search form name, code or description…"
        />
        <AdaptiveSelect
          aria-label="Filter by category"
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
        >
          <option value="">All categories</option>
          {categories.map((row) => (
            <option key={row.id} value={row.id}>
              {row.label}
            </option>
          ))}
        </AdaptiveSelect>
      </MasterFilterShell>

      {canWrite ? (
        <form className="stack" onSubmit={save} style={{ marginTop: 12, gap: 12 }}>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <strong>{editId ? 'Edit form format' : 'New form format'}</strong>
            {publicCampTemplate ? (
              <button
                type="button"
                className="btn secondary"
                onClick={() => applyTemplate(publicCampTemplate)}
              >
                Use Public Camp Request template
              </button>
            ) : null}
            {editId ? (
              <button type="button" className="btn secondary" onClick={resetForm}>
                Cancel edit
              </button>
            ) : null}
          </div>

          <div className="grid-2" style={{ gap: 10 }}>
            <label className="field">
              <span>Form name</span>
              <input
                required
                maxLength={120}
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Public Camp Request"
              />
            </label>
            <label className="field">
              <span>Code</span>
              <input
                required
                maxLength={60}
                value={form.code}
                onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
                placeholder="PUBLIC_CAMP_REQUEST"
              />
            </label>
            <label className="field">
              <span>Category</span>
              <AdaptiveSelect
                required
                value={form.category}
                onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
              >
                {categories.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.label}
                  </option>
                ))}
              </AdaptiveSelect>
            </label>
            <label className="field" style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
              <span className="sr-only">Active</span>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                />
                Active
              </label>
            </label>
          </div>

          <label className="field">
            <span>Description</span>
            <textarea
              rows={2}
              maxLength={500}
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Optional summary of when this format is used"
            />
          </label>

          <div className="stack" style={{ gap: 8 }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>Fields</strong>
              <button type="button" className="btn secondary" onClick={addField}>
                + Add field
              </button>
            </div>

            {form.fields.map((field, index) => (
              <div
                key={`field-${index}`}
                className="card"
                style={{ padding: 10, border: '1px solid var(--border-default)', background: 'var(--bg-muted)' }}
              >
                <div className="grid-2" style={{ gap: 8 }}>
                  <label className="field">
                    <span>Label</span>
                    <input
                      required
                      value={field.label}
                      onChange={(e) => updateField(index, { label: e.target.value })}
                      placeholder="Field label"
                    />
                  </label>
                  <label className="field">
                    <span>Key</span>
                    <input
                      value={field.key}
                      onChange={(e) => updateField(index, { key: e.target.value })}
                      placeholder="auto from label if blank"
                    />
                  </label>
                  <label className="field">
                    <span>Type</span>
                    <AdaptiveSelect
                      value={field.type}
                      onChange={(e) => updateField(index, { type: e.target.value })}
                    >
                      {fieldTypes.map((row) => (
                        <option key={row.id} value={row.id}>
                          {row.label}
                        </option>
                      ))}
                    </AdaptiveSelect>
                  </label>
                  <label className="field" style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <input
                        type="checkbox"
                        checked={field.required}
                        onChange={(e) => updateField(index, { required: e.target.checked })}
                      />
                      Required
                    </label>
                  </label>
                  {field.type === 'select' ? (
                    <label className="field" style={{ gridColumn: '1 / -1' }}>
                      <span>Dropdown options (comma separated)</span>
                      <input
                        value={field.options}
                        onChange={(e) => updateField(index, { options: e.target.value })}
                        placeholder="Option A, Option B"
                      />
                    </label>
                  ) : null}
                </div>
                <div className="row" style={{ gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                  <button type="button" className="btn secondary" onClick={() => moveField(index, -1)} disabled={index === 0}>
                    ↑
                  </button>
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={() => moveField(index, 1)}
                    disabled={index === form.fields.length - 1}
                  >
                    ↓
                  </button>
                  <button type="button" className="btn danger" onClick={() => removeField(index)}>
                    Remove field
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="row" style={{ gap: 8 }}>
            <button type="submit" className="btn" disabled={busy}>
              {busy ? 'Saving…' : editId ? 'Update format' : 'Save format'}
            </button>
          </div>
        </form>
      ) : (
        <p className="muted">You can view form formats. Write access requires Document One permissions.</p>
      )}

      <div style={{ marginTop: 18 }}>
        <strong>Saved formats</strong>
        {!rows.length ? (
          <p className="muted">No form formats yet.</p>
        ) : (
          <div className="table-wrap" style={{ marginTop: 8 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Code</th>
                  <th>Category</th>
                  <th>Fields</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row._id}>
                    <td>
                      <strong>{row.name}</strong>
                      {row.description ? <div className="muted">{row.description}</div> : null}
                    </td>
                    <td><code>{row.code}</code></td>
                    <td>{categoryLabel(categories, row.category)}</td>
                    <td>{Array.isArray(row.fields) ? row.fields.length : 0}</td>
                    <td>{row.isActive === false ? 'Inactive' : 'Active'}</td>
                    <td>
                      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                        {canWrite ? (
                          <button type="button" className="btn secondary" onClick={() => startEdit(row)}>
                            Edit
                          </button>
                        ) : null}
                        {canDelete ? (
                          <button type="button" className="btn danger" onClick={() => setRemoveTarget(row)}>
                            Delete
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(removeTarget)}
        title="Delete form format?"
        message={removeTarget ? `Delete “${removeTarget.name}”? This cannot be undone from the list.` : ''}
        confirmLabel="Delete"
        danger
        onCancel={() => setRemoveTarget(null)}
        onConfirm={handleConfirmRemove}
      />
    </div>
  );
}
