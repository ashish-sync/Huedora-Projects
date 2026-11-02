import { useCallback, useEffect, useMemo, useState, lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FeedbackAlerts } from '../../components/ui/FeedbackBanner.jsx';
import AdaptiveSelect from '../../components/ui/AdaptiveSelect.jsx';
import PaginationBar from '../../components/ui/PaginationBar.jsx';
import { api } from '../../shared/api.js';
import { fetchContactsList } from '../../shared/contactsApi.js';
import { useDebouncedValue } from '../../shared/useDebouncedValue.js';
import { useAuth } from '../../shared/auth.jsx';
import MasterExcelToolbar from '../../components/masters/MasterExcelToolbar.jsx';
import MasterFilterShell from '../../components/masters/MasterFilterShell.jsx';
import MasterListHeader from '../../components/masters/MasterListHeader.jsx';
import MasterSearchField from '../../components/masters/MasterSearchField.jsx';
import { masterExcelFor } from '../masters/masterExcelConfig.js';
import { PRODUCT_TYPES } from '../../shared/productTypes.js';
import { INVENTORY_TRACKING_OPTIONS } from '../../shared/productMasterConfig.js';
import FilePicker from '../../components/ui/FilePicker.jsx';
import { validateUploadFile } from '../../shared/importErrors.js';
import { openUploadView } from '../../shared/uploadViewUrl.js';
import { vendorMasterApi } from '../finance/builder/vendorMasterApi.js';
import OtherAwareSelect from '../../components/ui/OtherAwareSelect.jsx';
import { usePicklistOptions } from '../../shared/usePicklistOptions.js';
import { SUPPLY_CATEGORIES } from '../agreements/contactPicklists.js';
import VendorMasterFormGrid from './VendorMasterFormGrid.jsx';
import MasterNavHeader from '../masters/MasterNavHeader.jsx';
import ConfirmDialog from '../../components/ui/ConfirmDialog.jsx';

const ProductMasterPage = lazy(() => import('./ProductMasterPage.jsx'));
const ExpenseMasterPage = lazy(() => import('./ExpenseMasterPage.jsx'));
const ContactDirectoryPage = lazy(() => import('../agreements/ContactDirectoryPage.jsx'));
const DocumentMasterPage = lazy(() => import('../agreements/DocumentMasterPage.jsx'));
const SignatureMasterPage = lazy(() => import('../agreements/SignatureMasterPage.jsx'));
const PicklistApprovalsPage = lazy(() => import('../masters/PicklistApprovalsPage.jsx'));
const LocationMasterPage = lazy(() => import('../locations/LocationMasterPage.jsx'));
const ClientMasterEmbeddedPage = lazy(() => import('../camps/ClientMasterEmbeddedPage.jsx'));

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
    id: 'finance-masters',
    label: 'Finance',
    scope: 'movement',
    entities: [
      {
        id: 'vendors',
        label: 'Vendor Master',
        path: '/logistics/vendors',
        partyType: 'Vendor',
        pdfUpload: true,
        fields: [
          'name',
          'supplyCategory',
          'contactName',
          'phone',
          'email',
          'address',
          'pinCode',
          'state',
          'stateCode',
          'gstin',
          'panCard',
          'ifscCode',
          'bankName',
          'accountNumber',
          'remarks',
        ],
        tableFields: ['name', 'contactName', 'phone', 'email', 'state', 'gstin', 'supplyCategory'],
      },
      {
        id: 'expense-categories',
        label: 'Expense Master',
        path: '/logistics/expense-categories',
        dedicated: 'expense-master',
        fields: [],
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
      { id: 'pin-codes', label: 'PIN Geography', embedded: 'pin-codes', fields: [] },
    ],
  },
];

