import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../shared/api.js';
import { useAuth } from '../../shared/auth.jsx';

const ENTITIES = [
  { id: 'uoms', label: 'UOM', path: '/logistics/uoms', fields: ['code', 'name'] },
  {
    id: 'categories',
    label: 'Product Category',
    path: '/logistics/categories',
    fields: ['code', 'name', 'description'],
  },
  {
    id: 'suppliers',
    label: 'Suppliers',
    path: '/logistics/suppliers',
    fields: ['code', 'name', 'contactName', 'email', 'phone', 'city', 'state'],
    fromContacts: true,
    partyType: 'Supplier',
  },
  {
    id: 'vendors',
    label: 'Vendors',
    path: '/logistics/vendors',
    fields: ['code', 'name', 'contactName', 'email', 'phone', 'city', 'state'],
    fromContacts: true,
    partyType: 'Vendor',
  },
  {
    id: 'products',
    label: 'Products',
    path: '/logistics/products',
    fields: [
      'code',
      'name',
      'productType',
      'programProject',
      'expiryApplicable',
      'trackingKind',
      'brand',
      'model',
      'sku',
      'partNumber',
      'defaultPerUnitCost',
      'defaultInvoiceAmount',
      'description',
    ],
  },
  { id: 'warehouses', label: 'Warehouses', path: '/logistics/warehouses', fields: ['code', 'name', 'city', 'state', 'address'] },
  {
    id: 'locations',
    label: 'Locations',
    path: '/logistics/locations',
    fields: ['code', 'name', 'level', 'warehouseId', 'parentId'],
  },
  {
    id: 'transporters',
    label: 'Transporters / Courier',
    path: '/logistics/transporters',
    fields: ['code', 'name', 'contactName', 'email', 'phone'],
  },
  { id: 'stock-statuses', label: 'Stock Statuses', path: '/logistics/stock-statuses', fields: ['code', 'name'] },
  {
    id: 'movement-types',
    label: 'Process / Movement Types',
    path: '/logistics/movement-types',
    fields: ['code', 'name', 'direction'],
  },
  { id: 'reason-codes', label: 'Reason Codes', path: '/logistics/reason-codes', fields: ['code', 'name'] },
];

const FIELD_LABELS = {
  code: 'Code',
  name: 'Name',
  description: 'Description',
  contactName: 'Contact name',
  email: 'Email',
  phone: 'Phone',
  city: 'City',
  state: 'State',
  address: 'Address',
  level: 'Level',
  warehouseId: 'Warehouse',
  parentId: 'Parent location',
  productType: 'Product type',
  programProject: 'Program / Project',
  expiryApplicable: 'Expiry applicable',
  trackingKind: 'Tracking',
  brand: 'Brand',
  model: 'Model',
  sku: 'SKU',
  partNumber: 'Part number',
  defaultPerUnitCost: 'Default unit cost',
  defaultInvoiceAmount: 'Default invoice amount',
  direction: 'Direction',
};

const PRODUCT_TYPES = [
  'Medical Device',
  'Non-Medical Device',
  'Consumable',
  'Spare Part / Accessory',
  'Document',
  'Miscellaneous',
];

const TRACKING_KINDS = ['None', 'Serial', 'Batch', 'Batch + Serial'];

const LOCATION_LEVELS = ['Zone', 'Room', 'Rack', 'Shelf', 'Bin'];

const emptyFor = (fields) =>
  Object.fromEntries(
    fields.map((f) => [
      f,
      f === 'direction'
        ? 'IN'
        : f === 'level'
          ? 'Zone'
          : f === 'productType'
            ? 'Medical Device'
            : f === 'trackingKind'
              ? 'Serial'
              : f === 'expiryApplicable'
                ? 'false'
                : '',
    ])
  );

function codeFromName(name) {
  const letters = String(name || '')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 6);
  return letters || 'PARTY';
}

