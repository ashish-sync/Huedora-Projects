import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import FeedbackBanner from '../../components/ui/FeedbackBanner.jsx';
import { Link } from 'react-router-dom';
import { api, apiUrl } from '../../shared/api.js';
import { invalidateContactsCaches } from '../../shared/contactsApi.js';
import { openUploadView } from '../../shared/uploadViewUrl.js';
import { useDebouncedValue } from '../../shared/useDebouncedValue.js';
import { MODULE } from '../../shared/labels.js';
import { useAuth } from '../../shared/auth.jsx';
import MasterExcelToolbar from '../../components/masters/MasterExcelToolbar.jsx';
import MasterFilterShell from '../../components/masters/MasterFilterShell.jsx';
import MasterSearchField from '../../components/masters/MasterSearchField.jsx';
import MasterListHeader from '../../components/masters/MasterListHeader.jsx';
import ConfirmDialog from '../../components/ui/ConfirmDialog.jsx';
import { masterExcelFor } from '../masters/masterExcelConfig.js';
import PageShell from '../../components/ui/PageShell.jsx';
import AdaptiveSelect from '../../components/ui/AdaptiveSelect.jsx';
import OtherAwareSelect from '../../components/ui/OtherAwareSelect.jsx';
import LocationCascade from '../../components/ui/LocationCascade.jsx';
import PublicOlaAddressAutocomplete from '../camps/requestForm/PublicOlaAddressAutocomplete.jsx';
import { autocompleteOlaMaps } from '../../shared/olaMapsApi.js';
import PaginationBar from '../../components/ui/PaginationBar.jsx';
import FilePicker from '../../components/ui/FilePicker.jsx';
import { validateUploadFile } from '../../shared/importErrors.js';
import {
  CONTACT_KYC_ACCEPT_ATTR,
  CONTACT_KYC_ACCEPT_EXTENSIONS,
  CONTACT_KYC_HINT,
  CONTACT_KYC_MAX_BYTES,
} from './contactKycUpload.js';
import ServiceProviderProfile, { hydrateProviderEmployeesForForm } from './ServiceProviderProfile.jsx';
import { emailError, phoneError } from '../../shared/validation.js';
import { usePicklistOptions } from '../../shared/usePicklistOptions.js';
import {
  HCW_RESOURCE_TYPES,
  RESOURCE_TYPES,
  isHcwStaffResourceType,
  isServiceProviderContact,
  professionsForCategory,
  professionPicklistKey,
  resourceTypesForCategory,
} from './contactPicklists.js';

const DIRECTORY_CATEGORIES = ['Resource', 'Client', 'Healthcare Worker'];

const empty = {
  name: '',
  email: '',
  contactCategory: '',
  resourceType: '',
  serviceProviderContactId: '',
  profession: '',
  organization: '',
  supplyCategory: '',
  contact: '',
  city: '',
  state: '',
  district: '',
  pinCode: '',
  address: '',
  latitude: '',
  longitude: '',
  googlePlaceId: '',
  panNumber: '',
  ifscCode: '',
  bankName: '',
  accountNumber: '',
  passbookCopyUrl: '',
  panCardCopyUrl: '',
  stateId: '',
  districtId: '',
  cityId: '',
  /** Default Camp Payout amount when this HCW is assigned in Camp One. */
  campAmount: '',
  providerEmployees: [],
};

const CATEGORY_TABS = [
  { id: '', label: 'All Contacts' },
  { id: 'Healthcare Worker', label: 'Healthcare Workers', tone: 'tone-ok' },
  { id: 'Resource', label: 'Resources', tone: 'tone-info' },
  { id: 'Client', label: 'Clients', tone: 'tone-medical' },
];

