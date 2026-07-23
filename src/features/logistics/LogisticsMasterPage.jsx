import { useCallback, useEffect, useMemo, useState } from 'react';
import AdaptiveSelect from '../../components/ui/AdaptiveSelect.jsx';
import PaginationBar from '../../components/ui/PaginationBar.jsx';
import { api } from '../../shared/api.js';
import { useAuth } from '../../shared/auth.jsx';
import ProductMasterPage from './ProductMasterPage.jsx';
import ContactDirectoryPage from '../agreements/ContactDirectoryPage.jsx';
import DocumentMasterPage from '../agreements/DocumentMasterPage.jsx';
import SignatureMasterPage from '../agreements/SignatureMasterPage.jsx';
import PicklistApprovalsPage from '../masters/PicklistApprovalsPage.jsx';
import LocationMasterPage from '../locations/LocationMasterPage.jsx';
import ClientMasterEmbeddedPage from '../camps/ClientMasterEmbeddedPage.jsx';
import MasterExcelToolbar from '../../components/masters/MasterExcelToolbar.jsx';
import { masterExcelFor } from '../masters/masterExcelConfig.js';

const MASTER_GROUPS = [
  {
    id: 'product-masters',
    label: 'Products',
    scope: 'inventory',
    entities: [
      {
        id: 'products',
        label: 'Products',
        path: '/logistics/products',
        dedicated: true,
        fields: [],
      },
    ],
  },
  {
    id: 'business-partners',
    label: 'Partners',
    scope: 'logistics',
    entities: [
      {
        id: 'parties',
        label: 'Suppliers & Vendors',
        path: '/logistics/parties',
        fields: [
          'partyType',
          'code',
          'name',
          'contactName',
          'email',
          'phone',
          'city',
          'state',
          'gstin',
          'panCard',
        ],
        fromContacts: true,
      },
    ],
  },
  {
    id: 'finance-masters',
    label: 'Finance',
    scope: 'logistics',
    entities: [
      {
        id: 'expense-categories',
        label: 'Expense Categories',
        path: '/logistics/expense-categories',
        fields: ['code', 'name', 'covers'],
      },
    ],
  },
  {
    id: 'document-masters',
    label: 'Document One',
    scope: 'document',
    entities: [
      { id: 'contacts', label: 'Contact Directory', embedded: 'contacts', fields: [] },
      { id: 'templates', label: 'Document Templates', embedded: 'templates', fields: [] },
      { id: 'signatures', label: 'Signatures', embedded: 'signatures', fields: [] },
      { id: 'pin-codes', label: 'Geography', embedded: 'pin-codes', fields: [] },
      {
        id: 'picklist-approvals',
        label: 'Picklist approvals',
        embedded: 'picklist-approvals',
        fields: [],
      },
    ],
  },
  {
    id: 'camp-masters',
    label: 'Camp One',
    scope: 'camp',
    entities: [
      {
        id: 'client-masters',
        label: 'Client Master',
        embedded: 'client-masters',
        fields: [],
      },
    ],
  },
];

function groupsForScope(scope) {
  if (!scope || scope === 'all') return MASTER_GROUPS;
  const mapped = scope === 'movement' ? 'logistics' : scope;
  return MASTER_GROUPS.filter((g) => g.scope === mapped);
}

function EmbeddedMaster({ kind }) {
  if (kind === 'contacts') return <ContactDirectoryPage embedded />;
  if (kind === 'templates') return <DocumentMasterPage embedded />;
  if (kind === 'signatures') return <SignatureMasterPage embedded />;
  if (kind === 'pin-codes') return <LocationMasterPage embedded />;
  if (kind === 'picklist-approvals') return <PicklistApprovalsPage embedded />;
  if (kind === 'client-masters') return <ClientMasterEmbeddedPage />;
  return null;
}

function entitySingular(label) {
  const map = {
    Products: 'Product',
    Suppliers: 'Supplier',
    Vendors: 'Vendor',
    'Suppliers & Vendors': 'Supplier / Vendor',
    'Expense Categories': 'Expense Category',
    'Contact Directory': 'Contact',
    'Document Templates': 'Document Template',
    Signatures: 'Signature',
  };
  return map[label] || label;
}

const FIELD_LABELS = {
  code: 'Code',
  name: 'Name',
  description: 'Description',
  contactName: 'Contact name',
  email: 'Email',
  phone: 'Phone',
  city: 'City',
  state: 'State',
  gstin: 'GSTIN',
  panCard: 'PAN Card',
  partyType: 'Type',
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
  covers: 'Covers',
};

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

const TRACKING_KINDS = ['None', 'Serial', 'Batch', 'Batch + Serial'];

const LOCATION_LEVELS = ['Zone', 'Room', 'Rack', 'Shelf', 'Bin'];

