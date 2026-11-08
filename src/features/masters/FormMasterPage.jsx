import { useCallback, useEffect, useMemo, useState } from 'react';
import { FeedbackAlerts } from '../../components/ui/FeedbackBanner.jsx';
import AdaptiveSelect from '../../components/ui/AdaptiveSelect.jsx';
import Button from '../../components/ui/Button.jsx';
import ConfirmDialog from '../../components/ui/ConfirmDialog.jsx';
import MasterFilterShell from '../../components/masters/MasterFilterShell.jsx';
import MasterSearchField from '../../components/masters/MasterSearchField.jsx';
import { api } from '../../shared/api.js';
import { useAuth } from '../../shared/auth.jsx';
import { useDebouncedValue } from '../../shared/useDebouncedValue.js';
import './formMaster.css';

const FALLBACK_CATEGORIES = [
  { id: 'PUBLIC_CAMP_REQUEST', label: 'Public Camp Request' },
  { id: 'INTERNAL', label: 'Internal' },
  { id: 'OTHER', label: 'Other' },
];

const FALLBACK_FIELD_TYPES = [
  { id: 'text', label: 'Text' },
  { id: 'textarea', label: 'Long text' },
  { id: 'number', label: 'Number' },
  { id: 'currency', label: 'Currency' },
  { id: 'date', label: 'Date' },
  { id: 'time', label: 'Time' },
  { id: 'phone', label: 'Phone' },
  { id: 'email', label: 'Email' },
  { id: 'url', label: 'URL' },
  { id: 'select', label: 'Dropdown' },
  { id: 'radio', label: 'Radio' },
  { id: 'checkbox', label: 'Checkbox' },
  { id: 'checkbox_group', label: 'Checkbox group' },
  { id: 'image', label: 'Image' },
  { id: 'gps_photo', label: 'GPS Photo' },
  { id: 'file', label: 'File (PDF, Excel, etc.)' },
];

const MEDIA_FIELD_TYPES = new Set(['image', 'gps_photo', 'file']);

function fileAcceptFromOptions(optionsText = '') {
  const exts = String(optionsText || '')
    .split(',')
    .map((part) => part.trim().replace(/^\./, '').toLowerCase())
    .filter(Boolean);
  if (!exts.length) {
    return '.pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.zip';
  }
  return exts.map((ext) => `.${ext}`).join(',');
}

const FALLBACK_WIDTHS = [
  { id: 'half', label: 'Half width' },
  { id: 'full', label: 'Full width' },
];

const FALLBACK_FORMATS = [
  { id: '', label: 'None' },
  { id: 'uppercase', label: 'Uppercase' },
  { id: 'lowercase', label: 'Lowercase' },
  { id: 'titlecase', label: 'Title case' },
  { id: 'digits', label: 'Digits only' },
  { id: 'phone-in', label: 'India phone' },
  { id: 'email', label: 'Email' },
  { id: 'url', label: 'URL' },
  { id: 'date-iso', label: 'Date (ISO)' },
  { id: 'time-24h', label: 'Time (24h)' },
];

const FALLBACK_OPERATORS = [
  { id: 'eq', label: 'Equals' },
  { id: 'neq', label: 'Does not equal' },
  { id: 'in', label: 'Is one of' },
  { id: 'contains', label: 'Contains' },
  { id: 'empty', label: 'Is empty' },
  { id: 'notEmpty', label: 'Is not empty' },
];

const emptyField = () => ({
  key: '',
  label: '',
  type: 'text',
  required: false,
  options: '',
  placeholder: '',
  helpText: '',
  section: '',
  width: 'half',
  min: '',
  max: '',
  minLength: '',
  maxLength: '',
  pattern: '',
  format: '',
  defaultValue: '',
  showWhenField: '',
  showWhenOperator: 'eq',
  showWhenValue: '',
});

const emptyForm = {
  name: '',
  code: '',
  category: 'PUBLIC_CAMP_REQUEST',
  description: '',
  isActive: true,
  fields: [emptyField()],
};

