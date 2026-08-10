import { useEffect, useMemo, useState } from 'react';
import FeedbackBanner from '../../components/ui/FeedbackBanner.jsx';
import { Link } from 'react-router-dom';
import { api } from '../../shared/api.js';
import { MODULE } from '../../shared/labels.js';
import { useAuth } from '../../shared/auth.jsx';
import MasterExcelToolbar from '../../components/masters/MasterExcelToolbar.jsx';
import MasterFilterShell from '../../components/masters/MasterFilterShell.jsx';
import MasterSearchField from '../../components/masters/MasterSearchField.jsx';
import { masterExcelFor } from '../masters/masterExcelConfig.js';
import PageShell from '../../components/ui/PageShell.jsx';
import AdaptiveSelect from '../../components/ui/AdaptiveSelect.jsx';
import OtherAwareSelect from '../../components/ui/OtherAwareSelect.jsx';
import LocationCascade from '../../components/ui/LocationCascade.jsx';
import PaginationBar from '../../components/ui/PaginationBar.jsx';
import FilePicker from '../../components/ui/FilePicker.jsx';
import { validateUploadFile } from '../../shared/importErrors.js';
import {
  CONTACT_KYC_ACCEPT_ATTR,
  CONTACT_KYC_ACCEPT_EXTENSIONS,
  CONTACT_KYC_HINT,
  CONTACT_KYC_MAX_BYTES,
} from './contactKycUpload.js';
import ServiceProviderProfile from './ServiceProviderProfile.jsx';
import { emailError, phoneError } from '../../shared/validation.js';
import { usePicklistOptions } from '../../shared/usePicklistOptions.js';
import {
  CONTACT_CATEGORIES,
  HCW_RESOURCE_TYPES,
  RESOURCE_TYPES,
  SUPPLY_CATEGORIES,
  isHcwStaffResourceType,
  isServiceProviderContact,
  professionsForCategory,
  professionPicklistKey,
  resourceTypesForCategory,
} from './contactPicklists.js';

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
  panNumber: '',
  ifscCode: '',
  bankName: '',
  accountNumber: '',
  passbookCopyUrl: '',
  panCardCopyUrl: '',
  stateId: '',
  districtId: '',
  cityId: '',
  providerEmployees: [],
};