function emptyFor(fields) {
  return Object.fromEntries(
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
                : f === 'partyType'
                  ? 'Supplier'
                  : '',
    ])
  );
}

export default function LogisticsMasterPage({
  scope = 'logistics',
  title = 'Master One',
  description = 'Business partners, process types, and expense categories.',
  initialEntity = '',
} = {}) {
  const { can } = useAuth();
  const canWriteLogistics = can('logistics:master') || can('logistics:write') || can('*');
  const canWriteDocs = can('agreements:write') || can('*');
  const canReadDocs = can('agreements:read') || canWriteDocs;
  const canReadCamps = can('camps:read') || can('camps:request') || can('camps:approve') || can('*');
  const visibleGroups = useMemo(() => {
    const groups = groupsForScope(scope);
    return groups.filter((g) => {
      if (g.scope === 'document') return canReadDocs;
      if (g.scope === 'camp') return canReadCamps;
      return canWriteLogistics || can('logistics:read') || can('*');
    });
  }, [scope, can, canWriteLogistics, canReadDocs, canReadCamps]);
  const entities = useMemo(() => visibleGroups.flatMap((g) => g.entities), [visibleGroups]);
  const [entityId, setEntityId] = useState(
    () => initialEntity || entities[0]?.id || 'parties'
  );
  const entity = entities.find((e) => e.id === entityId) || entities[0];
  const activeGroup = visibleGroups.find((g) => g.entities.some((e) => e.id === entityId));
  const canWrite =
    activeGroup?.scope === 'document'
      ? canWriteDocs
      : activeGroup?.scope === 'camp'
        ? canReadCamps
        : canWriteLogistics;
  const formFields = useMemo(
    () => (entity?.fields || []).filter((f) => f !== 'code' && f !== 'sku'),
    [entity?.fields]
  );
  const [rows, setRows] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [contactPick, setContactPick] = useState('');
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(() => emptyFor([]));
  const [editingId, setEditingId] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [listMeta, setListMeta] = useState({ page: 1, limit: 25, total: 0, pages: 0 });
  const [listLoading, setListLoading] = useState(false);
  const editingRow = useMemo(
    () => (editingId ? rows.find((r) => r._id === editingId) : null),
    [editingId, rows]
  );
  const excelConfig = masterExcelFor(entityId);

  useEffect(() => {
    if (initialEntity && entities.some((e) => e.id === initialEntity)) {
      setEntityId(initialEntity);
    }
  }, [initialEntity, entities]);

  useEffect(() => {
    if (!entities.some((e) => e.id === entityId)) {
      setEntityId(entities[0]?.id || '');
    }
  }, [entities, entityId]);

  const load = useCallback(async () => {
    if (!entity || entity.dedicated || entity.embedded) {
      setRows([]);
      setListMeta({ page: 1, limit, total: 0, pages: 0 });
      return;
    }
    setError('');
    setListLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (q.trim()) params.set('q', q.trim());
      const res = await api(`${entity.path}?${params}`);
      setRows(res.data || []);
      setListMeta(res.meta || { page, limit, total: 0, pages: 0 });
    } catch (e) {
      setError(e.message);
    } finally {
      setListLoading(false);
    }
  }, [entity?.path, entity?.id, entity?.dedicated, entity?.embedded, q, page, limit]);

  useEffect(() => {
    if (!entity) return;
    setForm(emptyFor(formFields));
    setEditingId('');
    setContactPick('');
    setMsg('');
    setPage(1);
  }, [entityId, formFields, entity]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!entity?.fromContacts) return;
    api('/contacts?limit=200')
      .then((res) => setContacts(res.data || []))
      .catch(() => setContacts([]));
  }, [entity?.fromContacts, entityId]);

  const warehouseName = useMemo(() => {
    const map = Object.fromEntries(warehouses.map((w) => [w._id, w.name || w.code]));
    return (id) => map[id] || '-';
  }, [warehouses]);

  const contactOptions = useMemo(() => {
    if (!entity?.fromContacts) return [];
    const want = form.partyType || entity.partyType || 'Supplier';
    const wantCat = want === 'Vendor' ? 'Vendor' : want === 'Supplier' ? 'Vendor' : '';
    const typed = contacts.filter((c) => {
      const cat = String(c.contactCategory || '').trim();
      if (wantCat && cat === 'Vendor') return true;
      if (wantCat && (c.resourceType === 'Vendor' || c.resourceType === 'Supplier')) return true;
      if (c.resourceType === want) return true;
      return false;
    });
    const rest = contacts.filter((c) => !typed.includes(c));
    return [...typed, ...rest];
  }, [contacts, entity?.fromContacts, entity?.partyType, form.partyType]);

  const activePartyType = form.partyType || entity?.partyType || 'Supplier';

  const startEdit = (row) => {
    setEditingId(row._id);
    const next = emptyFor(formFields);
    for (const f of formFields) next[f] = row[f] ?? '';
    if (row.expiryApplicable !== undefined) {
      next.expiryApplicable = row.expiryApplicable ? 'true' : 'false';
    }
    setForm(next);
    setContactPick(row.contactId || '');
    setMsg('');
    setError('');
  };

  const cancelEdit = () => {
    setEditingId('');
    setContactPick('');
    setForm(emptyFor(formFields));
  };

  const applyContact = (contactId) => {
    setContactPick(contactId);
    if (!contactId) return;
    const c = contacts.find((x) => x._id === contactId);
    if (!c) return;
    setForm((f) => ({
      ...f,
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
    const cat = String(c.contactCategory || '').trim();
    const partyIsVendor = activePartyType === 'Vendor' || activePartyType === 'Supplier';
    const contactIsVendor =
      cat === 'Vendor' || c.resourceType === 'Vendor' || c.resourceType === 'Supplier';
    if (partyIsVendor && cat && !contactIsVendor) {
      const ok = window.confirm(
        `This contact is Category “${cat}”, but you are adding a ${activePartyType}. Continue?`
      );
      if (!ok) return;
    }
    setBusy(true);
    setError('');
    setMsg('');
    try {
      await api(entity.path, {
        method: 'POST',
        body: {
          name: c.name,
          partyType: activePartyType,
          contactId: c._id,
          contactName: c.name,
          email: c.email || '',
          phone: c.contact || c.mobile || '',
          city: c.city || '',
          state: c.state || '',
          gstin: '',
          panCard: '',
          isActive: true,
        },
      });
      setMsg(`${activePartyType} added from Contact Directory.`);
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
      delete body.code;
      delete body.sku;
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
      {description ? (
        <p className="muted" style={{ marginTop: 0 }}>
          {description}
        </p>
      ) : null}

      {!entity ? (
        <p className="muted">No masters available in this module.</p>
      ) : (
      <div className="logistics-master-layout">
        <nav className="logistics-master-tree" aria-label={title}>
          <div className="logistics-master-tree-title">{title}</div>
          {visibleGroups.map((group) => (
            <div key={group.id} className="logistics-master-group">
              <div className="logistics-master-group-label">{group.label}</div>
              <ul className="logistics-master-group-list">
                {group.entities.map((e) => (
                  <li key={e.id}>
                    <button
                      type="button"
                      className={`logistics-master-item${entityId === e.id ? ' is-active' : ''}`}
                      aria-current={entityId === e.id ? 'page' : undefined}
                      onClick={() => setEntityId(e.id)}
                    >
                      {e.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="logistics-master-content">
          <div className="logistics-master-crumb muted">
            {activeGroup?.label}
            <span aria-hidden="true"> / </span>
            <span className="logistics-master-crumb-current">{entity.label}</span>
          </div>

          {entity.dedicated ? (
            <ProductMasterPage />
          ) : entity.embedded ? (
            <EmbeddedMaster kind={entity.embedded} />
          ) : (
            <>
      {(error || msg) && (
        <div className={`am-banner ${error ? 'is-error' : 'is-info'}`} role="status">
          {error || msg}
        </div>
      )}

      {canWrite && entity.fromContacts && (
        <div className="card logistics-form" style={{ marginBottom: 16 }}>
          <h3 style={{ marginTop: 0 }}>Add from Contact Directory</h3>
          <p className="muted" style={{ marginTop: 0 }}>
            Pick a partner (preferably Resource Type = {activePartyType}). Creates a master record linked to that
            partner.
          </p>
          <div className="logistics-form-grid">
            <div className="field">
              <label htmlFor="lm-party-type-pick">Type</label>
              <AdaptiveSelect
                id="lm-party-type-pick"
                value={form.partyType || 'Supplier'}
                onChange={(e) => setForm({ ...form, partyType: e.target.value })}
              >
                <option value="Supplier">Supplier</option>
                <option value="Vendor">Vendor</option>
              </AdaptiveSelect>
            </div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="lm-contact-pick">Contact</label>
              <AdaptiveSelect
                id="lm-contact-pick"
                value={contactPick}
                onChange={(e) => applyContact(e.target.value)}
              >
                <option value="">Select contact…</option>
                {contactOptions.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                    {c.contactCategory || c.resourceType
                      ? ` · ${c.contactCategory || c.resourceType}${
                          c.organization
                            ? ` · ${c.organization}`
                            : c.supplyCategory
                              ? ` · ${c.supplyCategory}`
                              : ''
                        }`
                      : ''}
                    {c.city ? ` · ${c.city}` : ''}
                  </option>
                ))}
              </AdaptiveSelect>
            </div>
          </div>
          <div className="logistics-form-actions">
            <button className="btn" type="button" disabled={busy || !contactPick || editingId} onClick={addFromContact}>
              {busy ? 'Adding…' : `Add as ${activePartyType}`}
            </button>
          </div>
        </div>
      )}

      {canWrite && (
        <form className="card logistics-form" onSubmit={save}>
          <h3>{editingId ? `Edit ${entitySingular(entity.label)}` : `New ${entitySingular(entity.label)}`}</h3>
          {editingId ? (
            <div className="logistics-form-grid" style={{ marginBottom: 12 }}>
              <div className="field">
                <label htmlFor="lm-code">Code</label>
                <input id="lm-code" value={editingRow?.code || ''} readOnly disabled />
              </div>
              {entity.fields.includes('sku') ? (
                <div className="field">
                  <label htmlFor="lm-sku">SKU</label>
                  <input id="lm-sku" value={editingRow?.sku || ''} readOnly disabled />
                </div>
              ) : null}
              <p className="muted" style={{ margin: 0, fontSize: '0.8rem', gridColumn: '1 / -1' }}>
                Assigned automatically and cannot be changed.
              </p>
            </div>
          ) : (
            <p className="muted" style={{ marginTop: 0 }}>
              {entity.fields.includes('sku')
                ? 'Code and SKU are assigned automatically on save.'
                : 'Code is assigned automatically on save.'}
            </p>
          )}
          {entity.fromContacts && editingId ? (
            <div className="field" style={{ marginBottom: 12 }}>
              <label htmlFor="lm-contact-link">Linked contact</label>
              <AdaptiveSelect
                id="lm-contact-link"
                value={contactPick}
                onChange={(e) => applyContact(e.target.value)}
              >
                <option value="">None</option>
                {contactOptions.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                    {c.contactCategory || c.resourceType
                      ? ` · ${c.contactCategory || c.resourceType}${
                          c.organization
                            ? ` · ${c.organization}`
                            : c.supplyCategory
                              ? ` · ${c.supplyCategory}`
                              : ''
                        }`
                      : ''}
                  </option>
                ))}
              </AdaptiveSelect>
            </div>
          ) : null}
          <div className="logistics-form-grid">
            {formFields.map((field) => (
              <div className="field" key={field}>
                <label htmlFor={`lm-${field}`}>{FIELD_LABELS[field] || field}</label>
                {field === 'level' ? (
                  <AdaptiveSelect
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
                  </AdaptiveSelect>
                ) : field === 'direction' ? (
                  <AdaptiveSelect
                    id={`lm-${field}`}
                    value={form.direction}
                    onChange={(e) => setForm({ ...form, direction: e.target.value })}
                  >
                    <option value="IN">IN</option>
                    <option value="OUT">OUT</option>
                  </AdaptiveSelect>
                ) : field === 'productType' ? (
                  <AdaptiveSelect
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
                  </AdaptiveSelect>
                ) : field === 'trackingKind' ? (
                  <AdaptiveSelect
                    id={`lm-${field}`}
                    value={form.trackingKind}
                    onChange={(e) => setForm({ ...form, trackingKind: e.target.value })}
                  >
                    {TRACKING_KINDS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </AdaptiveSelect>
                ) : field === 'expiryApplicable' ? (
                  <AdaptiveSelect
                    id={`lm-${field}`}
                    value={String(form.expiryApplicable === true || form.expiryApplicable === 'true')}
                    onChange={(e) => setForm({ ...form, expiryApplicable: e.target.value })}
                  >
                    <option value="false">No</option>
                    <option value="true">Yes</option>
                  </AdaptiveSelect>
                ) : field === 'partyType' ? (
                  <AdaptiveSelect
                    id={`lm-${field}`}
                    required
                    value={form.partyType || 'Supplier'}
                    onChange={(e) => setForm({ ...form, partyType: e.target.value })}
                  >
                    <option value="Supplier">Supplier</option>
                    <option value="Vendor">Vendor</option>
                  </AdaptiveSelect>
                ) : field === 'warehouseId' ? (
                  <AdaptiveSelect
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
                  </AdaptiveSelect>
                ) : field === 'parentId' ? (
                  <input
                    id={`lm-${field}`}
                    value={form.parentId}
                    onChange={(e) => setForm({ ...form, parentId: e.target.value })}
                    placeholder="Optional parent location id"
                  />
                ) : field === 'description' || field === 'address' || field === 'covers' ? (
                  <textarea
                    id={`lm-${field}`}
                    rows={2}
                    value={form[field]}
                    onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                  />
                ) : (
                  <input
                    id={`lm-${field}`}
                    required={field === 'name'}
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
        {excelConfig ? (
          <MasterExcelToolbar
            {...excelConfig}
            canImport={canWrite}
            onImportComplete={() => load()}
            onError={(message) => setError(message)}
            compact
          />
        ) : null}
      </div>

      <div className="card card--flush table-wrap">
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
                        ? '-'
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
            </>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