export default function LogisticsMasterPage() {
  const { can } = useAuth();
  const canWrite = can('logistics:master') || can('logistics:write') || can('*');
  const [entityId, setEntityId] = useState('uoms');
  const entity = ENTITIES.find((e) => e.id === entityId) || ENTITIES[0];
  const [rows, setRows] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [contactPick, setContactPick] = useState('');
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(() => emptyFor(entity.fields));
  const [editingId, setEditingId] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const params = new URLSearchParams({ limit: '200' });
      if (q.trim()) params.set('q', q.trim());
      const res = await api(`${entity.path}?${params}`);
      setRows(res.data || []);
      if (entity.id === 'locations') {
        const wh = await api('/logistics/warehouses?limit=200');
        setWarehouses(wh.data || []);
      }
    } catch (e) {
      setError(e.message);
    }
  }, [entity.path, entity.id, q]);

  useEffect(() => {
    setForm(emptyFor(entity.fields));
    setEditingId('');
    setContactPick('');
    setMsg('');
    load();
  }, [entityId, load]);

  useEffect(() => {
    if (!entity.fromContacts) return;
    api('/contacts?limit=500')
      .then((res) => setContacts(res.data || []))
      .catch(() => setContacts([]));
  }, [entity.fromContacts, entityId]);

  const warehouseName = useMemo(() => {
    const map = Object.fromEntries(warehouses.map((w) => [w._id, w.name || w.code]));
    return (id) => map[id] || '—';
  }, [warehouses]);

  const contactOptions = useMemo(() => {
    if (!entity.fromContacts) return [];
    const want = entity.partyType;
    const typed = contacts.filter((c) => c.resourceType === want);
    const rest = contacts.filter((c) => c.resourceType !== want);
    return [...typed, ...rest];
  }, [contacts, entity.fromContacts, entity.partyType]);

  const startEdit = (row) => {
    setEditingId(row._id);
    const next = emptyFor(entity.fields);
    for (const f of entity.fields) next[f] = row[f] ?? '';
    setForm(next);
    setContactPick(row.contactId || '');
    setMsg('');
    setError('');
  };

  const cancelEdit = () => {
    setEditingId('');
    setContactPick('');
    setForm(emptyFor(entity.fields));
  };

  const applyContact = (contactId) => {
    setContactPick(contactId);
    if (!contactId) return;
    const c = contacts.find((x) => x._id === contactId);
    if (!c) return;
    setForm((f) => ({
      ...f,
      code: f.code || codeFromName(c.name),
      name: c.name || f.name,
      contactName: c.name || '',
      email: c.email || '',
      phone: c.contact || c.mobile || '',
      city: c.city || '',
      state: c.state || '',
    }));
  };

  const addFromContact = async () => {
    if (!canWrite || !contactPick || !entity.fromContacts) return;
    const c = contacts.find((x) => x._id === contactPick);
    if (!c) {
      setError('Select a contact from Contact Directory.');
      return;
    }
    setBusy(true);
    setError('');
    setMsg('');
    try {
      await api(entity.path, {
        method: 'POST',
        body: {
          code: codeFromName(c.name),
          name: c.name,
          contactId: c._id,
          contactName: c.name,
          email: c.email || '',
          phone: c.contact || c.mobile || '',
          city: c.city || '',
          state: c.state || '',
          isActive: true,
        },
      });
      setMsg(`${entity.partyType} added from Contact Directory.`);
      setContactPick('');
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    if (!canWrite) return;
    setBusy(true);
    setError('');
    setMsg('');
    try {
      const body = { ...form };
      if (entity.fromContacts && contactPick) body.contactId = contactPick;
      if (body.parentId === '') body.parentId = null;
      if (body.warehouseId === '') body.warehouseId = null;
      if (body.expiryApplicable === 'true' || body.expiryApplicable === true) {
        body.expiryApplicable = true;
      } else if (body.expiryApplicable === 'false' || body.expiryApplicable === false) {
        body.expiryApplicable = false;
      }
      if (body.defaultPerUnitCost !== undefined && body.defaultPerUnitCost !== '') {
        body.defaultPerUnitCost = Number(body.defaultPerUnitCost) || 0;
      }
      if (body.defaultInvoiceAmount !== undefined && body.defaultInvoiceAmount !== '') {
        body.defaultInvoiceAmount = Number(body.defaultInvoiceAmount) || 0;
      }
      if (editingId) {
        await api(`${entity.path}/${editingId}`, { method: 'PATCH', body });
        setMsg('Updated.');
      } else {
        await api(entity.path, { method: 'POST', body });
        setMsg('Created.');
      }
      cancelEdit();
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (row) => {
    if (!canWrite || row.isSystem) return;
    if (!window.confirm(`Delete “${row.name || row.code}”?`)) return;
    setError('');
    try {
      await api(`${entity.path}/${row._id}`, { method: 'DELETE' });
      setMsg('Deleted.');
      if (editingId === row._id) cancelEdit();
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="logistics-master">
      <p className="muted" style={{ marginTop: 0 }}>
        Inventory &amp; Vendor Master — UOM, product categories, suppliers, and vendors. Suppliers and vendors can also
        be added from Contact Directory.
      </p>
      <div className="logistics-entity-tabs" role="tablist">
        {ENTITIES.map((e) => (
          <button
            key={e.id}
            type="button"
            role="tab"
            className={`logistics-entity-tab${entityId === e.id ? ' is-active' : ''}`}
            aria-selected={entityId === e.id}
            onClick={() => setEntityId(e.id)}
          >
            {e.label}
          </button>
        ))}
      </div>

      {(error || msg) && (
        <div className={`am-banner ${error ? 'is-error' : 'is-info'}`} role="status">
          {error || msg}
        </div>
      )}

      {canWrite && entity.fromContacts && (
        <div className="card logistics-form" style={{ marginBottom: 16 }}>
          <h3 style={{ marginTop: 0 }}>Add from Contact Directory</h3>
          <p className="muted" style={{ marginTop: 0 }}>
            Pick a contact (preferably Resource Type = {entity.partyType}). Creates a master record linked to that
            contact.
          </p>
          <div className="logistics-form-grid">
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="lm-contact-pick">Contact</label>
              <select
                id="lm-contact-pick"
                value={contactPick}
                onChange={(e) => applyContact(e.target.value)}
              >
                <option value="">Select contact…</option>
                {contactOptions.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                    {c.resourceType ? ` · ${c.resourceType}` : ''}
                    {c.city ? ` · ${c.city}` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="logistics-form-actions">
            <button className="btn" type="button" disabled={busy || !contactPick || editingId} onClick={addFromContact}>
              {busy ? 'Adding…' : `Add as ${entity.partyType}`}
            </button>
          </div>
        </div>
      )}

      {canWrite && (
        <form className="card logistics-form" onSubmit={save}>
          <h3>{editingId ? `Edit ${entity.label}` : `New ${entity.label.replace(/s$/, '')}`}</h3>
          {entity.fromContacts && editingId ? (
            <div className="field" style={{ marginBottom: 12 }}>
              <label htmlFor="lm-contact-link">Linked contact</label>
              <select
                id="lm-contact-link"
                value={contactPick}
                onChange={(e) => applyContact(e.target.value)}
              >
                <option value="">None</option>
                {contactOptions.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                    {c.resourceType ? ` · ${c.resourceType}` : ''}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="logistics-form-grid">
            {entity.fields.map((field) => (
              <div className="field" key={field}>
                <label htmlFor={`lm-${field}`}>{FIELD_LABELS[field] || field}</label>
                {field === 'level' ? (
                  <select
                    id={`lm-${field}`}
                    required
                    value={form.level}
                    onChange={(e) => setForm({ ...form, level: e.target.value })}
                  >
                    {LOCATION_LEVELS.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                ) : field === 'direction' ? (
                  <select
                    id={`lm-${field}`}
                    value={form.direction}
                    onChange={(e) => setForm({ ...form, direction: e.target.value })}
                  >
                    <option value="IN">IN</option>
                    <option value="OUT">OUT</option>
                  </select>
                ) : field === 'productType' ? (
                  <select
                    id={`lm-${field}`}
                    required
                    value={form.productType}
                    onChange={(e) => setForm({ ...form, productType: e.target.value })}
                  >
                    {PRODUCT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                ) : field === 'trackingKind' ? (
                  <select
                    id={`lm-${field}`}
                    value={form.trackingKind}
                    onChange={(e) => setForm({ ...form, trackingKind: e.target.value })}
                  >
                    {TRACKING_KINDS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                ) : field === 'expiryApplicable' ? (
                  <select
                    id={`lm-${field}`}
                    value={String(form.expiryApplicable === true || form.expiryApplicable === 'true')}
                    onChange={(e) => setForm({ ...form, expiryApplicable: e.target.value })}
                  >
                    <option value="false">No</option>
                    <option value="true">Yes</option>
                  </select>
                ) : field === 'warehouseId' ? (
                  <select
                    id={`lm-${field}`}
                    required
                    value={form.warehouseId}
                    onChange={(e) => setForm({ ...form, warehouseId: e.target.value })}
                  >
                    <option value="">Select warehouse</option>
                    {warehouses.map((w) => (
                      <option key={w._id} value={w._id}>
                        {w.name} ({w.code})
                      </option>
                    ))}
                  </select>
                ) : field === 'parentId' ? (
                  <input
                    id={`lm-${field}`}
                    value={form.parentId}
                    onChange={(e) => setForm({ ...form, parentId: e.target.value })}
                    placeholder="Optional parent location id"
                  />
                ) : field === 'description' || field === 'address' ? (
                  <textarea
                    id={`lm-${field}`}
                    rows={2}
                    value={form[field]}
                    onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                  />
                ) : (
                  <input
                    id={`lm-${field}`}
                    required={field === 'name' || field === 'code'}
                    value={form[field]}
                    onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="logistics-form-actions">
            <button className="btn" type="submit" disabled={busy}>
              {busy ? 'Saving…' : editingId ? 'Save changes' : 'Add'}
            </button>
            {editingId ? (
              <button className="btn secondary" type="button" onClick={cancelEdit}>
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      )}

      <div className="inv-toolbar logistics-toolbar">
        <input
          className="esign-search inv-search"
          placeholder={`Search ${entity.label.toLowerCase()}…`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load()}
        />
        <button className="btn secondary" type="button" onClick={load}>
          Search
        </button>
      </div>

      <div className="card table-wrap" style={{ padding: 0 }}>
        <table className="inv-table">
          <thead>
            <tr>
              {entity.fields.map((f) => (
                <th key={f}>{FIELD_LABELS[f] || f}</th>
              ))}
              <th className="inv-col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row._id}>
                {entity.fields.map((f) => (
                  <td key={f}>
                    {f === 'warehouseId'
                      ? warehouseName(row.warehouseId)
                      : row[f] == null || row[f] === ''
                        ? '—'
                        : String(row[f])}
                  </td>
                ))}
                <td className="inv-col-actions">
                  <div className="inv-row-actions">
                    {canWrite && (
                      <button type="button" className="inv-link" onClick={() => startEdit(row)}>
                        Edit
                      </button>
                    )}
                    {canWrite && !row.isSystem && (
                      <button type="button" className="inv-link" onClick={() => remove(row)}>
                        Delete
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={entity.fields.length + 1}>
                  <p className="muted" style={{ padding: 16, margin: 0 }}>
                    No records yet.
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