function slugFormCode(raw = '') {
  return String(raw || '')
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_')
    .toUpperCase();
}

function fieldToState(field = {}) {
  return {
    key: field.key || '',
    label: field.label || '',
    type: field.type || 'text',
    required: Boolean(field.required),
    options: Array.isArray(field.options) ? field.options.join(', ') : String(field.options || ''),
    placeholder: field.placeholder || '',
    helpText: field.helpText || '',
    section: field.section || '',
    width: field.width || 'half',
    min: field.min === null || field.min === undefined ? '' : String(field.min),
    max: field.max === null || field.max === undefined ? '' : String(field.max),
    minLength: field.minLength === null || field.minLength === undefined ? '' : String(field.minLength),
    maxLength: field.maxLength === null || field.maxLength === undefined ? '' : String(field.maxLength),
    pattern: field.pattern || '',
    format: field.format || '',
    defaultValue: field.defaultValue || '',
    showWhenField: field.showWhen?.field || '',
    showWhenOperator: field.showWhen?.operator || 'eq',
    showWhenValue: field.showWhen?.value || '',
  };
}

function toFormState(row) {
  return {
    name: row.name || '',
    code: row.code || '',
    category: row.category || 'OTHER',
    description: row.description || '',
    isActive: row.isActive !== false,
    fields: Array.isArray(row.fields) && row.fields.length
      ? row.fields.map(fieldToState)
      : [emptyField()],
  };
}

function fieldToPayload(field) {
  const showWhenField = String(field.showWhenField || '').trim();
  return {
    key: field.key.trim(),
    label: field.label.trim(),
    type: field.type,
    required: Boolean(field.required),
    options: field.options,
    placeholder: field.placeholder.trim(),
    helpText: field.helpText.trim(),
    section: field.section.trim(),
    width: field.width || 'half',
    min: field.min === '' ? null : field.min,
    max: field.max === '' ? null : field.max,
    minLength: field.minLength === '' ? null : field.minLength,
    maxLength: field.maxLength === '' ? null : field.maxLength,
    pattern: field.pattern.trim(),
    format: field.format || '',
    defaultValue: field.defaultValue.trim(),
    showWhen: showWhenField
      ? {
          field: showWhenField,
          operator: field.showWhenOperator || 'eq',
          value: field.showWhenValue.trim(),
        }
      : null,
  };
}

function categoryLabel(categories, id) {
  return categories.find((row) => row.id === id)?.label || id || '—';
}

function evaluateShowWhen(rule, values) {
  if (!rule?.field) return true;
  const current = String(values[rule.field] ?? '').trim();
  const expected = String(rule.value ?? '').trim();
  switch (rule.operator) {
    case 'neq':
      return current !== expected;
    case 'in':
      return expected
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
        .includes(current);
    case 'contains':
      return current.toLowerCase().includes(expected.toLowerCase());
    case 'empty':
      return !current;
    case 'notEmpty':
      return Boolean(current);
    case 'eq':
    default:
      return current === expected;
  }
}

function previewInputType(type) {
  if (type === 'number' || type === 'currency') return 'number';
  if (type === 'date' || type === 'time' || type === 'email' || type === 'url' || type === 'phone') {
    return type === 'phone' ? 'tel' : type;
  }
  return 'text';
}