function EmbeddedMaster({ kind }) {
  if (kind === 'contacts') return <ContactDirectoryPage embedded />;
  if (kind === 'templates') return <DocumentMasterPage embedded />;
  if (kind === 'signatures') return <SignatureMasterPage embedded />;
  if (kind === 'pin-codes') return <LocationMasterPage embedded />;
  if (kind === 'picklist-approvals') return <PicklistApprovalsPage embedded />;
  if (kind === 'client-masters') return <ClientMasterEmbeddedPage />;
  return null;
}

function MasterPane({ children }) {
  return <Suspense fallback={<p className="muted">Loading master…</p>}>{children}</Suspense>;
}

function entitySingular(label) {
  const map = {
    Products: 'Product',
    Suppliers: 'Supplier',
    Vendors: 'Vendor',
    'Suppliers & Vendors': 'Supplier / Vendor',
    'Expense Master': 'Expense',
    'Contact Directory': 'Contact',
    'Document Templates': 'Document Template',
    Signatures: 'Signature',
  };
  return map[label] || label;
}

const FIELD_LABELS = {
  code: 'Code',
  name: 'Legal Name',
  description: 'Description',
  contactName: 'Contact Name',
  email: 'Email Address',
  phone: 'Contact Number',
  city: 'City',
  state: 'State',
  pinCode: 'PIN Code',
  stateCode: 'State Code',
  gstin: 'GSTIN',
  panCard: 'PAN Card',
  ifscCode: 'IFSC Code',
  bankName: 'Bank Name',
  accountNumber: 'Account Number',
  remarks: 'Remark',
  supplyCategory: 'Supply Category',
  partyType: 'Type',
  address: 'Address',
  level: 'Level',
  warehouseId: 'Warehouse',
  parentId: 'Parent location',
  productType: 'Product type',
  programProject: 'Program / Project',
  expiryApplicable: 'Expiry applicable',
  trackingKind: 'Track Inventory By',
  brand: 'Brand',
  model: 'Model',
  sku: 'SKU',
  partNumber: 'Part number',
  defaultPerUnitCost: 'Default unit cost',
  defaultInvoiceAmount: 'Default invoice amount',
  direction: 'Direction',
  covers: 'Covers',
};

const LOCATION_LEVELS = ['Zone', 'Room', 'Rack', 'Shelf', 'Bin'];
const TEXTAREA_FIELDS = new Set(['description', 'address', 'covers']);

function isTextareaField(field) {
  return TEXTAREA_FIELDS.has(field);
}

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

function canonicalScope(raw) {
  const s = String(raw || '').toLowerCase();
  if (s === 'logistics') return 'movement';
  return s || 'all';
}

/** First entity id for a deep-link scope (nav itself always shows all groups). */
function defaultEntityForScope(scope) {
  const mapped = canonicalScope(scope);
  if (!mapped || mapped === 'all') return '';
  const group = MASTER_GROUPS.find((g) => g.scope === mapped);
  return group?.entities[0]?.id || '';
}