export default function ContactDirectoryPage({ embedded = false } = {}) {
  const { can } = useAuth();
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [importMsg, setImportMsg] = useState('');
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [busy, setBusy] = useState(false);
  const excelConfig = masterExcelFor('contacts');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [listMeta, setListMeta] = useState({ page: 1, limit: 25, total: 0, pages: 0 });
  const [listLoading, setListLoading] = useState(false);
  const [serviceProviders, setServiceProviders] = useState([]);
  const [kycUploadBusy, setKycUploadBusy] = useState('');

  const loadServiceProviders = () => {
    api('/contacts?contactCategory=Healthcare Worker&resourceType=Service Provider&limit=500')
      .then((r) => setServiceProviders(r.data || []))
      .catch(() => setServiceProviders([]));
  };

  const isResource = form.contactCategory === 'Resource';
  const isHcw = form.contactCategory === 'Healthcare Worker';
  const isClient = form.contactCategory === 'Client';
  const isVendor = form.contactCategory === 'Vendor';
  const isHcwStaff = isHcw && isHcwStaffResourceType(form.resourceType);
  const isHcwProvider = isHcw && form.resourceType === 'Service Provider';
  const showResourceType = isResource || isHcw;
  const showBankAndAddress = !isClient && !isHcwProvider && Boolean(form.contactCategory);
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
  const { options: supplyCategoryOptions } = usePicklistOptions(
    'contact.supplyCategory',
    SUPPLY_CATEGORIES
  );
  const { options: professionOptions } = usePicklistOptions(professionKey, professionFallback);

  const load = () => {
    setListLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (q.trim()) params.set('q', q.trim());
    return api(`/contacts?${params}`)
      .then((r) => {
        setRows(r.data);
        setListMeta(r.meta || { page, limit, total: 0, pages: 0 });
      })
      .catch((e) => setError(e.message))
      .finally(() => setListLoading(false));
  };

  const canWriteContacts = can('agreements:write');

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit]);

  useEffect(() => {
    loadServiceProviders();
  }, []);

  const onCategoryChange = (contactCategory) => {
    const nextProfessions = professionsForCategory(contactCategory);
    setForm((f) => {
      const nextResourceType =
        contactCategory === 'Resource' && RESOURCE_TYPES.includes(f.resourceType)
          ? f.resourceType
          : contactCategory === 'Healthcare Worker' && HCW_RESOURCE_TYPES.includes(f.resourceType)
            ? f.resourceType
            : '';
      return {
        ...f,
        contactCategory,
        resourceType: nextResourceType,
        serviceProviderContactId:
          contactCategory === 'Healthcare Worker' && isHcwStaffResourceType(nextResourceType)
            ? f.serviceProviderContactId
            : '',
        providerEmployees:
          contactCategory === 'Healthcare Worker' && nextResourceType === 'Service Provider'
            ? f.providerEmployees || []
            : [],
        organization: contactCategory === 'Client' ? f.organization : '',
      supplyCategory:
        contactCategory === 'Vendor' && SUPPLY_CATEGORIES.includes(f.supplyCategory)
          ? f.supplyCategory
          : '',
      profession: nextProfessions.includes(f.profession) ? f.profession : '',
      address: contactCategory === 'Client' ? '' : f.address,
      pinCode: contactCategory === 'Client' ? '' : f.pinCode,
      panNumber: contactCategory === 'Client' ? '' : f.panNumber,
      ifscCode: contactCategory === 'Client' ? '' : f.ifscCode,
      bankName: contactCategory === 'Client' ? '' : f.bankName,
      accountNumber: contactCategory === 'Client' ? '' : f.accountNumber,
      };
    });
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
    if (isVendor && !form.supplyCategory) {
      setError('Supply Category is required for Vendor');
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
        body.panNumber = '';
        body.ifscCode = '';
        body.bankName = '';
        body.accountNumber = '';
      }
      if (!isResource && !isHcw) body.resourceType = '';
      if (!isHcwStaff) body.serviceProviderContactId = '';
      if (!isHcwProvider) body.providerEmployees = [];
      else body.serviceProviderContactId = '';
      if (!isClient) body.organization = '';
      if (!isVendor) body.supplyCategory = '';

      if (editId) {
        await api(`/contacts/${editId}`, { method: 'PATCH', body });
      } else {
        await api('/contacts', { method: 'POST', body });
      }
      setForm(empty);
      setEditId(null);
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
      setForm((current) => ({
        ...current,
        passbookCopyUrl: contact.passbookCopyUrl || '',
        panCardCopyUrl: contact.panCardCopyUrl || '',
      }));
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
    setForm({
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
      panNumber: c.panNumber || '',
      ifscCode: c.ifscCode || '',
      bankName: c.bankName || '',
      accountNumber: c.accountNumber || '',
      passbookCopyUrl: c.passbookCopyUrl || '',
      panCardCopyUrl: c.panCardCopyUrl || '',
      stateId: c.stateId || '',
      districtId: c.districtId || '',
      cityId: c.cityId || '',
      providerEmployees: Array.isArray(c.providerEmployees) ? c.providerEmployees : [],
    });
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
          : 'Resources, clients, and vendors. Category controls which fields are required.'
      }
      actions={
        embedded || !can('agreements:write') ? null : (
          <Link className="btn" to="/document-one/new">
            + New document
          </Link>
        )
      }
      kpis={embedded ? [] : [{ label: 'Contacts', value: listMeta.total || rows.length }]}
    >
      {error && (
        <FeedbackBanner variant="error">{error}</FeedbackBanner>
      )}
      {importMsg && (
        <FeedbackBanner variant="info">{importMsg}</FeedbackBanner>
      )}

      <MasterFilterShell
        actions={
          <>
            {excelConfig ? (
              <MasterExcelToolbar
                {...excelConfig}
                canImport={canWriteContacts}
                onImportComplete={(data) => {
                  setImportMsg(
                    `Imported: ${data.created} created · ${data.updated} updated · ${data.errorRows} errors`
                  );
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
            >
              Refresh
            </button>
          </>
        }
      >
        <MasterSearchField
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load()}
          placeholder="Search name, email, category, organization, city…"
          aria-label="Search contacts"
        />
      </MasterFilterShell>

      <div className="cd-layout">
        <div className="cd-list card card--flush">
          <div className="table-wrap cd-table-wrap">
            <table className="inv-table cd-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Category</th>
                  <th className="cd-col-type">Resource Type</th>
                  <th className="cd-col-provider">Service Provider</th>
                  <th className="cd-col-org">Organization</th>
                  <th className="cd-col-supply">Supply Category</th>
                  <th className="cd-col-prof">Profession</th>
                  <th className="cd-col-email">Email</th>
                  <th>Contact</th>
                  <th>City</th>
                  <th className="cd-col-state">State</th>
                  <th className="inv-col-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c._id}>
                    <td>
                      <strong>{c.name}</strong>
                    </td>
                    <td>
                      {c.contactCategory ||
                        (['Vendor', 'Supplier'].includes(c.resourceType)
                          ? 'Vendor'
                          : c.resourceType === 'Client'
                            ? 'Client'
                            : c.resourceType
                              ? 'Resource'
                              : '—')}
                    </td>
                    <td className="cd-col-type">
                      {c.contactCategory === 'Resource' ||
                      c.contactCategory === 'Healthcare Worker' ||
                      (!c.contactCategory &&
                        c.resourceType &&
                        !['Vendor', 'Supplier', 'Client'].includes(c.resourceType))
                        ? c.resourceType || '—'
                        : '—'}
                    </td>
                    <td className="cd-col-provider">
                      {c.serviceProviderName
                        ? c.serviceProviderName
                        : isServiceProviderContact(c)
                          ? `${(c.providerEmployees || []).length + (staffCountByProvider[String(c._id)] || 0)} staff`
                          : '—'}
                    </td>
                    <td className="cd-col-org">{c.organization || '—'}</td>
                    <td className="cd-col-supply">{c.supplyCategory || '—'}</td>
                    <td className="cd-col-prof">{c.profession || '—'}</td>
                    <td className="cd-col-email">{c.email || '—'}</td>
                    <td>{c.contact || c.mobile || '—'}</td>
                    <td>{c.city || '—'}</td>
                    <td className="cd-col-state">{c.state || '—'}</td>
                    <td className="inv-col-actions">
                      {can('agreements:write') && (
                        <button
                          className="inv-link"
                          type="button"
                          onClick={() => startEdit(c)}
                        >
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {!rows.length && !listLoading && (
                  <tr>
                    <td colSpan={12}>
                      <p className="muted cd-empty">No contacts yet. Add one or import Excel.</p>
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

        {can('agreements:write') && (
          <form className="card cd-form" onSubmit={save}>
            <header className="cd-form-head">
              <h3>{editId ? 'Edit contact' : 'Create new contact'}</h3>
            </header>

            <section className="cd-section">
              <h4 className="cd-section-title">Classification</h4>
              <div className="cd-form-grid">
                <div className="field">
                  <label>Contact Category *</label>
                  <AdaptiveSelect
                    required
                    value={form.contactCategory}
                    onChange={(e) => onCategoryChange(e.target.value)}
                  >
                    <option value="">Select…</option>
                    {CONTACT_CATEGORIES.map((t) => (
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
                        setForm({
                          ...form,
                          resourceType: nextType,
                          serviceProviderContactId: isHcwStaffResourceType(nextType)
                            ? form.serviceProviderContactId
                            : '',
                          providerEmployees:
                            nextType === 'Service Provider' ? form.providerEmployees || [] : [],
                        });
                      }}
                    />
                  </div>
                )}

                {isHcwStaff && (
                  <div className="field cd-span-2">
                    <label>Service Provider (agency)</label>
                    <AdaptiveSelect
                      value={form.serviceProviderContactId}
                      onChange={(e) =>
                        setForm({ ...form, serviceProviderContactId: e.target.value })
                      }
                    >
                      <option value="">None — direct engagement</option>
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
                      Link this worker to a provider for camp assignments and billing roll-ups.
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
                    />
                  </div>
                )}

                {isVendor && (
                  <div className="field">
                    <label>Supply Category *</label>
                    <OtherAwareSelect
                      id="contact-supply-category"
                      required
                      picklistKey="contact.supplyCategory"
                      source="contact-directory"
                      options={supplyCategoryOptions}
                      value={form.supplyCategory}
                      onChange={(e) => setForm({ ...form, supplyCategory: e.target.value })}
                    />
                  </div>
                )}

                {form.contactCategory && !isHcwProvider ? (
                  <div className="field">
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

            {isHcwProvider ? (
              <ServiceProviderProfile
                form={form}
                disabled={busy}
                professionOptions={professionOptions}
                onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
                onEmployeesChange={(providerEmployees) =>
                  setForm((f) => ({ ...f, providerEmployees }))
                }
              />
            ) : null}

            {!isHcwProvider && (
            <section className="cd-section">
              <h4 className="cd-section-title">Identity</h4>
              <div className="cd-form-grid">
                <div className="field cd-span-2">
                  <label>Name *</label>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Contact</label>
                  <input
                    value={form.contact}
                    onChange={(e) => setForm({ ...form, contact: e.target.value })}
                    placeholder="10-digit mobile"
                  />
                </div>
              </div>
              <p className="cd-form-hint">Email or contact number is required.</p>
            </section>
            )}

            {!isHcwProvider && (
            <section className="cd-section">
              <h4 className="cd-section-title">Location</h4>
              <LocationCascade
                value={form}
                onChange={(loc) => setForm({ ...form, ...loc })}
                showDistrict={false}
                showPin={showBankAndAddress}
              />
            </section>
            )}

            {showBankAndAddress && (
              <section className="cd-section cd-section--last">
                <h4 className="cd-section-title">Address &amp; banking</h4>
                <div className="cd-form-grid">
                  <div className="field cd-span-2">
                    <label>Address</label>
                    <textarea
                      rows={2}
                      value={form.address}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label>PAN Number</label>
                    <input
                      value={form.panNumber}
                      onChange={(e) => setForm({ ...form, panNumber: e.target.value.toUpperCase() })}
                    />
                  </div>
                  <div className="field">
                    <label>IFSC Code</label>
                    <input
                      value={form.ifscCode}
                      onChange={(e) => setForm({ ...form, ifscCode: e.target.value.toUpperCase() })}
                    />
                  </div>
                  <div className="field">
                    <label>Bank Name</label>
                    <input
                      value={form.bankName}
                      onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label>Account Number</label>
                    <input
                      value={form.accountNumber}
                      onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label>Bank Account Proof</label>
                    {editId ? (
                      <>
                        <FilePicker
                          accept={CONTACT_KYC_ACCEPT_ATTR}
                          disabled={Boolean(kycUploadBusy)}
                          buttonLabel={kycUploadBusy === 'passbook' ? 'Uploading…' : 'Browse'}
                          emptyLabel="No file chosen"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) uploadKycDocument('passbook', file);
                            e.target.value = '';
                          }}
                        />
                        {form.passbookCopyUrl ? (
                          <p className="cd-form-hint">
                            Uploaded
                            {' · '}
                            <a href={form.passbookCopyUrl} target="_blank" rel="noreferrer">View</a>
                          </p>
                        ) : (
                          <p className="cd-form-hint">{CONTACT_KYC_HINT}. Required for Finance payout.</p>
                        )}
                      </>
                    ) : (
                      <p className="cd-form-hint">Save the contact first, then upload bank account proof.</p>
                    )}
                  </div>
                  <div className="field">
                    <label>PAN Card Copy</label>
                    {editId ? (
                      <>
                        <FilePicker
                          accept={CONTACT_KYC_ACCEPT_ATTR}
                          disabled={Boolean(kycUploadBusy)}
                          buttonLabel={kycUploadBusy === 'pan_card' ? 'Uploading…' : 'Browse'}
                          emptyLabel="No file chosen"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) uploadKycDocument('pan_card', file);
                            e.target.value = '';
                          }}
                        />
                        {form.panCardCopyUrl ? (
                          <p className="cd-form-hint">
                            Uploaded
                            {' · '}
                            <a href={form.panCardCopyUrl} target="_blank" rel="noreferrer">View</a>
                          </p>
                        ) : (
                          <p className="cd-form-hint">{CONTACT_KYC_HINT}. Required for Finance payout.</p>
                        )}
                      </>
                    ) : (
                      <p className="cd-form-hint">Save the contact first, then upload PAN card copy.</p>
                    )}
                  </div>
                </div>
              </section>
            )}

            <div className="cd-form-actions">
              {editId && (
                <button
                  className="btn btn-ghost"
                  type="button"
                  onClick={() => {
                    setEditId(null);
                    setForm(empty);
                  }}
                >
                  Cancel edit
                </button>
              )}
              <button className="btn" type="submit" disabled={busy}>
                {editId ? 'Save changes' : 'Add to directory'}
              </button>
            </div>
          </form>
        )}
      </div>
    </PageShell>
  );
}