export default function ContactDirectoryPage({ embedded = false } = {}) {
  const { can } = useAuth();
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const debouncedQ = useDebouncedValue(q, 300);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showAccountMask, setShowAccountMask] = useState(false);
  const initialFormRef = useRef(empty);
  const [error, setError] = useState('');
  const [importMsg, setImportMsg] = useState('');
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const excelConfig = masterExcelFor('contacts');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [listMeta, setListMeta] = useState({ page: 1, limit: 25, total: 0, pages: 0 });
  const [listLoading, setListLoading] = useState(false);
  const [serviceProviders, setServiceProviders] = useState([]);
  const [kycUploadBusy, setKycUploadBusy] = useState('');
  /** True after the user edits the embedded SP employee roster in this form session. */
  const [rosterTouched, setRosterTouched] = useState(false);
  const [editUpdatedAt, setEditUpdatedAt] = useState('');
  const [rosterSnapshot, setRosterSnapshot] = useState([]);
  /** Provider link present when the edit form was opened (for intentional unlink). */
  const [linkSnapshot, setLinkSnapshot] = useState('');
  const [pendingDestructiveLeave, setPendingDestructiveLeave] = useState(null);

  const loadServiceProviders = () => {
    api('/contacts?contactCategory=Healthcare Worker&resourceType=Service Provider&limit=500')
      .then((r) => setServiceProviders(r.data || []))
      .catch(() => setServiceProviders([]));
  };

  const isResource = form.contactCategory === 'Resource';
  const isHcw = form.contactCategory === 'Healthcare Worker';
  const isClient = form.contactCategory === 'Client';
  const isHcwStaff = isHcw && isHcwStaffResourceType(form.resourceType);
  const isHcwProvider = isHcw && form.resourceType === 'Service Provider';
  const showResourceType = isResource || isHcw;
  // Service Provider is the payout payee for linked staff: banking/KYC must be editable here.
  const showBankAndAddress = !isClient && Boolean(form.contactCategory);
  const professionKey = professionPicklistKey(form.contactCategory);
  const professionFallback = professionsForCategory(form.contactCategory);
  const categoryResourceTypes = resourceTypesForCategory(form.contactCategory);

  const { options: resourceTypeOptions } = usePicklistOptions(
    'contact.resourceType',
    RESOURCE_TYPES
  );
  const { options: hcwResourceTypeOptions } = usePicklistOptions(
    'contact.hcwResourceType',
    HCW_RESOURCE_TYPES
  );

  const resourceTypeChoices = useMemo(() => {
    const pool = isHcw ? hcwResourceTypeOptions : resourceTypeOptions;
    return pool.filter((o) => categoryResourceTypes.includes(o));
  }, [isHcw, hcwResourceTypeOptions, resourceTypeOptions, categoryResourceTypes]);

  const staffCountByProvider = useMemo(() => {
    const counts = {};
    for (const row of rows) {
      if (row.serviceProviderContactId) {
        const id = String(row.serviceProviderContactId);
        counts[id] = (counts[id] || 0) + 1;
      }
    }
    return counts;
  }, [rows]);

  const { options: professionOptions } = usePicklistOptions(professionKey, professionFallback);

  const load = useCallback(() => {
    setListLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (debouncedQ.trim()) params.set('q', debouncedQ.trim());
    if (categoryFilter) params.set('contactCategory', categoryFilter);
    return api(`/contacts?${params}`)
      .then((r) => {
        setRows(r.data || []);
        setListMeta(r.meta || { page, limit, total: 0, pages: 0 });
      })
      .catch((e) => setError(e.message))
      .finally(() => setListLoading(false));
  }, [page, limit, debouncedQ, categoryFilter]);

  const canWriteContacts = can('agreements:write');

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, categoryFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadServiceProviders();
  }, []);

  const isFormDirty = useCallback(() => {
    if (rosterTouched) return true;
    const initial = initialFormRef.current;
    const trackedKeys = [
      'name',
      'email',
      'contactCategory',
      'resourceType',
      'serviceProviderContactId',
      'profession',
      'organization',
      'supplyCategory',
      'contact',
      'address',
      'pinCode',
      'state',
      'district',
      'city',
      'panNumber',
      'ifscCode',
      'bankName',
      'accountNumber',
      'campAmount',
    ];
    return trackedKeys.some(
      (k) => String(form[k] ?? '').trim() !== String(initial[k] ?? '').trim(),
    );
  }, [form, rosterTouched]);

  const closeDrawer = useCallback(
    (force = false) => {
      if (busy) return;
      if (!force && isFormDirty()) {
        setConfirmDiscardOpen(true);
        return;
      }
      setIsDrawerOpen(false);
      setEditId(null);
      setForm(empty);
      initialFormRef.current = empty;
      setShowAccountMask(false);
      setRosterTouched(false);
      setEditUpdatedAt('');
      setRosterSnapshot([]);
      setLinkSnapshot('');
      setError('');
    },
    [busy, isFormDirty],
  );

  // Keyboard escape listener to close drawer safely
  useEffect(() => {
    if (!isDrawerOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape' && !busy) {
        closeDrawer(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isDrawerOpen, busy, closeDrawer]);

  const applyCategoryChange = (contactCategory, { clearRoster = false, resourceTypeOverride } = {}) => {
    const nextProfessions = professionsForCategory(contactCategory);
    setForm((f) => {
      const nextResourceType = resourceTypeOverride !== undefined
        ? resourceTypeOverride
        : contactCategory === 'Resource' && RESOURCE_TYPES.includes(f.resourceType)
          ? f.resourceType
          : contactCategory === 'Healthcare Worker' && HCW_RESOURCE_TYPES.includes(f.resourceType)
            ? f.resourceType
            : '';
      const nextIsProvider =
        contactCategory === 'Healthcare Worker' && nextResourceType === 'Service Provider';
      return {
        ...f,
        contactCategory,
        resourceType: nextResourceType,
        serviceProviderContactId:
          contactCategory === 'Healthcare Worker' && isHcwStaffResourceType(nextResourceType)
            ? f.serviceProviderContactId
            : '',
        providerEmployees: nextIsProvider
          ? (f.providerEmployees?.length ? f.providerEmployees : rosterSnapshot)
          : (clearRoster ? [] : (f.providerEmployees || rosterSnapshot || [])),
        organization: contactCategory === 'Client' ? f.organization : '',
        supplyCategory: '',
        profession: nextProfessions.includes(f.profession) ? f.profession : '',
        address: contactCategory === 'Client' ? '' : f.address,
        pinCode: contactCategory === 'Client' ? '' : f.pinCode,
        latitude: contactCategory === 'Client' ? '' : f.latitude,
        longitude: contactCategory === 'Client' ? '' : f.longitude,
        googlePlaceId: contactCategory === 'Client' ? '' : f.googlePlaceId,
        panNumber: contactCategory === 'Client' ? '' : f.panNumber,
        ifscCode: contactCategory === 'Client' ? '' : f.ifscCode,
        bankName: contactCategory === 'Client' ? '' : f.bankName,
        accountNumber: contactCategory === 'Client' ? '' : f.accountNumber,
        campAmount: contactCategory === 'Healthcare Worker' ? f.campAmount : '',
        clearProviderEmployees: clearRoster ? true : undefined,
      };
    });
    if (clearRoster) setRosterSnapshot([]);
  };

  const onCategoryChange = (contactCategory) => {
    const leavingProvider =
      isServiceProviderContact(form)
      && !(contactCategory === 'Healthcare Worker' && form.resourceType === 'Service Provider');
    const roster = form.providerEmployees?.length ? form.providerEmployees : rosterSnapshot;
    if (leavingProvider && Array.isArray(roster) && roster.length > 0) {
      setPendingDestructiveLeave({ kind: 'category', value: contactCategory });
      return;
    }
    applyCategoryChange(contactCategory);
  };

  const confirmLeaveProvider = (clearRoster) => {
    const pending = pendingDestructiveLeave;
    setPendingDestructiveLeave(null);
    if (!pending) return;
    if (pending.kind === 'category') {
      applyCategoryChange(pending.value, { clearRoster });
    } else if (pending.kind === 'resourceType') {
      applyCategoryChange(form.contactCategory, {
        clearRoster,
        resourceTypeOverride: pending.value,
      });
    }
  };

  const startCreate = () => {
    setEditId(null);
    setForm(empty);
    initialFormRef.current = empty;
    setShowAccountMask(false);
    setRosterTouched(false);
    setEditUpdatedAt('');
    setRosterSnapshot([]);
    setLinkSnapshot('');
    setError('');
    setIsDrawerOpen(true);
  };


  const save = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.contactCategory) {
      setError('Contact Category is required');
      return;
    }
    if (isResource && !form.resourceType) {
      setError('Resource Type is required for Resource contacts');
      return;
    }
    if (isHcw && !form.resourceType) {
      setError('Resource Type is required for Healthcare Worker contacts');
      return;
    }
    if (isClient && !String(form.organization || '').trim()) {
      setError('Organization Name is required for Client');
      return;
    }
    if (isHcwProvider) {
      if (!String(form.name || '').trim()) {
        setError('Provider name is required');
        return;
      }
      if (!String(form.contact || '').trim()) {
        setError('Provider mobile number is required');
        return;
      }
      if (!String(form.state || '').trim()) {
        setError('Provider state is required');
        return;
      }
      for (let i = 0; i < (form.providerEmployees || []).length; i += 1) {
        const emp = form.providerEmployees[i];
        if (!String(emp.name || '').trim()) {
          setError(`Employee ${i + 1}: name is required`);
          return;
        }
        const empPhoneErr = phoneError(emp.mobile);
        if (empPhoneErr) {
          setError(`Employee ${i + 1}: ${empPhoneErr}`);
          return;
        }
      }
    }
    const eErr = emailError(form.email);
    if (eErr) {
      setError(eErr);
      return;
    }
    const pErr = phoneError(form.contact);
    if (pErr) {
      setError(pErr);
      return;
    }
    if (!isHcwProvider && !String(form.email || '').trim() && !String(form.contact || '').trim()) {
      setError('Email or phone is required for a contact');
      return;
    }
    if (isHcwProvider && !String(form.contact || '').trim()) {
      setError('Provider mobile number is required');
      return;
    }
    setBusy(true);
    try {
      const body = { ...form };
      if (isClient) {
        body.address = '';
        body.pinCode = '';
        body.latitude = '';
        body.longitude = '';
        body.googlePlaceId = '';
        body.panNumber = '';
        body.ifscCode = '';
        body.bankName = '';
        body.accountNumber = '';
        body.campAmount = 0;
      }
      if (isHcwProvider) {
        body.campAmount = 0;
      } else if (isHcw) {
        const amount = Number(form.campAmount);
        body.campAmount = Number.isFinite(amount) && amount >= 0 ? amount : 0;
      } else {
        body.campAmount = 0;
      }
      if (!isResource && !isHcw) body.resourceType = '';
      if (isHcwProvider) {
        body.serviceProviderContactId = '';
        const employees = Array.isArray(form.providerEmployees) ? form.providerEmployees : [];
        if (editId && employees.length === 0 && !rosterTouched) {
          // Empty roster on edit without user edits: omit so PATCH cannot wipe persisted staff.
          delete body.providerEmployees;
        } else {
          body.providerEmployees = employees;
          if (editId && employees.length === 0 && rosterTouched) {
            body.clearProviderEmployees = true;
          }
        }
      } else {
        // Omit roster field so PATCH cannot wipe persisted employees with [].
        delete body.providerEmployees;
        if (form.clearProviderEmployees === true) {
          body.clearProviderEmployees = true;
          body.providerEmployees = [];
        }
      }
      if (!isClient) body.organization = '';
      body.supplyCategory = '';

      // PATCH: omit blank geo / SP-link so empty cascade resets cannot wipe persisted values.
      if (editId) {
        for (const key of ['city', 'state', 'district', 'pinCode', 'stateId', 'districtId', 'cityId']) {
          if (body[key] == null || String(body[key]).trim() === '') delete body[key];
        }
        const nextLink = String(body.serviceProviderContactId || '').trim();
        if (isHcwStaff) {
          if (!nextLink) {
            delete body.serviceProviderContactId;
            if (linkSnapshot) {
              body.clearServiceProviderContactId = true;
              body.serviceProviderContactId = '';
            }
          }
        } else {
          // Leaving Individual/Full-Time: clear stale provider link only when one existed.
          delete body.serviceProviderContactId;
          if (linkSnapshot) {
            body.clearServiceProviderContactId = true;
            body.serviceProviderContactId = '';
          }
        }
        if (editUpdatedAt) body.expectedUpdatedAt = editUpdatedAt;
        let saved;
        try {
          const res = await api(`/contacts/${editId}`, { method: 'PATCH', body });
          saved = res?.data;
        } catch (err) {
          // KYC/other writes bump updatedAt — refresh token and retry once (no second click).
          const stale = err?.code === 'STALE_UPDATE' || err?.status === 409;
          if (!stale) throw err;
          const fresh = await api(`/contacts/${editId}`);
          const row = fresh?.data;
          const nextToken = row?.updatedAt || '';
          if (!nextToken) throw err;
          setEditUpdatedAt(nextToken);
          body.expectedUpdatedAt = nextToken;
          const res = await api(`/contacts/${editId}`, { method: 'PATCH', body });
          saved = res?.data;
        }
        if (saved?.updatedAt) setEditUpdatedAt(saved.updatedAt);
      } else {
        if (!isHcwStaff) body.serviceProviderContactId = '';
        await api('/contacts', { method: 'POST', body });
      }
      invalidateContactsCaches();
      closeDrawer(true);
      load();
      loadServiceProviders();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  async function uploadKycDocument(docType, file) {
    if (!editId || !file) return;
    const pre = validateUploadFile(file, {
      maxBytes: CONTACT_KYC_MAX_BYTES,
      acceptExt: CONTACT_KYC_ACCEPT_EXTENSIONS,
      label: docType === 'passbook' ? 'Bank Account Proof' : 'PAN Card Copy',
    });
    if (pre) {
      setError(pre);
      return;
    }
    setKycUploadBusy(docType);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('docType', docType);
      const res = await api(`/contacts/${editId}/kyc-document`, { method: 'POST', body: formData });
      const contact = res.data || {};
      // KYC upload saves the contact and bumps updatedAt: keep the edit token in sync
      // or the next Save falsely fails with STALE_UPDATE.
      if (contact.updatedAt) setEditUpdatedAt(contact.updatedAt);
      setForm((current) => ({
        ...current,
        passbookCopyUrl: contact.passbookCopyUrl || '',
        panCardCopyUrl: contact.panCardCopyUrl || '',
      }));
      invalidateContactsCaches();
      load();
    } catch (err) {
      setError(err.message || 'Failed to upload document');
    } finally {
      setKycUploadBusy('');
    }
  }

  const startEdit = (c) => {
    let contactCategory = c.contactCategory || '';
    if (!contactCategory) {
      const rt = String(c.resourceType || '').trim().toLowerCase();
      if (rt === 'vendor' || rt === 'supplier') contactCategory = 'Vendor';
      else if (rt === 'client') contactCategory = 'Client';
      else if (c.resourceType) contactCategory = 'Resource';
    }
    const resourceType =
      contactCategory === 'Resource' || contactCategory === 'Healthcare Worker'
        ? c.resourceType || ''
        : '';
    setEditId(c._id);
    setRosterTouched(false);
    setEditUpdatedAt(c.updatedAt || '');
    const isProvider = contactCategory === 'Healthcare Worker' && resourceType === 'Service Provider';
    const employees = hydrateProviderEmployeesForForm(
      Array.isArray(c.providerEmployees) ? c.providerEmployees : [],
      isProvider ? c.campAmount : 0,
    );
    setRosterSnapshot(employees);
    setLinkSnapshot(String(c.serviceProviderContactId || '').trim());
    const initialValues = {
      name: c.name || '',
      email: c.email || '',
      contactCategory,
      resourceType,
      serviceProviderContactId: c.serviceProviderContactId || '',
      profession: c.profession || '',
      organization: c.organization || '',
      supplyCategory: c.supplyCategory || '',
      contact: c.contact || c.mobile || '',
      city: c.city || '',
      state: c.state || '',
      district: c.district || '',
      pinCode: c.pinCode || '',
      address: c.address || '',
      latitude: c.latitude || '',
      longitude: c.longitude || '',
      googlePlaceId: c.googlePlaceId || '',
      panNumber: c.panNumber || '',
      ifscCode: c.ifscCode || '',
      bankName: c.bankName || '',
      accountNumber: c.accountNumber || '',
      passbookCopyUrl: c.passbookCopyUrl || '',
      panCardCopyUrl: c.panCardCopyUrl || '',
      stateId: c.stateId || '',
      districtId: c.districtId || '',
      cityId: c.cityId || '',
      campAmount: isProvider
        ? ''
        : (c.campAmount != null && c.campAmount !== '' ? String(c.campAmount) : ''),
      providerEmployees: employees,
    };
    initialFormRef.current = initialValues;
    setShowAccountMask(false);
    setForm(initialValues);
    setError('');
    setIsDrawerOpen(true);
  };

  const getCategoryBadgeTone = (cat) => {
    if (cat === 'Healthcare Worker') return 'tone-ok';
    if (cat === 'Resource') return 'tone-info';
    if (cat === 'Client') return 'tone-medical';
    if (cat === 'Vendor') return 'tone-warn';
    return 'tone-neutral';
  };

  return (
    <PageShell
      hideChrome={embedded}
      breadcrumbs={
        embedded
          ? []
          : [
              { to: '/', label: MODULE.HOME },
              { to: '/master-one', label: MODULE.MASTER_DATA },
              { label: MODULE.CONTACT_DIRECTORY },
            ]
      }
      title={embedded ? undefined : MODULE.CONTACT_DIRECTORY}
      description={
        embedded
          ? undefined
          : 'Directory of healthcare workers, service providers, clients, and operational resources.'
      }
      actions={
        embedded || !can('agreements:write') ? null : (
          <Link className="btn" to="/document-one/new">
            + New document
          </Link>
        )
      }
      kpis={embedded ? [] : [{ label: 'Total Contacts', value: listMeta.total || rows.length }]}
    >
      {embedded && (
        <MasterListHeader
          title="Contact Directory"
          subtitle="Directory of healthcare workers, service providers, clients, and operational resources."
        />
      )}
      {error && (
        <FeedbackBanner variant="error">{error}</FeedbackBanner>
      )}
      {importMsg && (
        <FeedbackBanner variant="info">{importMsg}</FeedbackBanner>
      )}
      {pendingDestructiveLeave && (
        <FeedbackBanner variant="warning">
          <div className="cd-roster-confirm">
            <p>
              This Service Provider has {rosterSnapshot.length || form.providerEmployees?.length || 0}{' '}
              employee(s). Clear the roster before changing category or type, or cancel to keep them.
            </p>
            <div className="cd-roster-confirm-actions">
              <button type="button" className="btn secondary btn-compact" onClick={() => confirmLeaveProvider(true)}>
                Clear roster and continue
              </button>
              <button
                type="button"
                className="btn ghost btn-compact"
                onClick={() => setPendingDestructiveLeave(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </FeedbackBanner>
      )}

      <div className="cd-workspace">
        {/* Top Filter Shell & Actions */}
        <MasterFilterShell
          actions={
            <div className="cd-top-actions">
              {excelConfig ? (
                <MasterExcelToolbar
                  {...excelConfig}
                  canImport={canWriteContacts}
                  onImportComplete={(data) => {
                    setImportMsg(
                      `Imported: ${data.created} created · ${data.updated} updated · ${data.errorRows} errors`
                    );
                    invalidateContactsCaches();
                    load();
                  }}
                  onError={(message) => setError(message)}
                  compact
                />
              ) : null}
              <button
                className="btn secondary btn-compact"
                type="button"
                onClick={() => {
                  setPage(1);
                  load();
                }}
                title="Refresh contacts"
              >
                Refresh
              </button>
              {canWriteContacts && (
                <button
                  type="button"
                  className="btn btn-compact cd-add-btn"
                  onClick={startCreate}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  <span>Add contact</span>
                </button>
              )}
            </div>
          }
        >
          <div className="cd-filter-row">
            <MasterSearchField
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setPage(1);
                  load();
                }
              }}
              placeholder="Search by name, number, email, or provider employees…"
              aria-label="Search contacts by name, number, or email"
            />
            <div className="cd-category-tabs" role="tablist" aria-label="Filter contacts by category">
              {CATEGORY_TABS.map((tab) => {
                const isActive = categoryFilter === tab.id;
                return (
                  <button
                    key={tab.id || 'all'}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    className={`cd-cat-tab${isActive ? ' is-active' : ''}`}
                    onClick={() => {
                      setCategoryFilter(tab.id);
                      setPage(1);
                    }}
                  >
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </MasterFilterShell>

        {/* Full-Width Master Data Table */}
        <div className={`cd-table-card card card--flush${listLoading && rows.length ? ' is-loading' : ''}`}>
          <div className="table-wrap cd-table-wrap">
            <table className="inv-table cd-table">
              <thead>
                <tr>
                  <th style={{ minWidth: 200 }}>Contact Name</th>
                  <th>Category</th>
                  <th>Resource Type</th>
                  <th>Service Provider</th>
                  <th>Organization</th>
                  <th>Contact Details</th>
                  <th>Location</th>
                  <th className="cd-th-rate">Camp Rate</th>
                  <th className="inv-col-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => {
                  const resolvedCategory = c.contactCategory || (
                    ['Vendor', 'Supplier'].includes(c.resourceType)
                      ? 'Vendor'
                      : c.resourceType === 'Client'
                        ? 'Client'
                        : c.resourceType
                          ? 'Resource'
                          : '-'
                  );
                  const isProvider = isServiceProviderContact(c);
                  const staffCount = (c.providerEmployees || []).length + (staffCountByProvider[String(c._id)] || 0);

                  return (
                    <tr key={c._id} className={editId === c._id ? 'is-selected' : undefined}>
                      <td className="cd-col-name">
                        <strong className="cd-name">{c.name}</strong>
                        {c.profession ? (
                          <span className="cd-name-meta">{c.profession}</span>
                        ) : null}
                      </td>
                      <td className="cd-col-category">
                        <span className={`badge ${getCategoryBadgeTone(resolvedCategory)}`}>
                          {resolvedCategory}
                        </span>
                      </td>
                      <td className="cd-col-type">
                        {c.contactCategory === 'Resource' ||
                        c.contactCategory === 'Healthcare Worker' ||
                        (!c.contactCategory &&
                          c.resourceType &&
                          !['Vendor', 'Supplier', 'Client'].includes(c.resourceType))
                          ? c.resourceType || '-'
                          : '-'}
                      </td>
                      <td className="cd-col-provider">
                        {c.serviceProviderName ? (
                          <span className="cd-provider-link" title={`Agency: ${c.serviceProviderName}`}>
                            {c.serviceProviderName}
                          </span>
                        ) : isProvider ? (
                          <span className="badge tone-ok cd-staff-badge" title="Service Provider agency">
                            {staffCount} staff
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="cd-col-org">{c.organization || '-'}</td>
                      <td className="cd-col-contact">
                        {c.contact || c.mobile ? (
                          <span className="cd-phone">{c.contact || c.mobile}</span>
                        ) : null}
                        {c.email ? (
                          <span className="cd-email" title={c.email}>
                            {c.email}
                          </span>
                        ) : null}
                        {!c.contact && !c.mobile && !c.email ? '-' : null}
                      </td>
                      <td className="cd-col-location">
                        {[c.city || c.district, c.state].filter(Boolean).join(', ') || '-'}
                      </td>
                      <td className="cd-col-rate">
                        {c.campAmount != null && c.campAmount !== '' ? (
                          <span className="cd-rate-tag">₹{Number(c.campAmount).toLocaleString('en-IN')}</span>
                        ) : (
                          <span className="muted">-</span>
                        )}
                      </td>
                      <td className="inv-col-actions">
                        {canWriteContacts && (
                          <button
                            className="btn secondary btn-compact"
                            type="button"
                            onClick={() => startEdit(c)}
                            title={`Edit ${c.name}`}
                          >
                            Edit
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {listLoading && !rows.length && (
                  <tr>
                    <td colSpan={9}>
                      <div className="cd-loading-state">
                        <span className="spinner" aria-hidden="true" />
                        <span className="muted">Loading contacts…</span>
                      </div>
                    </td>
                  </tr>
                )}
                {!rows.length && !listLoading && (
                  <tr>
                    <td colSpan={9}>
                      <div className="cd-empty-state">
                        <div className="cd-empty-icon" aria-hidden="true">
                          <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1.75">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                          </svg>
                        </div>
                        <p className="cd-empty-title">
                          {q || categoryFilter ? 'No matching contacts found' : 'No contacts in directory'}
                        </p>
                        <p className="cd-empty-sub muted">
                          {q || categoryFilter
                            ? 'Try adjusting your search query or switching category tabs.'
                            : 'Get started by adding a new contact or importing records via Excel.'}
                        </p>
                        {canWriteContacts && (
                          <div className="cd-empty-actions">
                            {q || categoryFilter ? (
                              <button
                                type="button"
                                className="btn secondary btn-compact"
                                onClick={() => {
                                  setQ('');
                                  setCategoryFilter('');
                                  setPage(1);
                                }}
                              >
                                Clear filters
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="btn btn-compact"
                                onClick={startCreate}
                              >
                                + Add contact
                              </button>
                            )}
                          </div>
                        )}
                      </div>
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
        </div>

        {/* Enterprise Slide-Over Drawer for Create / Edit */}
        {isDrawerOpen && (
          <div
            className="cd-drawer-backdrop"
            onClick={closeDrawer}
            aria-hidden="true"
          />
        )}

        {isDrawerOpen && canWriteContacts && (
          <aside
            className={`cd-drawer${editId ? ' cd-drawer--editing' : ''}`}
            aria-label={editId ? 'Edit contact' : 'Create new contact'}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cd-drawer-heading"
          >
            <div className="cd-drawer-header">
              <div className="cd-drawer-header-copy">
                <span className="cd-drawer-kicker">
                  {editId ? 'Edit Directory Record' : 'New Directory Record'}
                </span>
                <h3 id="cd-drawer-heading" className="cd-drawer-title">
                  {editId ? form.name || 'Edit contact' : 'Add new contact'}
                </h3>
              </div>
              <button
                type="button"
                className="cd-drawer-close-btn"
                onClick={closeDrawer}
                aria-label="Close drawer"
                title="Close"
              >
                ×
              </button>
            </div>

            <form className="cd-drawer-form" onSubmit={save}>
              <div className="cd-drawer-scroll">
                {error && (
                  <div className="cd-drawer-error">
                    <FeedbackBanner variant="error">{error}</FeedbackBanner>
                  </div>
                )}

                {/* Section 1: Classification */}
                <section className="cd-form-section">
                  <div className="cd-form-section-head">
                    <span className="cd-form-section-num">1</span>
                    <h4 className="cd-section-title">Classification</h4>
                  </div>
                  <div className="cd-form-grid">
                    <div className={`cd-class-pair${showResourceType ? '' : ' cd-class-pair--single'}`}>
                      <div className="field">
                        <label>Contact Category *</label>
                        <AdaptiveSelect
                          required
                          value={form.contactCategory}
                          onChange={(e) => onCategoryChange(e.target.value)}
                        >
                          <option value="">Select category…</option>
                          {DIRECTORY_CATEGORIES.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </AdaptiveSelect>
                      </div>

                      {showResourceType && (
                        <div className="field">
                          <label>Resource Type *</label>
                          <OtherAwareSelect
                            id="contact-resource-type"
                            required
                            picklistKey={isHcw ? 'contact.hcwResourceType' : 'contact.resourceType'}
                            source="contact-directory"
                            options={resourceTypeChoices}
                            value={form.resourceType}
                            onChange={(e) => {
                              const nextType = e.target.value;
                              const leavingProvider =
                                form.resourceType === 'Service Provider'
                                && nextType !== 'Service Provider'
                                && (form.providerEmployees?.length || rosterSnapshot.length);
                              if (leavingProvider) {
                                setPendingDestructiveLeave({ kind: 'resourceType', value: nextType });
                                return;
                              }
                              setForm((f) => ({
                                ...f,
                                resourceType: nextType,
                                serviceProviderContactId: isHcwStaffResourceType(nextType)
                                  ? f.serviceProviderContactId
                                  : '',
                                providerEmployees:
                                  nextType === 'Service Provider'
                                    ? (f.providerEmployees?.length ? f.providerEmployees : rosterSnapshot)
                                    : [],
                              }));
                              if (nextType !== 'Service Provider') setRosterTouched(false);
                            }}
                          />
                        </div>
                      )}
                    </div>

                    {isHcwStaff && (
                      <div className="field cd-span-2">
                        <label>Service Provider Agency</label>
                        <AdaptiveSelect
                          value={form.serviceProviderContactId}
                          onChange={(e) =>
                            setForm({ ...form, serviceProviderContactId: e.target.value })
                          }
                        >
                          <option value="">None (direct engagement)</option>
                          {serviceProviders
                            .filter((p) => p._id !== editId)
                            .map((p) => (
                              <option key={p._id} value={p._id}>
                                {p.name}
                                {p.city ? ` · ${p.city}` : ''}
                              </option>
                            ))}
                        </AdaptiveSelect>
                        <p className="cd-form-hint">
                          Link this worker to a provider agency for camp assignments and billing roll-ups.
                        </p>
                      </div>
                    )}

                    {isClient && (
                      <div className="field cd-span-2">
                        <label>Organization Name *</label>
                        <input
                          required
                          value={form.organization}
                          onChange={(e) => setForm({ ...form, organization: e.target.value })}
                          placeholder="Client organization or company name"
                        />
                      </div>
                    )}

                    {form.contactCategory && !isHcwProvider ? (
                      <div className="field cd-span-2">
                        <label>Profession / Role</label>
                        <OtherAwareSelect
                          id="contact-profession"
                          picklistKey={professionKey}
                          source="contact-directory"
                          options={professionOptions}
                          value={form.profession}
                          onChange={(e) => setForm({ ...form, profession: e.target.value })}
                        />
                      </div>
                    ) : null}
                  </div>
                </section>

                {/* Section: Service Provider Profile & Employees */}
                {isHcwProvider ? (
                  <section className="cd-form-section">
                    <div className="cd-form-section-head">
                      <span className="cd-form-section-num">2</span>
                      <h4 className="cd-section-title">Provider Agency &amp; Employees</h4>
                    </div>
                    <ServiceProviderProfile
                      form={form}
                      disabled={busy}
                      professionOptions={professionOptions}
                      onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
                      onEmployeesChange={(providerEmployees) => {
                        setRosterTouched(true);
                        setForm((f) => ({ ...f, providerEmployees }));
                      }}
                    />
                  </section>
                ) : null}

                {/* Section 2: Identity (non-SP) */}
                {!isHcwProvider && (
                  <section className="cd-form-section">
                    <div className="cd-form-section-head">
                      <span className="cd-form-section-num">2</span>
                      <h4 className="cd-section-title">Identity &amp; Contact</h4>
                    </div>
                    <div className="cd-form-grid">
                      <div className="field cd-span-2">
                        <label>Full Name *</label>
                        <input
                          required
                          value={form.name}
                          onChange={(e) => setForm({ ...form, name: e.target.value })}
                          placeholder="Legal full name"
                        />
                      </div>
                      <div className="field">
                        <label>Email Address</label>
                        <input
                          type="email"
                          value={form.email}
                          onChange={(e) => setForm({ ...form, email: e.target.value })}
                          placeholder="name@example.com"
                        />
                      </div>
                      <div className="field">
                        <label>Mobile Contact</label>
                        <input
                          value={form.contact}
                          onChange={(e) => setForm({ ...form, contact: e.target.value })}
                          placeholder="10-digit mobile number"
                        />
                      </div>
                    </div>
                    <p className="cd-form-hint">At least one of Email or Mobile Contact is required.</p>
                  </section>
                )}

                {/* Section 3: Location (non-SP) */}
                {!isHcwProvider && (
                  <section className="cd-form-section">
                    <div className="cd-form-section-head">
                      <span className="cd-form-section-num">3</span>
                      <h4 className="cd-section-title">Location &amp; Payout Rate</h4>
                    </div>
                    <LocationCascade
                      value={form}
                      onChange={(loc) => setForm((f) => ({ ...f, ...loc }))}
                      showDistrict={false}
                      showPin={showBankAndAddress}
                      pinFirst={showBankAndAddress}
                      pinInputOnly={showBankAndAddress}
                      labels={{ state: 'State', city: 'City / District' }}
                      afterCity={isHcw ? (
                        <div className="field">
                          <label>Default Camp Payout Amount (₹)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            inputMode="decimal"
                            value={form.campAmount}
                            onChange={(e) => setForm({ ...form, campAmount: e.target.value })}
                            placeholder="Amount credited per completed camp"
                          />
                        </div>
                      ) : null}
                    />
                  </section>
                )}

                {/* Section 4: Address & Banking / KYC */}
                {showBankAndAddress && (
                  <section className="cd-form-section cd-form-section--last">
                    <div className="cd-form-section-head">
                      <span className="cd-form-section-num">{isHcwProvider ? '3' : '4'}</span>
                      <h4 className="cd-section-title">Address &amp; Banking (KYC)</h4>
                    </div>
                    <p className="cd-form-hint">
                      Street address only. Banking and KYC are required for automated Finance payouts.
                    </p>
                    <div className="cd-form-grid">
                      <div className="field cd-span-2">
                        <label>Street Address</label>
                        <PublicOlaAddressAutocomplete
                          value={form.address}
                          selectedPlaceId={form.googlePlaceId || ''}
                          lookup={{ autocomplete: autocompleteOlaMaps }}
                          placeholder="Search or enter physical street address"
                          onChange={(loc) => setForm((f) => ({
                            ...f,
                            address: loc.campAddress ?? f.address,
                            googlePlaceId: loc.googlePlaceId ?? '',
                            latitude: loc.latitude ?? '',
                            longitude: loc.longitude ?? '',
                            ...(loc.addressManualEntry === false && loc.pinCode
                              ? { pinCode: loc.pinCode }
                              : {}),
                          }))}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="cd-pan-number">PAN Number</label>
                        <input
                          id="cd-pan-number"
                          value={form.panNumber}
                          maxLength={10}
                          autoComplete="off"
                          spellCheck={false}
                          autoCapitalize="characters"
                          className="cd-input-mono cd-input-upper"
                          onChange={(e) => setForm({ ...form, panNumber: e.target.value.toUpperCase().trim() })}
                          placeholder="ABCDE1234F"
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="cd-ifsc-code">IFSC Code</label>
                        <input
                          id="cd-ifsc-code"
                          value={form.ifscCode}
                          maxLength={11}
                          autoComplete="off"
                          spellCheck={false}
                          autoCapitalize="characters"
                          className="cd-input-mono cd-input-upper"
                          onChange={(e) => setForm({ ...form, ifscCode: e.target.value.toUpperCase().trim() })}
                          placeholder="SBIN0001234"
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="cd-bank-name">Bank Name</label>
                        <input
                          id="cd-bank-name"
                          value={form.bankName}
                          autoComplete="off"
                          spellCheck={false}
                          onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                          placeholder="State Bank of India"
                        />
                      </div>
                      <div className="field">
                        <div className="cd-label-row">
                          <label htmlFor="cd-account-number">Account Number</label>
                          {form.accountNumber ? (
                            <button
                              type="button"
                              className="cd-mask-toggle-btn"
                              onClick={() => setShowAccountMask((m) => !m)}
                              title={showAccountMask ? 'Mask account digits' : 'Reveal account digits'}
                            >
                              {showAccountMask ? 'Mask' : 'Reveal'}
                            </button>
                          ) : null}
                        </div>
                        <input
                          id="cd-account-number"
                          type={showAccountMask ? 'text' : 'password'}
                          value={form.accountNumber}
                          autoComplete="off"
                          spellCheck={false}
                          inputMode="numeric"
                          className="cd-input-mono"
                          onChange={(e) => setForm({ ...form, accountNumber: e.target.value.replace(/\s+/g, '') })}
                          placeholder="Bank account number"
                        />
                      </div>
                      <div className="field cd-span-2">
                        <label>Bank Account Proof (Passbook / Cheque)</label>
                        {editId ? (
                          <div className="cd-upload-row">
                            <FilePicker
                              accept={CONTACT_KYC_ACCEPT_ATTR}
                              disabled={Boolean(kycUploadBusy)}
                              buttonLabel={kycUploadBusy === 'passbook' ? 'Uploading…' : 'Upload file'}
                              emptyLabel="No file chosen"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) uploadKycDocument('passbook', file);
                                e.target.value = '';
                              }}
                            />
                            {form.passbookCopyUrl ? (
                              <div className="cd-upload-preview">
                                <span className="cd-upload-ok">✓ Document attached</span>
                                <button
                                  type="button"
                                  className="cd-upload-link"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    openUploadView(form.passbookCopyUrl).catch((err) => setError(err.message));
                                  }}
                                >
                                  View proof
                                </button>
                              </div>
                            ) : (
                              <p className="cd-form-hint">{CONTACT_KYC_HINT}</p>
                            )}
                          </div>
                        ) : (
                          <p className="cd-form-hint">Save the contact record first, then attach bank account proof.</p>
                        )}
                      </div>
                      <div className="field cd-span-2">
                        <label>PAN Card Copy</label>
                        {editId ? (
                          <div className="cd-upload-row">
                            <FilePicker
                              accept={CONTACT_KYC_ACCEPT_ATTR}
                              disabled={Boolean(kycUploadBusy)}
                              buttonLabel={kycUploadBusy === 'pan_card' ? 'Uploading…' : 'Upload file'}
                              emptyLabel="No file chosen"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) uploadKycDocument('pan_card', file);
                                e.target.value = '';
                              }}
                            />
                            {form.panCardCopyUrl ? (
                              <div className="cd-upload-preview">
                                <span className="cd-upload-ok">✓ Document attached</span>
                                <button
                                  type="button"
                                  className="cd-upload-link"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    openUploadView(form.panCardCopyUrl).catch((err) => setError(err.message));
                                  }}
                                >
                                  View card
                                </button>
                              </div>
                            ) : (
                              <p className="cd-form-hint">{CONTACT_KYC_HINT}</p>
                            )}
                          </div>
                        ) : (
                          <p className="cd-form-hint">Save the contact record first, then attach PAN card copy.</p>
                        )}
                      </div>
                    </div>
                  </section>
                )}
              </div>

              {/* Sticky Drawer Footer */}
              <div className="cd-drawer-footer">
                <button
                  className="btn secondary btn-compact"
                  type="button"
                  onClick={closeDrawer}
                  disabled={busy}
                >
                  Cancel
                </button>
                <button className="btn btn-compact" type="submit" disabled={busy}>
                  {busy ? 'Saving…' : editId ? 'Save changes' : 'Add to directory'}
                </button>
              </div>
            </form>
          </aside>
        )}
      </div>
      <ConfirmDialog
        open={confirmDiscardOpen}
        title="Discard Unsaved Changes?"
        message="You have unsaved changes to this contact record. Are you sure you want to discard them?"
        confirmLabel="Discard changes"
        confirmVariant="danger"
        onConfirm={() => closeDrawer(true)}
        onCancel={() => setConfirmDiscardOpen(false)}
      />
    </PageShell>
  );
}