function FormLivePreview({ form, fieldTypes }) {
  const [values, setValues] = useState({});

  useEffect(() => {
    const next = {};
    for (const field of form.fields) {
      const key = field.key.trim() || field.label.trim();
      if (!key) continue;
      next[key] = field.defaultValue || (field.type === 'checkbox' ? false : '');
    }
    setValues(next);
  }, [form.fields]);

  const visibleFields = form.fields.filter((field) => {
    if (!field.label.trim()) return false;
    if (!field.showWhenField) return true;
    return evaluateShowWhen(
      {
        field: field.showWhenField,
        operator: field.showWhenOperator,
        value: field.showWhenValue,
      },
      values,
    );
  });

  const sections = useMemo(() => {
    const groups = [];
    const map = new Map();
    for (const field of visibleFields) {
      const section = field.section.trim() || 'Fields';
      if (!map.has(section)) {
        const entry = { title: section, fields: [] };
        map.set(section, entry);
        groups.push(entry);
      }
      map.get(section).fields.push(field);
    }
    return groups;
  }, [visibleFields]);

  const setValue = (key, value) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  if (!visibleFields.length) {
    return <p className="form-master-preview__empty">Add labeled fields to preview the form layout.</p>;
  }

  return (
    <div className="stack" style={{ gap: 0 }}>
      {sections.map((section) => (
        <div key={section.title} className="form-master-preview__section">
          <h5 className="form-master-preview__section-title">{section.title}</h5>
          <div className="form-master-preview__grid">
            {section.fields.map((field, index) => {
              const key = field.key.trim() || field.label.trim() || `preview-${index}`;
              const typeLabel = fieldTypes.find((row) => row.id === field.type)?.label || field.type;
              const value = values[key] ?? '';
              const needsOptions = field.type === 'select' || field.type === 'radio' || field.type === 'checkbox_group';
              const options = String(field.options || '')
                .split(',')
                .map((opt) => opt.trim())
                .filter(Boolean);
              const isMedia = MEDIA_FIELD_TYPES.has(field.type);

              return (
                <label
                  key={`${key}-${index}`}
                  className={`field${field.width === 'full' || field.type === 'textarea' || isMedia ? ' is-full' : ''}`}
                >
                  <span>
                    {field.label}
                    {field.required ? <span className="form-master-preview__req">*</span> : null}
                  </span>
                  {field.type === 'textarea' ? (
                    <textarea
                      rows={3}
                      value={value}
                      placeholder={field.placeholder || typeLabel}
                      onChange={(e) => setValue(key, e.target.value)}
                    />
                  ) : field.type === 'checkbox' ? (
                    <span className="form-master__check">
                      <input
                        type="checkbox"
                        checked={Boolean(value)}
                        onChange={(e) => setValue(key, e.target.checked)}
                      />
                      {field.placeholder || 'Yes'}
                    </span>
                  ) : field.type === 'select' ? (
                    <AdaptiveSelect value={value} onChange={(e) => setValue(key, e.target.value)}>
                      <option value="">Select…</option>
                      {options.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </AdaptiveSelect>
                  ) : field.type === 'radio' ? (
                    <div className="stack" style={{ gap: 6 }}>
                      {options.map((opt) => (
                        <label key={opt} className="form-master__check">
                          <input
                            type="radio"
                            name={`preview-${key}`}
                            checked={value === opt}
                            onChange={() => setValue(key, opt)}
                          />
                          {opt}
                        </label>
                      ))}
                    </div>
                  ) : field.type === 'checkbox_group' ? (
                    <div className="stack" style={{ gap: 6 }}>
                      {options.map((opt) => {
                        const selected = String(value || '')
                          .split(',')
                          .map((part) => part.trim())
                          .filter(Boolean);
                        const checked = selected.includes(opt);
                        return (
                          <label key={opt} className="form-master__check">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                const next = checked
                                  ? selected.filter((item) => item !== opt)
                                  : [...selected, opt];
                                setValue(key, next.join(', '));
                              }}
                            />
                            {opt}
                          </label>
                        );
                      })}
                    </div>
                  ) : field.type === 'image' ? (
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setValue(key, e.target.files?.[0]?.name || '')}
                    />
                  ) : field.type === 'gps_photo' ? (
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => setValue(key, e.target.files?.[0]?.name || '')}
                    />
                  ) : field.type === 'file' ? (
                    <input
                      type="file"
                      accept={fileAcceptFromOptions(field.options)}
                      onChange={(e) => setValue(key, e.target.files?.[0]?.name || '')}
                    />
                  ) : (
                    <input
                      type={previewInputType(field.type)}
                      value={value}
                      placeholder={field.placeholder || typeLabel}
                      min={field.min || undefined}
                      max={field.max || undefined}
                      minLength={field.minLength || undefined}
                      maxLength={field.maxLength || undefined}
                      pattern={field.pattern || undefined}
                      onChange={(e) => setValue(key, e.target.value)}
                    />
                  )}
                  {field.helpText ? <p className="form-master-preview__help">{field.helpText}</p> : null}
                  {field.type === 'gps_photo' && !field.helpText ? (
                    <p className="form-master-preview__help">Captures a photo with device GPS location when available.</p>
                  ) : null}
                  {field.type === 'file' ? (
                    <p className="form-master-preview__help">
                      {options.length
                        ? `Allowed: ${options.map((ext) => ext.replace(/^\./, '').toUpperCase()).join(', ')}`
                        : 'Allowed: PDF, Word, Excel, CSV, PowerPoint, ZIP'}
                    </p>
                  ) : null}
                  {needsOptions && !options.length ? (
                    <p className="form-master-preview__help">Add options for this {typeLabel.toLowerCase()}.</p>
                  ) : null}
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function FormMasterPage({ embedded = false } = {}) {
  const { can } = useAuth();
  const canWrite = can('agreements:write') || can('*');
  const canDelete = can('*');

  const [rows, setRows] = useState([]);
  const [categories, setCategories] = useState(FALLBACK_CATEGORIES);
  const [fieldTypes, setFieldTypes] = useState(FALLBACK_FIELD_TYPES);
  const [fieldWidths, setFieldWidths] = useState(FALLBACK_WIDTHS);
  const [fieldFormats, setFieldFormats] = useState(FALLBACK_FORMATS);
  const [showOperators, setShowOperators] = useState(FALLBACK_OPERATORS);
  const [templates, setTemplates] = useState([]);
  const [q, setQ] = useState('');
  const debouncedQ = useDebouncedValue(q, 250);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [codeManual, setCodeManual] = useState(false);
  const [removeTarget, setRemoveTarget] = useState(null);

  const loadMeta = useCallback(() => {
    api('/forms/meta')
      .then((res) => {
        if (res.data?.categories?.length) setCategories(res.data.categories);
        if (res.data?.fieldTypes?.length) setFieldTypes(res.data.fieldTypes);
        if (res.data?.fieldWidths?.length) setFieldWidths(res.data.fieldWidths);
        if (res.data?.fieldFormats?.length) setFieldFormats(res.data.fieldFormats);
        if (res.data?.showOperators?.length) setShowOperators(res.data.showOperators);
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
    setCodeManual(false);
  };

  const applyTemplate = (template) => {
    if (!template) return;
    setForm(toFormState(template));
    setEditId(null);
    setCodeManual(Boolean(template.code));
    setMsg(`Loaded “${template.name}” template. Review fields and save.`);
  };

  const updateFormName = (name) => {
    setForm((prev) => ({
      ...prev,
      name,
      code: !editId && !codeManual ? slugFormCode(name) : prev.code,
    }));
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
        fields: form.fields.filter((field) => field.label.trim()).map(fieldToPayload),
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
    setCodeManual(true);
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

  const fieldKeyOptions = useMemo(
    () => form.fields
      .map((field) => field.key.trim() || field.label.trim())
      .filter(Boolean),
    [form.fields],
  );

  return (
    <div className={`form-master${embedded ? '' : ' card'}`}>
      {!embedded ? <h3 style={{ marginTop: 0 }}>Form Master</h3> : null}
      <p className="form-master__intro">
        Build a form format, then attach it under Client Master → Program Configuration.
      </p>

      {(error || msg) && <FeedbackAlerts error={error} message={msg} />}

      <MasterFilterShell>
        <MasterSearchField
          value={q}
          onChange={setQ}
          placeholder="Search form name or code…"
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
        <form className="form-master__panel" onSubmit={save}>
          <div className="form-master__panel-head">
            <h4 className="form-master__panel-title">
              {editId ? 'Edit form format' : 'New form format'}
            </h4>
            <div className="form-master__actions">
              {publicCampTemplate ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="compact"
                  onClick={() => applyTemplate(publicCampTemplate)}
                >
                  Use Public Camp Request template
                </Button>
              ) : null}
              {editId ? (
                <Button type="button" variant="secondary" size="compact" onClick={resetForm}>
                  Cancel edit
                </Button>
              ) : null}
            </div>
          </div>

          <div className="form-master__meta-grid">
            <label className="field">
              <span>Form name</span>
              <input
                required
                maxLength={120}
                value={form.name}
                onChange={(e) => updateFormName(e.target.value)}
                placeholder="e.g. Public Camp Request"
              />
            </label>
            <label className="field">
              <span>Code</span>
              <input
                required
                maxLength={60}
                value={form.code}
                onChange={(e) => {
                  setCodeManual(true);
                  setForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }));
                }}
                placeholder="AUTO_FROM_NAME"
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
            <label className="field form-master__meta-status">
              <span>Status</span>
              <span className="form-master__check">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                />
                Active
              </span>
            </label>
          </div>

          <div className="form-master__layout" style={{ marginTop: 16 }}>
            <div className="form-master__fields">
              <div className="form-master__panel-head" style={{ marginBottom: 0 }}>
                <h4 className="form-master__panel-title">Fields</h4>
                <Button type="button" variant="secondary" size="compact" onClick={addField}>
                  + Add field
                </Button>
              </div>

              {form.fields.map((field, index) => {
                const needsOptions = field.type === 'select'
                  || field.type === 'radio'
                  || field.type === 'checkbox_group';
                const isFileType = field.type === 'file';
                const numericType = field.type === 'number' || field.type === 'currency';

                return (
                  <div key={`field-${index}`} className="form-master-field">
                    <div className="form-master-field__head">
                      <span className="form-master-field__index">Field {index + 1}</span>
                      <div className="form-master-field__tools">
                        <Button
                          type="button"
                          variant="secondary"
                          size="compact"
                          onClick={() => moveField(index, -1)}
                          disabled={index === 0}
                          aria-label="Move field up"
                        >
                          ↑
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="compact"
                          onClick={() => moveField(index, 1)}
                          disabled={index === form.fields.length - 1}
                          aria-label="Move field down"
                        >
                          ↓
                        </Button>
                        <Button
                          type="button"
                          variant="danger"
                          size="compact"
                          onClick={() => removeField(index)}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>

                    <div className="form-master-field__essentials">
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
                        <span>Type</span>
                        <AdaptiveSelect
                          value={field.type}
                          onChange={(e) => {
                            const nextType = e.target.value;
                            updateField(index, {
                              type: nextType,
                              ...(MEDIA_FIELD_TYPES.has(nextType) && field.width !== 'full'
                                ? { width: 'full' }
                                : {}),
                              ...(nextType === 'file' && !String(field.options || '').trim()
                                ? { options: 'pdf, xlsx, xls, csv, docx' }
                                : {}),
                            });
                          }}
                        >
                          {fieldTypes.map((row) => (
                            <option key={row.id} value={row.id}>{row.label}</option>
                          ))}
                        </AdaptiveSelect>
                      </label>
                      <label className="field">
                        <span>Section</span>
                        <input
                          value={field.section}
                          onChange={(e) => updateField(index, { section: e.target.value })}
                          placeholder="Doctor, Schedule…"
                        />
                      </label>
                      <label className="field">
                        <span>Width</span>
                        <AdaptiveSelect
                          value={field.width}
                          onChange={(e) => updateField(index, { width: e.target.value })}
                        >
                          {fieldWidths.map((row) => (
                            <option key={row.id} value={row.id}>{row.label}</option>
                          ))}
                        </AdaptiveSelect>
                      </label>
                      <label className="field form-master-field__required">
                        <span>Required</span>
                        <span className="form-master__check">
                          <input
                            type="checkbox"
                            checked={field.required}
                            onChange={(e) => updateField(index, { required: e.target.checked })}
                          />
                          Yes
                        </span>
                      </label>
                    </div>

                    {needsOptions ? (
                      <label className="field" style={{ marginTop: 8, marginBottom: 0 }}>
                        <span>Options (comma separated)</span>
                        <input
                          value={field.options}
                          onChange={(e) => updateField(index, { options: e.target.value })}
                          placeholder="Option A, Option B"
                        />
                      </label>
                    ) : null}
                    {isFileType ? (
                      <label className="field" style={{ marginTop: 8, marginBottom: 0 }}>
                        <span>Allowed extensions</span>
                        <input
                          value={field.options}
                          onChange={(e) => updateField(index, { options: e.target.value })}
                          placeholder="pdf, xlsx, xls, csv, docx"
                        />
                      </label>
                    ) : null}
                    {field.type === 'gps_photo' ? (
                      <p className="form-master-field__hint">Camera photo with GPS when the device allows it.</p>
                    ) : null}
                    {field.type === 'image' ? (
                      <p className="form-master-field__hint">Accepts image uploads (JPG, PNG, WebP, etc.).</p>
                    ) : null}

                    <details className="form-master-field__more">
                      <summary>More options</summary>
                      <div className="form-master-field__more-body">
                        <div className="form-master-field__grid">
                          <label className="field">
                            <span>Key</span>
                            <input
                              value={field.key}
                              onChange={(e) => updateField(index, { key: e.target.value })}
                              placeholder="auto from label if blank"
                            />
                          </label>
                          <label className="field">
                            <span>Placeholder</span>
                            <input
                              value={field.placeholder}
                              onChange={(e) => updateField(index, { placeholder: e.target.value })}
                              placeholder="Hint inside the control"
                            />
                          </label>
                          <label className="field">
                            <span>Default value</span>
                            <input
                              value={field.defaultValue}
                              onChange={(e) => updateField(index, { defaultValue: e.target.value })}
                              placeholder="Optional default"
                            />
                          </label>
                          <label className="field">
                            <span>Help text</span>
                            <input
                              value={field.helpText}
                              onChange={(e) => updateField(index, { helpText: e.target.value })}
                              placeholder="Guidance under the field"
                            />
                          </label>
                        </div>

                        <div>
                          <p className="form-master-field__section-label">Validation</p>
                          <div className="form-master-field__grid">
                            {numericType || field.type === 'date' || field.type === 'time' ? (
                              <>
                                <label className="field">
                                  <span>Min</span>
                                  <input
                                    type={numericType ? 'number' : field.type}
                                    value={field.min}
                                    onChange={(e) => updateField(index, { min: e.target.value })}
                                  />
                                </label>
                                <label className="field">
                                  <span>Max</span>
                                  <input
                                    type={numericType ? 'number' : field.type}
                                    value={field.max}
                                    onChange={(e) => updateField(index, { max: e.target.value })}
                                  />
                                </label>
                              </>
                            ) : (
                              <>
                                <label className="field">
                                  <span>Min length</span>
                                  <input
                                    type="number"
                                    min="0"
                                    value={field.minLength}
                                    onChange={(e) => updateField(index, { minLength: e.target.value })}
                                  />
                                </label>
                                <label className="field">
                                  <span>Max length</span>
                                  <input
                                    type="number"
                                    min="0"
                                    value={field.maxLength}
                                    onChange={(e) => updateField(index, { maxLength: e.target.value })}
                                  />
                                </label>
                              </>
                            )}
                            <label className="field">
                              <span>Format</span>
                              <AdaptiveSelect
                                value={field.format}
                                onChange={(e) => updateField(index, { format: e.target.value })}
                              >
                                {fieldFormats.map((row) => (
                                  <option key={row.id || 'none'} value={row.id}>{row.label}</option>
                                ))}
                              </AdaptiveSelect>
                            </label>
                            <label className="field">
                              <span>Pattern (regex)</span>
                              <input
                                value={field.pattern}
                                onChange={(e) => updateField(index, { pattern: e.target.value })}
                                placeholder="e.g. ^[A-Z0-9]+$"
                              />
                            </label>
                          </div>
                        </div>

                        <div>
                          <p className="form-master-field__section-label">Show only when</p>
                          <div className="form-master-field__grid">
                            <label className="field">
                              <span>Field</span>
                              <AdaptiveSelect
                                value={field.showWhenField}
                                onChange={(e) => updateField(index, { showWhenField: e.target.value })}
                              >
                                <option value="">Always visible</option>
                                {fieldKeyOptions
                                  .filter((key) => key !== (field.key.trim() || field.label.trim()))
                                  .map((key) => (
                                    <option key={key} value={key}>{key}</option>
                                  ))}
                              </AdaptiveSelect>
                            </label>
                            <label className="field">
                              <span>Operator</span>
                              <AdaptiveSelect
                                value={field.showWhenOperator}
                                onChange={(e) => updateField(index, { showWhenOperator: e.target.value })}
                                disabled={!field.showWhenField}
                              >
                                {showOperators.map((row) => (
                                  <option key={row.id} value={row.id}>{row.label}</option>
                                ))}
                              </AdaptiveSelect>
                            </label>
                            <label className="field form-master__span-2">
                              <span>Value</span>
                              <input
                                value={field.showWhenValue}
                                onChange={(e) => updateField(index, { showWhenValue: e.target.value })}
                                disabled={!field.showWhenField || field.showWhenOperator === 'empty' || field.showWhenOperator === 'notEmpty'}
                                placeholder={field.showWhenOperator === 'in' ? 'A, B, C' : 'Compare value'}
                              />
                            </label>
                          </div>
                        </div>
                      </div>
                    </details>
                  </div>
                );
              })}
            </div>

            <aside className="form-master-preview" aria-label="Live form preview">
              <h4 className="form-master-preview__title">
                {form.name.trim() || 'Live preview'}
              </h4>
              <p className="form-master-preview__hint">
                Light-mode preview. Add a label and type to see each field here.
              </p>
              <FormLivePreview form={form} fieldTypes={fieldTypes} />
            </aside>
          </div>

          <div className="form-master__actions" style={{ marginTop: 16 }}>
            <Button type="submit" loading={busy} loadingText="Saving…">
              {editId ? 'Update format' : 'Save format'}
            </Button>
          </div>
        </form>
      ) : (
        <p className="muted">You can view form formats. Write access requires Document One permissions.</p>
      )}

      <div className="form-master__panel form-master-table-wrap">
        <h4 className="form-master__panel-title">Saved formats</h4>
        {!rows.length ? (
          <p className="muted">No form formats yet. Save a format, then attach it under Client Master → Program Configuration.</p>
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
                    </td>
                    <td><code>{row.code}</code></td>
                    <td>{categoryLabel(categories, row.category)}</td>
                    <td>{Array.isArray(row.fields) ? row.fields.length : 0}</td>
                    <td>{row.isActive === false ? 'Inactive' : 'Active'}</td>
                    <td>
                      <div className="form-master__actions">
                        {canWrite ? (
                          <Button type="button" variant="secondary" size="compact" onClick={() => startEdit(row)}>
                            Edit
                          </Button>
                        ) : null}
                        {canDelete ? (
                          <Button type="button" variant="danger" size="compact" onClick={() => setRemoveTarget(row)}>
                            Delete
                          </Button>
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
        message={removeTarget ? `Delete “${removeTarget.name}”? Programs using this format should be reassigned first.` : ''}
        confirmLabel="Delete"
        danger
        onCancel={() => setRemoveTarget(null)}
        onConfirm={handleConfirmRemove}
      />
    </div>
  );
}