export default function LogisticsMasterPage({
  scope = 'all',
  title = 'Master One',
  description = 'Shared reference masters across Products, Finance, Document One, and Camp One.',
  initialEntity = '',
} = {}) {
  const { can } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const canWriteLogistics = can('logistics:master') || can('logistics:write') || can('*');
  const canDelete = can('*');
  const canWriteDocs = can('agreements:write') || can('*');
  const canReadDocs = can('agreements:read') || canWriteDocs;
  const canReadCamps = can('camps:read') || can('camps:request') || can('camps:approve') || can('*');
  const canWriteCamps = can('camps:request') || can('camps:approve') || can('*');
  const resolvedScope = canonicalScope(scope);
  // Hub grouping is navigation-only — always show every permitted Reference Data
  // section so switching Products ↔ Document One etc. never collapses the sidebar.
  const visibleGroups = useMemo(() => {
    return MASTER_GROUPS.filter((g) => {
      if (g.scope === 'document') return canReadDocs;
      if (g.scope === 'camp') return canReadCamps;
      if (g.scope === 'movement' || g.scope === 'logistics') {
        return canWriteLogistics || can('logistics:read') || can('finance:read') || can('*');
      }
      return canWriteLogistics || can('logistics:read') || can('*');
    });
  }, [can, canWriteLogistics, canReadDocs, canReadCamps]);
  const entities = useMemo(() => visibleGroups.flatMap((g) => g.entities), [visibleGroups]);
  const [entityId, setEntityId] = useState(
    () => initialEntity || defaultEntityForScope(scope) || 'products'
  );
  const entity = entities.find((e) => e.id === entityId) || entities[0];
  const activeGroup = visibleGroups.find((g) => g.entities.some((e) => e.id === entityId));
  const canWrite =
    activeGroup?.scope === 'document'
      ? canWriteDocs
      : activeGroup?.scope === 'camp'
        ? canWriteCamps
        : canWriteLogistics;

  const selectEntity = (id) => {
    setEntityId(id);
    const group = visibleGroups.find((g) => g.entities.some((e) => e.id === id));
    const nextScope = canonicalScope(group?.scope || resolvedScope);
    const next = new URLSearchParams(searchParams);
    if (nextScope && nextScope !== 'all') next.set('scope', nextScope);
    else next.delete('scope');
    if (id) next.set('entity', id);
    else next.delete('entity');
    setSearchParams(next, { replace: true });
  };
  const formFields = useMemo(
    () => (entity?.fields || []).filter((f) => f !== 'code' && f !== 'sku'),
    [entity?.fields]
  );
  const tableFields = entity?.tableFields || entity?.fields || [];
  const useCompactForm = formFields.length <= 3;
  const usePairFormLayout = useCompactForm && formFields.length === 2;
  const [rows, setRows] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [contactPick, setContactPick] = useState('');
  const [q, setQ] = useState('');
  const debouncedQ = useDebouncedValue(q, 300);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(() => emptyFor([]));
  const [editingId, setEditingId] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [listMeta, setListMeta] = useState({ page: 1, limit: 25, total: 0, pages: 0 });
  const [listLoading, setListLoading] = useState(false);
  const [deleteConfirmRow, setDeleteConfirmRow] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [partyWarningPending, setPartyWarningPending] = useState(null);
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfPickerKey, setPdfPickerKey] = useState(0);
  const editingRow = useMemo(
    () => (editingId ? rows.find((r) => r._id === editingId) : null),
    [editingId, rows]
  );
  const excelConfig = masterExcelFor(entityId);
  const { options: supplyCategoryOptions } = usePicklistOptions(
    'contact.supplyCategory',
    SUPPLY_CATEGORIES
  );

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
      if (debouncedQ.trim()) params.set('q', debouncedQ.trim());
      const res = await api(`${entity.path}?${params}`);
      setRows(res.data || []);
      setListMeta(res.meta || { page, limit, total: 0, pages: 0 });
    } catch (e) {
      setError(e.message);
    } finally {
      setListLoading(false);
    }
  }, [entity, debouncedQ, page, limit]);

  useEffect(() => {
    if (!entity) return;
    setForm(emptyFor(formFields));
    setEditingId('');
    setContactPick('');
    setPdfFile(null);
    setPdfPickerKey((n) => n + 1);
    setMsg('');
    setPage(1);
  }, [entityId, formFields, entity]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!entity?.fromContacts) return;
    fetchContactsList({ limit: 200 })
      .then((rows) => setContacts(rows))
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
    setPdfFile(null);
    setPdfPickerKey((n) => n + 1);
    setMsg('');
    setError('');
  };

  const cancelEdit = () => {
    setEditingId('');
    setContactPick('');
    setPdfFile(null);
    setPdfPickerKey((n) => n + 1);
    setForm(emptyFor(formFields));
  };

  const onVendorPdfPick = (e) => {
    const file = e.target.files?.[0] || null;
    if (!file) {
      setPdfFile(null);
      return;
    }
    const invalid = validateUploadFile(file, { acceptExt: ['.pdf'], label: 'PDF' });
    if (invalid) {
      setError(invalid);
      setPdfFile(null);
      setPdfPickerKey((n) => n + 1);
      return;
    }
    setError('');
    setPdfFile(file);
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
      address: c.address || f.address,
    }));
  };

  const addFromContact = async (bypassWarning = false) => {
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
    if (!bypassWarning && partyIsVendor && cat && !contactIsVendor) {
      setPartyWarningPending({ c, cat, activePartyType });
      return;
    }
    setPartyWarningPending(null);
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
          address: c.address || '',
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
      if (entity.id === 'vendors' && !String(body.supplyCategory || '').trim()) {
        setError('Supply Category is required');
        setBusy(false);
        return;
      }
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
      let savedId = editingId;
      if (editingId) {
        await api(`${entity.path}/${editingId}`, { method: 'PATCH', body });
        setMsg('Updated.');
      } else {
        const created = await api(entity.path, { method: 'POST', body });
        savedId = created?.data?._id || '';
        setMsg('Created.');
      }
      if (entity.pdfUpload && pdfFile && savedId) {
        try {
          await vendorMasterApi.uploadPdf(savedId, pdfFile);
        } catch (uploadErr) {
          setError(`Vendor saved, but the PDF could not be uploaded: ${uploadErr.message}`);
          cancelEdit();
          load();
          return;
        }
      }
      cancelEdit();
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = (row) => {
    if (!canDelete || row.isSystem) return;
    setDeleteConfirmRow(row);
  };

  const executeRemove = async () => {
    const row = deleteConfirmRow;
    if (!row) return;
    setError('');
    setDeleteBusy(true);
    try {
      await api(`${entity.path}/${row._id}`, { method: 'DELETE' });
      setMsg('Deleted.');
      if (editingId === row._id) cancelEdit();
      setDeleteConfirmRow(null);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div className="logistics-master master-one-workspace">
      {!entity ? (
        <p className="muted">No masters available in this module.</p>
      ) : (
        <div className="logistics-master-layout">
          <MasterNavHeader
            groups={visibleGroups}
            activeGroup={activeGroup}
            activeEntity={entity}
            onSelectEntity={selectEntity}
          />

          <div className="logistics-master-content">

          {entity.dedicated === 'expense-master' ? (
            <MasterPane>
              <ExpenseMasterPage />
            </MasterPane>
          ) : entity.dedicated ? (
            <MasterPane>
              <ProductMasterPage />
            </MasterPane>
          ) : entity.embedded ? (
            <MasterPane>
              <EmbeddedMaster kind={entity.embedded} />
            </MasterPane>
          ) : (
            <>
      {(error || msg) && <FeedbackAlerts error={error} message={msg} />}

      {canWrite && entity.fromContacts && (
        <div className="card logistics-form logistics-contact-pick-card">
          <h3>Add from Contact Directory</h3>
          <p className="muted logistics-contact-pick-lead">
            Pick a partner (preferably Resource Type = {activePartyType}). Creates a master record linked to that
            partner.
          </p>
          <div className="logistics-contact-pick">
            <div className="field logistics-contact-pick__type">
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
            <div className="field logistics-contact-pick__contact">
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
        <form
          className={`card logistics-form${useCompactForm ? ' logistics-form--compact' : ''}`}
          onSubmit={save}
        >
          {entity.id === 'vendors' ? (
            <div className="logistics-form-heading">
              <div className="logistics-form-heading__copy">
                <h3>
                  {editingId ? `Edit ${entitySingular(entity.label)}` : `New ${entitySingular(entity.label)}`}
                </h3>
                <p className="muted logistics-form-hint">
                  Used by Finance One Purchase Orders and vendor bills.
                </p>
              </div>
              <div className="logistics-form-actions logistics-form-actions--inline logistics-form-heading__actions">
                <button className="btn secondary" type="button" onClick={cancelEdit} disabled={busy}>
                  {editingId ? 'Cancel' : 'Close'}
                </button>
                <button className="btn" type="submit" disabled={busy}>
                  {busy ? 'Saving…' : 'Submit'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <h3>{editingId ? `Edit ${entitySingular(entity.label)}` : `New ${entitySingular(entity.label)}`}</h3>
              {editingId ? (
                <div className="logistics-form-grid logistics-form-grid--meta">
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
                  <p className="muted logistics-form-hint">
                    Assigned automatically and cannot be changed.
                  </p>
                </div>
              ) : (
                <p className="muted logistics-form-hint">
                  {entity.fields.includes('sku')
                    ? 'Code and SKU are assigned automatically on save.'
                    : 'Code is assigned automatically on save.'}
                </p>
              )}
            </>
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
          {entity.id === 'vendors' ? (
            <VendorMasterFormGrid
              form={form}
              setForm={setForm}
              supplyCategoryOptions={supplyCategoryOptions}
              vendorCode={editingRow?.code || ''}
              pdfPickerKey={pdfPickerKey}
              pdfFile={pdfFile}
              existingDocument={editingRow?.document || null}
              onPdfPick={onVendorPdfPick}
              onOpenDocument={
                editingRow?.document?.url
                  ? () =>
                      openUploadView(editingRow.document.url).catch((err) => setError(err.message))
                  : undefined
              }
              busy={busy}
            />
          ) : null}
          {entity.id !== 'vendors' ? (
          <div
            className={`logistics-form-grid${
              usePairFormLayout
                ? ' logistics-form-grid--pair logistics-form-grid--pair-actions'
                : useCompactForm
                  ? ' logistics-form-grid--stacked'
                  : ''
            }`}
          >
            {formFields.map((field) => (
              <div
                className={`field${
                  isTextareaField(field) && !useCompactForm ? ' logistics-form-field--full' : ''
                }${field === 'covers' ? ' logistics-form-field--covers' : ''}`}
                key={field}
              >
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
                    value={form.trackingKind || 'None'}
                    onChange={(e) => setForm({ ...form, trackingKind: e.target.value })}
                  >
                    {INVENTORY_TRACKING_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
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
                ) : field === 'supplyCategory' ? (
                  <OtherAwareSelect
                    id={`lm-${field}`}
                    required
                    picklistKey="contact.supplyCategory"
                    source="vendor-master"
                    options={supplyCategoryOptions}
                    value={form.supplyCategory || ''}
                    onChange={(e) => setForm({ ...form, supplyCategory: e.target.value })}
                  />
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
                ) : isTextareaField(field) ? (
                  <textarea
                    id={`lm-${field}`}
                    rows={field === 'covers' && usePairFormLayout ? 1 : field === 'covers' ? 3 : 2}
                    value={form[field]}
                    onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                  />
                ) : (
                  <input
                    id={`lm-${field}`}
                    required={field === 'name' || field === 'supplyCategory'}
                    value={form[field]}
                    onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                  />
                )}
              </div>
            ))}
            {entity.pdfUpload ? (
              <div className="field logistics-form-field--full">
                <label htmlFor="lm-vendor-pdf">Upload PDF</label>
                <FilePicker
                  key={pdfPickerKey}
                  id="lm-vendor-pdf"
                  accept=".pdf,application/pdf"
                  buttonLabel={pdfFile ? 'Replace PDF' : 'Browse PDF'}
                  emptyLabel="No PDF chosen"
                  disabled={busy}
                  onChange={onVendorPdfPick}
                />
                {editingRow?.document?.name || editingRow?.document?.url ? (
                  <p className="muted logistics-form-hint">
                    Current file: {editingRow.document.name || 'Vendor PDF'}
                    {' · '}
                    <button
                      type="button"
                      className="inv-link"
                      onClick={() =>
                        openUploadView(editingRow.document.url).catch((err) => setError(err.message))
                      }
                    >
                      View
                    </button>
                  </p>
                ) : (
                  <p className="muted logistics-form-hint">
                    Optional. PDF only — GST certificate, PAN, or vendor agreement.
                  </p>
                )}
              </div>
            ) : null}
            {usePairFormLayout ? (
              <div className="logistics-form-actions logistics-form-actions--inline">
                <button className="btn" type="submit" disabled={busy}>
                  {busy ? 'Saving…' : editingId ? 'Save changes' : 'Add'}
                </button>
                {editingId ? (
                  <button className="btn secondary" type="button" onClick={cancelEdit}>
                    Cancel
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
          ) : null}
          {!usePairFormLayout && entity.id !== 'vendors' ? (
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
          ) : null}
        </form>
      )}

      {entity.id === 'vendors' && !editingId && (
        <MasterListHeader
          title="Vendor Master"
          subtitle="Vendor profiles, billing addresses, GSTIN, and bank details."
        />
      )}

      <MasterFilterShell
        actions={
          <>
            {excelConfig ? (
              <MasterExcelToolbar
                {...excelConfig}
                canImport={canWrite}
                onImportComplete={() => load()}
                onError={(message) => setError(message)}
                compact
              />
            ) : null}
            <button className="btn secondary btn-compact" type="button" onClick={load} disabled={listLoading}>
              Refresh
            </button>
          </>
        }
      >
        <MasterSearchField
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load()}
          placeholder={`Search ${entity.label.toLowerCase()}…`}
          aria-label={`Search ${entity.label.toLowerCase()}`}
        />
      </MasterFilterShell>

      <div className="card card--flush table-wrap">
        <table className="inv-table">
          <thead>
            <tr>
              {tableFields.map((f) => (
                <th key={f}>{FIELD_LABELS[f] || f}</th>
              ))}
              {entity.pdfUpload ? <th>PDF</th> : null}
              <th className="inv-col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row._id}>
                {tableFields.map((f) => (
                  <td key={f}>
                    {f === 'warehouseId'
                      ? warehouseName(row.warehouseId)
                      : row[f] == null || row[f] === ''
                        ? '-'
                        : String(row[f])}
                  </td>
                ))}
                {entity.pdfUpload ? (
                  <td>
                    {row.document?.url ? (
                      <button
                        type="button"
                        className="inv-link"
                        onClick={() =>
                          openUploadView(row.document.url).catch((err) => setError(err.message))
                        }
                      >
                        {row.document.name || 'View PDF'}
                      </button>
                    ) : (
                      '-'
                    )}
                  </td>
                ) : null}
                <td className="inv-col-actions">
                  <div className="inv-row-actions">
                    {canWrite && (
                      <button type="button" className="inv-link" onClick={() => startEdit(row)}>
                        Edit
                      </button>
                    )}
                    {canDelete && !row.isSystem && (
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
                <td colSpan={tableFields.length + (entity.pdfUpload ? 1 : 0) + 1}>
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
      <ConfirmDialog
        open={Boolean(deleteConfirmRow)}
        title="Delete Record"
        message={`Delete “${deleteConfirmRow?.name || deleteConfirmRow?.code || 'this record'}”? This action cannot be undone.`}
        confirmLabel={deleteBusy ? 'Deleting…' : 'Delete'}
        confirmVariant="danger"
        busy={deleteBusy}
        onConfirm={executeRemove}
        onCancel={() => setDeleteConfirmRow(null)}
      />
      <ConfirmDialog
        open={Boolean(partyWarningPending)}
        title="Category Mismatch"
        message={`This contact is Category “${partyWarningPending?.cat}”, but you are adding a ${partyWarningPending?.activePartyType}. Do you want to continue?`}
        confirmLabel="Continue"
        confirmVariant="primary"
        onConfirm={() => addFromContact(true)}
        onCancel={() => setPartyWarningPending(null)}
      />
    </div>
  );
}
