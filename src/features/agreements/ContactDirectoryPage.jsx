import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, downloadExcel } from '../../shared/api.js';
import { MODULE } from '../../shared/labels.js';
import { useAuth } from '../../shared/auth.jsx';
import PageShell from '../../components/ui/PageShell.jsx';
import AdaptiveSelect from '../../components/ui/AdaptiveSelect.jsx';
import OtherAwareSelect from '../../components/ui/OtherAwareSelect.jsx';
import LocationCascade from '../../components/ui/LocationCascade.jsx';
import PaginationBar from '../../components/ui/PaginationBar.jsx';
import { emailError, phoneError } from '../../shared/validation.js';
import { usePicklistOptions } from '../../shared/usePicklistOptions.js';
import {
  CONTACT_CATEGORIES,
  RESOURCE_TYPES,
  SUPPLY_CATEGORIES,
  professionsForCategory,
  professionPicklistKey,
} from './contactPicklists.js';

const empty = {
  name: '',
  email: '',
  contactCategory: '',
  resourceType: '',
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
  stateId: '',
  districtId: '',
  cityId: '',
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
  const [exportBusy, setExportBusy] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [listMeta, setListMeta] = useState({ page: 1, limit: 25, total: 0, pages: 0 });
  const [listLoading, setListLoading] = useState(false);
  const fileRef = useRef(null);

  const isResource = form.contactCategory === 'Resource';
  const isClient = form.contactCategory === 'Client';
  const isVendor = form.contactCategory === 'Vendor';
  const showBankAndAddress = !isClient && Boolean(form.contactCategory);
  const professionKey = professionPicklistKey(form.contactCategory);
  const professionFallback = professionsForCategory(form.contactCategory);
  const { options: resourceTypeOptions } = usePicklistOptions(
    'contact.resourceType',
    RESOURCE_TYPES
  );
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

  const downloadMaster = async () => {
    setError('');
    setExportBusy(true);
    try {
      await downloadExcel('/contacts/export', 'Contact_Directory.xlsx');
    } catch (err) {
      setError(err.message);
    } finally {
      setExportBusy(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit]);

  const onCategoryChange = (contactCategory) => {
    const nextProfessions = professionsForCategory(contactCategory);
    setForm((f) => ({
      ...f,
      contactCategory,
      resourceType: contactCategory === 'Resource' ? f.resourceType : '',
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
    }));
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
    if (isClient && !String(form.organization || '').trim()) {
      setError('Organization Name is required for Client');
      return;
    }
    if (isVendor && !form.supplyCategory) {
      setError('Supply Category is required for Vendor');
      return;
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
    if (!String(form.email || '').trim() && !String(form.contact || '').trim()) {
      setError('Email or phone is required for a contact');
      return;
    }
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
      if (!isResource) body.resourceType = '';
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
    } catch (err) {
      setError(err.message);
    }
  };

  const startEdit = (c) => {
    let contactCategory = c.contactCategory || '';
    if (!contactCategory) {
      const rt = String(c.resourceType || '').trim().toLowerCase();
      if (rt === 'vendor' || rt === 'supplier') contactCategory = 'Vendor';
      else if (rt === 'client') contactCategory = 'Client';
      else if (c.resourceType) contactCategory = 'Resource';
    }
    const resourceType = contactCategory === 'Resource' ? c.resourceType || '' : '';
    setEditId(c._id);
    setForm({
      name: c.name || '',
      email: c.email || '',
      contactCategory,
      resourceType,
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
      stateId: c.stateId || '',
      districtId: c.districtId || '',
      cityId: c.cityId || '',
    });
  };

  const runImport = async (file, mode) => {
    if (!file) return;
    setBusy(true);
    setError('');
    setImportMsg('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('mode', mode);
      const { data } = await api('/contacts/import', { method: 'POST', body: fd });
      if (mode === 'DRY_RUN') {
        setImportMsg(
          `Dry-run: ${data.totalRows} rows · ${data.validated} valid · ${data.errorRows} errors${
            data.errorReport ? '. Failed rows Excel is in Notifications.' : ''
          }`
        );
      } else {
        setImportMsg(
          `Imported: ${data.created} created · ${data.updated} updated · ${data.errorRows} errors${
            data.errorReport ? '. Failed rows Excel is in Notifications.' : ''
          }`
        );
        load();
      }
      if (data.errors?.length) {
        setError(data.errors.slice(0, 5).map((e) => `Row ${e.row}: ${e.message}`).join(' | '));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <PageShell
      hideChrome={embedded}
      breadcrumbs={
        embedded
          ? []
          : [
              { to: '/', label: MODULE.HOME },
              { to: '/master-data', label: MODULE.MASTER_DATA },
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
          <Link className="btn" to="/agreements/new">
            + New document
          </Link>
        )
      }
      kpis={embedded ? [] : [{ label: 'Contacts', value: listMeta.total || rows.length }]}
      toolbar={
        <>
          <input
            className="esign-search"
            placeholder="Search name, email, category, organization, city…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
          />
          <button
            className="btn secondary"
            type="button"
            onClick={() => {
              setPage(1);
              load();
            }}
          >
            Search
          </button>
          <button
            className="btn secondary"
            type="button"
            disabled={exportBusy}
            onClick={downloadMaster}
          >
            {exportBusy ? 'Downloading…' : 'Download Excel'}
          </button>
          {can('agreements:write') && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) runImport(f, 'COMMIT');
                }}
              />
              <button className="btn secondary" type="button" onClick={() => fileRef.current?.click()} disabled={busy}>
                Import Excel
              </button>
            </>
          )}
        </>
      }
    >
      {error && <p className="error">{error}</p>}
      {importMsg && <p className="muted">{importMsg}</p>}

      <div className="wizard-grid">
        <div className="card card--flush table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>Resource Type</th>
                <th>Organization</th>
                <th>Supply Category</th>
                <th>Profession</th>
                <th>Email</th>
                <th>Contact</th>
                <th>City</th>
                <th>State</th>
                <th></th>
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
                            : '-')}
                  </td>
                  <td>
                    {c.contactCategory === 'Resource' ||
                    (!c.contactCategory &&
                      c.resourceType &&
                      !['Vendor', 'Supplier', 'Client'].includes(c.resourceType))
                      ? c.resourceType || '-'
                      : '-'}
                  </td>
                  <td>{c.organization || '-'}</td>
                  <td>{c.supplyCategory || '-'}</td>
                  <td>{c.profession || '-'}</td>
                  <td>{c.email || '-'}</td>
                  <td>{c.contact || c.mobile || '-'}</td>
                  <td>{c.city || '-'}</td>
                  <td>{c.state || '-'}</td>
                  <td>
                    {can('agreements:write') && (
                      <button
                        className="btn secondary btn-compact"
                        type="button"
                        onClick={() => startEdit(c)}
                      >
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
          {!rows.length && (
            <p className="muted" style={{ padding: '1rem' }}>
              No contacts yet. Add one or import Excel.
            </p>
          )}
        </div>

        {can('agreements:write') && (
          <form className="card" onSubmit={save}>
            <h3 style={{ marginTop: 0 }}>{editId ? 'Edit contact' : 'Create new contact'}</h3>

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

            {isResource && (
              <div className="field">
                <label>Resource Type *</label>
                <OtherAwareSelect
                  id="contact-resource-type"
                  required
                  picklistKey="contact.resourceType"
                  source="contact-directory"
                  options={resourceTypeOptions}
                  value={form.resourceType}
                  onChange={(e) => setForm({ ...form, resourceType: e.target.value })}
                />
              </div>
            )}

            {isClient && (
              <div className="field">
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

            <div className="field">
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

            <LocationCascade
              value={form}
              onChange={(loc) => setForm({ ...form, ...loc })}
              showDistrict={false}
              showPin={showBankAndAddress}
            />

            {showBankAndAddress && (
              <>
                <div className="field">
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
              </>
            )}

            <p className="muted mono-sm">Email or Contact is required.</p>
            <div className="wizard-actions">
              {editId && (
                <button
                  className="btn secondary"
                  type="button"
                  onClick={() => {
                    setEditId(null);
                    setForm(empty);
                  }}
                >
                  Cancel edit
                </button>
              )}
              <button className="btn" type="submit">
                {editId ? 'Save changes' : 'Add to directory'}
              </button>
            </div>
          </form>
        )}
      </div>
    </PageShell>
  );
}
