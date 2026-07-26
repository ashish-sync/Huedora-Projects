import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, apiFetch, downloadExcel } from '../../shared/api.js';

import { MODULE, FIELD } from '../../shared/labels.js';
import { useAuth } from '../../shared/auth.jsx';
import { formatDateTime } from '../../shared/dateFormat.js';
import PageShell from '../../components/ui/PageShell.jsx';
import AdaptiveSelect from '../../components/ui/AdaptiveSelect.jsx';
import PaginationBar from '../../components/ui/PaginationBar.jsx';
import {
  ASSET_TYPE_OPTIONS,
  ASSET_STATUS_OPTIONS,
  ASSET_CUSTODY_OPTIONS,
} from '../devices/assetMasterOptions.js';
import { phoneOrEmailError, PAGE_SIZES } from '../../shared/validation.js';
import { productAssetName, productOptionLabel } from '../../shared/productMasterLabel.js';

const emptyForm = {
  productId: '',
  name: '',
  assetType: '',
  productType: 'Medical Device',
  serialNumber: '',
  purchaseMonth: '',
  agreementStatus: 'Not Initiated',
  custody: '',
  custodianName: '',
  custodianContact: '',
  custodianCity: '',
  custodianState: '',
  custodianStateId: '',
  description: '',
  contactId: '',
};

function clearCustodianFields(form) {
  return {
    ...form,
    contactId: '',
    custodianName: '',
    custodianContact: '',
    custodianCity: '',
    custodianDistrict: '',
    custodianDistrictId: '',
    custodianCityId: '',
  };
}

function contactToCustodianForm(contact) {
  if (!contact) return {};
  return {
    contactId: contact._id,
    custodianName: contact.name || '',
    custodianContact: contact.contact || contact.mobile || contact.email || '',
    custodianCity: contact.city || '',
    custodianState: contact.state || '',
    custodianDistrict: contact.district || '',
    custodianStateId: contact.stateId || '',
    custodianDistrictId: contact.districtId || '',
    custodianCityId: contact.cityId || '',
  };
}

function contactOptionLabel(c) {
  const bits = [c.name, c.city, c.state, c.profession || c.resourceType].filter(Boolean);
  return bits.join(' · ');
}

function assetStatusTone(status) {
  const s = String(status || '');
  if (s === 'Agreement Signed' || s === 'Active') return 'ok';
  if (['With TCPL', 'Under Repairs'].includes(s)) return 'info';
  if (['Lost/Stolen', 'Untraceable', 'End of Life'].includes(s)) return 'danger';
  if (s === 'Not Initiated') return 'neutral';
  return 'warn';
}

function purchaseToMonthInput(mmYyyy) {
  if (!mmYyyy || !/^\d{2}\/\d{4}$/.test(String(mmYyyy))) return '';
  const [mm, yyyy] = String(mmYyyy).split('/');
  return `${yyyy}-${mm}`;
}

function custodianCity(row) {
  return row.location?.city || row.contactId?.city || row.custodianCity || '-';
}

function custodianName(row) {
  return row.custodianName || row.contactId?.name || '-';
}

function IconEdit() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path d="M12 20h9" strokeLinecap="round" />
      <path
        d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5Z"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconView() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconAudit() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5.5l3.5 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function AssetsPage({ embedded = false, productType = '' } = {}) {
  const { can } = useAuth();
  const canWrite = can('assets:write') || can('devices:write') || can('*');
  const canViewAgreements = can('agreements:read') || can('*');
  const canManageAgreements =
    can('agreements:write') || can('documents:write') || can('assets:write') || can('*');
  const scopedType = String(productType || '').trim();

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: 25, total: 0, pages: 0 });
  const [q, setQ] = useState('');
  const [agreementStatus, setAgreementStatus] = useState('');
  const [custody, setCustody] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);

  const [contacts, setContacts] = useState([]);
  const [products, setProducts] = useState([]);
  const [geoStates, setGeoStates] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const fileRef = useRef(null);
  const formRef = useRef(null);

  const [viewRow, setViewRow] = useState(null);
  const [viewDocs, setViewDocs] = useState([]);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewError, setViewError] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');
  const [docBusy, setDocBusy] = useState(false);
  const uploadDocRef = useRef(null);
  const replaceDocRef = useRef(null);
  const [replaceTargetId, setReplaceTargetId] = useState('');

  const downloadInventory = async () => {
    setError('');
    setExportBusy(true);
    try {
      await downloadExcel('/assets/export', 'Asset_Inventory.xlsx');
    } catch (err) {
      setError(err.message);
    } finally {
      setExportBusy(false);
    }
  };

  const downloadSample = async () => {
    setError('');
    try {
      const res = await apiFetch('/devices/import-template');
      if (!res.ok) throw new Error('Could not download sample Excel');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Asset_Inventory_Sample.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    }
  };

  const runImport = async (file) => {
    setError('');
    setMsg('');
    setImportBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await api('/devices/import', { method: 'POST', body: fd });
      const errHint =
        data.errorRows > 0
          ? ` · ${data.errorRows} row${data.errorRows === 1 ? '' : 's'} failed`
          : '';
      const reportHint = data.errorReport
        ? ' Open Notifications to download the failed-rows Excel with reasons.'
        : '';
      setMsg(
        `Imported ${data.created} asset${data.created === 1 ? '' : 's'}${errHint}.${reportHint}`
      );
      if (data.errors?.length) {
        setError(data.errors.map((e) => `Row ${e.row}: ${e.message}`).slice(0, 5).join(' · '));
      }
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setImportBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (q.trim()) params.set('q', q.trim());
      if (agreementStatus) params.set('agreementStatus', agreementStatus);
      if (custody) params.set('custody', custody);
      if (scopedType) params.set('productType', scopedType);
      const res = await api(`/assets?${params}`);
      setRows(res.data || []);
      setMeta(res.meta || { page, limit, total: 0, pages: 0 });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, limit, q, agreementStatus, custody, scopedType]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api('/contacts?limit=500')
      .then((r) => setContacts(r.data || []))
      .catch(() => {});
    api('/logistics/products?limit=500&isActive=true')
      .then((r) => setProducts(r.data || []))
      .catch(() => {});
    api('/geo/states')
      .then((r) => setGeoStates(r.data || []))
      .catch(() => {});
  }, []);

  const custodianOptions = useMemo(() => {
    if (!form.custodianState && !form.custodianStateId) return contacts;
    return contacts.filter((c) => {
      if (form.custodianStateId && c.stateId) {
        return String(c.stateId) === String(form.custodianStateId);
      }
      if (form.custodianState) {
        return (
          String(c.state || '')
            .trim()
            .toLowerCase() === String(form.custodianState).trim().toLowerCase()
        );
      }
      return true;
    });
  }, [contacts, form.custodianState, form.custodianStateId]);

  useEffect(() => {
    if (!formOpen || form.custodianStateId || !form.custodianState || !geoStates.length) return;
    const st = geoStates.find(
      (s) => String(s.name || '').toLowerCase() === String(form.custodianState).toLowerCase()
    );
    if (st) {
      setForm((f) => ({ ...f, custodianStateId: st._id }));
    }
  }, [formOpen, form.custodianState, form.custodianStateId, geoStates]);

  const pickCustodianState = (stateId) => {
    if (!stateId) {
      setForm((f) => ({ ...f, custodianStateId: '', custodianState: '' }));
      return;
    }
    const st = geoStates.find((s) => String(s._id) === String(stateId));
    setForm((f) => {
      const next = {
        ...f,
        custodianStateId: stateId,
        custodianState: st?.name || '',
      };
      if (!f.contactId) return next;
      const contact = contacts.find((c) => String(c._id) === String(f.contactId));
      if (!contact) return clearCustodianFields(next);
      const inState =
        (contact.stateId && String(contact.stateId) === String(stateId)) ||
        (st?.name &&
          String(contact.state || '')
            .trim()
            .toLowerCase() === String(st.name).toLowerCase());
      return inState ? next : clearCustodianFields(next);
    });
  };

  const pickCustodian = (contactId) => {
    if (!contactId) {
      setForm((f) => clearCustodianFields(f));
      return;
    }
    const contact = contacts.find((c) => String(c._id) === String(contactId));
    if (!contact) {
      setForm((f) => clearCustodianFields(f));
      return;
    }
    let stateId = contact.stateId || '';
    let stateName = contact.state || '';
    if (!stateId && stateName && geoStates.length) {
      const st = geoStates.find(
        (s) => String(s.name || '').toLowerCase() === String(stateName).toLowerCase()
      );
      if (st) {
        stateId = st._id;
        stateName = st.name;
      }
    }
    setForm((f) => ({
      ...f,
      ...contactToCustodianForm(contact),
      custodianState: stateName,
      custodianStateId: stateId,
    }));
  };

  const productsForType = products.filter(
    (p) => !form.productType || p.productType === form.productType
  );

  const pickProduct = (productId) => {
    const p = products.find((x) => String(x._id) === String(productId));
    if (!p) {
      setForm((f) => ({ ...f, productId: '', name: '' }));
      return;
    }
    setForm((f) => ({
      ...f,
      productId: p._id,
      name: productAssetName(p),
      productType: p.productType || f.productType,
      description: f.description || p.description || '',
    }));
  };

  const runSearch = () => {
    setPage(1);
    load();
  };

  const openCreate = () => {
    setEditingId('');
    setForm({
      ...emptyForm,
      productType: scopedType || 'Medical Device',
    });
    setFormOpen(true);
    setError('');
    setMsg('');
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 40);
  };

  const openEdit = (row) => {
    const master = row.deviceMasterId && typeof row.deviceMasterId === 'object' ? row.deviceMasterId : null;
    setEditingId(row._id);
    setForm({
      productId: master?.productId || '',
      name: row.deviceNameSnapshot || master?.name || '',
      assetType: row.assetType || master?.assetType || '',
      productType: row.productType || scopedType || 'Medical Device',
      serialNumber: row.serialNumber || '',
      purchaseMonth: purchaseToMonthInput(row.addedMonth || master?.purchaseMonth),
      agreementStatus: row.agreementStatus || 'Not Initiated',
      custody: row.custody || '',
      custodianName: row.custodianName || row.contactId?.name || '',
      custodianContact:
        row.custodianContact || row.contactId?.contact || row.contactId?.email || '',
      custodianCity: row.location?.city || row.contactId?.city || '',
      custodianState: row.location?.state || row.contactId?.state || row.custodianState || '',
      custodianStateId: row.contactId?.stateId || '',
      description: row.remarks || master?.description || '',
      contactId: row.contactId?._id || row.contactId || '',
    });
    setFormOpen(true);
    setError('');
    setMsg('');
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 40);
  };

  const closeForm = () => {
    setEditingId('');
    setForm(emptyForm);
    setFormOpen(false);
  };

  const save = async (e) => {
    e.preventDefault();
    setError('');
    setMsg('');
    setBusy(true);
    try {
      if (!editingId && !form.productId) {
        setError('Select Model/Variant/Name from Product Master.');
        setBusy(false);
        return;
      }
      if (!form.contactId) {
        setError('Select a custodian from Contact Directory.');
        setBusy(false);
        return;
      }
      const contactErr = phoneOrEmailError(form.custodianContact.trim(), 'Custodian Contact');
      if (contactErr) {
        setError(contactErr);
        setBusy(false);
        return;
      }
      if (editingId) {
        const body = {
          ...(form.productId ? { productId: form.productId } : {}),
          ...(form.contactId ? { contactId: form.contactId } : {}),
          name: form.name.trim(),
          assetType: form.assetType,
          productType: scopedType || form.productType || 'Medical Device',
          serialNumber: form.serialNumber.trim(),
          purchaseMonth: form.purchaseMonth,
          agreementStatus: form.agreementStatus,
          custody: form.custody,
          custodianName: form.custodianName.trim(),
          custodianContact: form.custodianContact.trim(),
          custodianCity: form.custodianCity.trim(),
          custodianState: form.custodianState,
          description: form.description.trim() || '',
          contactId: form.contactId || null,
        };
        await api(`/assets/${editingId}`, { method: 'PATCH', body });
        setMsg('Asset updated.');
      } else {
        const payload = {
          productId: form.productId || null,
          contactId: form.contactId,
          name: form.name.trim(),
          assetType: form.assetType,
          productType: scopedType || form.productType || 'Medical Device',
          serialNumber: form.serialNumber.trim(),
          purchaseMonth: form.purchaseMonth,
          agreementStatus: form.agreementStatus,
          custody: form.custody,
          custodianName: form.custodianName.trim(),
          custodianContact: form.custodianContact.trim(),
          custodianCity: form.custodianCity.trim(),
          custodianState: form.custodianState,
          description: form.description.trim() || '',
        };
        const { data } = await api('/devices', { method: 'POST', body: payload });
        setMsg(`Added “${data.name}” with serial ${data.serialNumber}.`);
      }
      closeForm();
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const openView = async (row) => {
    setViewRow(row);
    setViewDocs([]);
    setViewError('');
    setPreviewUrl('');
    setPreviewTitle('');
    setViewLoading(true);
    try {
      const { data } = await api(`/assets/${row._id}/documents`);
      setViewDocs(data || []);
    } catch (err) {
      setViewError(err.message);
    } finally {
      setViewLoading(false);
    }
  };

  const closeView = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl('');
    setPreviewTitle('');
    setViewRow(null);
    setViewDocs([]);
  };

  const openAgreementPdf = async (agreement) => {
    if (!canViewAgreements) return;
    setViewError('');
    try {
      const res = await apiFetch(`/agreements/${agreement._id}/pdf`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error?.message || 'Could not load agreement PDF');
      }
      const blob = await res.blob();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setPreviewTitle(agreement.title || agreement.agreementNumber);
    } catch (err) {
      setViewError(err.message);
    }
  };

  const refreshDocs = async (assetId) => {
    const { data } = await api(`/assets/${assetId}/documents`);
    setViewDocs(data || []);
  };

  const uploadSignedAgreement = async (file) => {
    if (!viewRow?._id || !file) return;
    setDocBusy(true);
    setViewError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append(
        'title',
        `Signed agreement: ${viewRow.deviceNameSnapshot || viewRow.serialNumber || 'asset'}`
      );
      await api(`/assets/${viewRow._id}/documents`, { method: 'POST', body: fd });
      await refreshDocs(viewRow._id);
      setMsg('Signed agreement uploaded. It remains available under Docs.');
      load();
    } catch (err) {
      setViewError(err.message);
    } finally {
      setDocBusy(false);
      if (uploadDocRef.current) uploadDocRef.current.value = '';
    }
  };

  const replaceSignedAgreement = async (agreementId, file) => {
    if (!viewRow?._id || !agreementId || !file) return;
    setDocBusy(true);
    setViewError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      await api(`/assets/${viewRow._id}/documents/${agreementId}/replace`, {
        method: 'POST',
        body: fd,
      });
      await refreshDocs(viewRow._id);
      setMsg('Agreement file updated. Previous attachments are still available.');
      load();
    } catch (err) {
      setViewError(err.message);
    } finally {
      setDocBusy(false);
      setReplaceTargetId('');
      if (replaceDocRef.current) replaceDocRef.current.value = '';
    }
  };

  const openAttachment = async (agreement, doc) => {
    if (!canViewAgreements) return;
    setViewError('');
    try {
      const res = await apiFetch(`/agreements/${agreement._id}/documents/${doc._id}/download`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error?.message || 'Could not open attachment');
      }
      const blob = await res.blob();
      const name = doc.name || doc.fileName || 'attachment';
      const isPdf =
        String(doc.contentType || doc.mimeType || '').includes('pdf') ||
        String(name).toLowerCase().endsWith('.pdf');
      if (isPdf) {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        setPreviewTitle(`${name}${doc.version ? ` · v${doc.version}` : ''}`);
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      setViewError(err.message);
    }
  };

  const headerActions = (
        <div className="inv-header-actions">
          <button
            className="btn secondary btn-compact"
            type="button"
            disabled={exportBusy}
            onClick={downloadInventory}
          >
            {exportBusy ? 'Downloading…' : 'Download'}
          </button>
          {canWrite ? (
            <>
              <button className="btn secondary btn-compact" type="button" onClick={downloadSample}>
                Sample
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) runImport(f);
                }}
              />
              <button
                className="btn secondary btn-compact"
                type="button"
                disabled={importBusy}
                onClick={() => fileRef.current?.click()}
              >
                {importBusy ? 'Importing…' : 'Import'}
              </button>
              <button className="btn btn-compact" type="button" onClick={openCreate}>
                + Add asset
              </button>
            </>
          ) : null}
        </div>
  );

  const main = (
    <>
      {(error || msg) && (
        <div className={`am-banner ${error ? 'is-error' : 'is-info'}`} role="status">
          {error || msg}
        </div>
      )}

      {canWrite && formOpen && (
        <form ref={formRef} className="am-form card" onSubmit={save}>
          <div className="am-form-head">
            <h2>{editingId ? 'Edit asset' : 'New asset'}</h2>
            <button className="btn secondary btn-compact" type="button" onClick={closeForm}>
              Close
            </button>
          </div>

          <section className="am-form-section">
            <h3 className="am-form-section-title">Product</h3>
            <div className="am-form-section-grid">
              <div className="field">
                <label>Product type *</label>
                <AdaptiveSelect
                  required
                  value={form.productType || scopedType || 'Medical Device'}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      productType: e.target.value,
                      productId: '',
                      name: '',
                    })
                  }
                  disabled={Boolean(scopedType)}
                >
                  <option value="Medical Device">Medical Device</option>
                  <option value="Non-Medical Device">Non-Medical Device</option>
                </AdaptiveSelect>
              </div>
              <div className="field">
                <label>Model / Variant *</label>
                <AdaptiveSelect
                  required={!editingId}
                  value={form.productId}
                  onChange={(e) => pickProduct(e.target.value)}
                >
                  <option value="">Select from Product Master…</option>
                  {productsForType.map((p) => (
                    <option key={p._id} value={p._id}>
                      {productOptionLabel(p)}
                    </option>
                  ))}
                </AdaptiveSelect>
              </div>
              <div className="field am-form-span-2">
                <label>{FIELD.ASSET_NAME} *</label>
                <input
                  required
                  readOnly={Boolean(form.productId)}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Brand — Model"
                  title={form.productId ? 'From Product Master' : ''}
                />
              </div>
            </div>
          </section>

          <section className="am-form-section">
            <h3 className="am-form-section-title">Registration</h3>
            <div className="am-form-section-grid">
              <div className="field">
                <label>{FIELD.ASSET_TYPE} *</label>
                <AdaptiveSelect
                  required
                  value={form.assetType}
                  onChange={(e) => setForm({ ...form, assetType: e.target.value })}
                >
                  <option value="">Select type</option>
                  {ASSET_TYPE_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </AdaptiveSelect>
              </div>
              <div className="field">
                <label>Serial number *</label>
                <input
                  required
                  value={form.serialNumber}
                  onChange={(e) => setForm({ ...form, serialNumber: e.target.value })}
                  placeholder="SN-1001"
                />
              </div>
              <div className="field">
                <label>Purchase (MM/YYYY) *</label>
                <input
                  required
                  type="month"
                  value={form.purchaseMonth}
                  onChange={(e) => setForm({ ...form, purchaseMonth: e.target.value })}
                />
              </div>
              <div className="field">
                <label>{FIELD.ASSET_STATUS} *</label>
                <AdaptiveSelect
                  required
                  value={form.agreementStatus}
                  onChange={(e) => setForm({ ...form, agreementStatus: e.target.value })}
                >
                  {ASSET_STATUS_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </AdaptiveSelect>
              </div>
              <div className="field am-form-span-2">
                <label>{FIELD.ASSET_CUSTODY} *</label>
                <AdaptiveSelect
                  required
                  value={form.custody}
                  onChange={(e) => setForm({ ...form, custody: e.target.value })}
                >
                  <option value="">Select custody</option>
                  {ASSET_CUSTODY_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </AdaptiveSelect>
              </div>
            </div>
          </section>

          <section className="am-form-section">
            <h3 className="am-form-section-title">Custodian</h3>
            <div className="am-form-section-grid">
              <div className="field">
                <label>{FIELD.CUSTODIAN_NAME} *</label>
                <AdaptiveSelect
                  required
                  threshold={1}
                  placeholder="Search custodian…"
                  aria-label={FIELD.CUSTODIAN_NAME}
                  value={form.contactId}
                  onChange={(e) => pickCustodian(e.target.value)}
                >
                  <option value="">Select custodian…</option>
                  {custodianOptions.map((c) => (
                    <option key={c._id} value={c._id}>
                      {contactOptionLabel(c)}
                    </option>
                  ))}
                </AdaptiveSelect>
              </div>
              <div className="field">
                <label>{FIELD.CUSTODIAN_STATE}</label>
                <AdaptiveSelect
                  threshold={1}
                  placeholder="Filter by state…"
                  aria-label={FIELD.CUSTODIAN_STATE}
                  value={form.custodianStateId}
                  onChange={(e) => pickCustodianState(e.target.value)}
                >
                  <option value="">All states</option>
                  {geoStates.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name}
                    </option>
                  ))}
                </AdaptiveSelect>
              </div>
              {form.contactId ? (
                <div className="am-custodian-summary am-form-span-2" aria-live="polite">
                  {[form.custodianContact, form.custodianCity, form.custodianState]
                    .filter(Boolean)
                    .join(' · ') || '—'}
                </div>
              ) : null}
            </div>
          </section>

          <section className="am-form-section am-form-section--last">
            <h3 className="am-form-section-title">Notes</h3>
            <div className="am-form-section-grid">
              <div className="field am-form-span-2">
                <label>Description</label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Optional"
                />
              </div>
            </div>
          </section>

          <div className="am-form-actions">
            <button className="btn" type="submit" disabled={busy}>
              {busy ? 'Saving…' : editingId ? 'Save changes' : 'Add asset'}
            </button>
            <button className="btn secondary" type="button" disabled={busy} onClick={closeForm}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <section className="inv-catalog card card--flush">
        <div className="inv-toolbar">
          <input
            className="esign-search inv-search"
            placeholder="Search asset name, serial, custodian, city…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runSearch()}
          />
          <AdaptiveSelect
            value={agreementStatus}
            onChange={(e) => {
              setAgreementStatus(e.target.value);
              setPage(1);
            }}
            aria-label="Asset status"
          >
            <option value="">All asset statuses</option>
            {ASSET_STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </AdaptiveSelect>
          <AdaptiveSelect
            value={custody}
            onChange={(e) => {
              setCustody(e.target.value);
              setPage(1);
            }}
            aria-label="Asset custody"
          >
            <option value="">All custody</option>
            {ASSET_CUSTODY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </AdaptiveSelect>
          <button className="btn secondary" type="button" onClick={runSearch}>
            Search
          </button>
        </div>

        <div className="inv-table-wrap">
          <table className="inv-table">
            <thead>
              <tr>
                <th>{FIELD.ASSET_NAME}</th>
                <th>{FIELD.ASSET_TYPE}</th>
                <th>Serial No.</th>
                <th>{FIELD.ASSET_STATUS}</th>
                <th>{FIELD.ASSET_CUSTODY}</th>
                <th>{FIELD.CUSTODIAN_NAME}</th>
                <th>City</th>
                <th className="inv-col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a._id}>
                  <td>
                    <strong className="inv-device">{a.deviceNameSnapshot || '-'}</strong>
                  </td>
                  <td className="inv-muted-cell">
                    {a.assetType || a.deviceMasterId?.assetType || '-'}
                  </td>
                  <td className="mono-sm">{a.serialNumber || '-'}</td>
                  <td>
                    <span className={`badge tone-${assetStatusTone(a.agreementStatus)}`}>
                      {a.agreementStatus || 'Not Initiated'}
                    </span>
                  </td>
                  <td className="inv-muted-cell">{a.custody || '-'}</td>
                  <td>{custodianName(a)}</td>
                  <td>{custodianCity(a)}</td>
                  <td className="inv-col-actions">
                    <div className="inv-row-actions">
                      {canWrite && (
                        <button
                          className="inv-icon-btn"
                          type="button"
                          title="Edit"
                          aria-label="Edit"
                          onClick={() => openEdit(a)}
                        >
                          <IconEdit />
                        </button>
                      )}
                      <button
                        className="inv-icon-btn"
                        type="button"
                        title="View"
                        aria-label="View documents"
                        onClick={() => openView(a)}
                      >
                        <IconView />
                      </button>
                      <Link
                        className="inv-icon-btn"
                        to={`/assets/${a._id}`}
                        title="Audit Trail"
                        aria-label="Audit Trail"
                      >
                        <IconAudit />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && !rows.length && (
                <tr>
                  <td colSpan={8}>
                    <div className="inv-empty">
                      <strong>No assets found</strong>
                      <p className="muted">
                        {agreementStatus || custody || q
                          ? 'Try clearing filters or search.'
                          : 'Add an asset or import Excel to start the inventory.'}
                      </p>
                      {canWrite && !agreementStatus && !custody && !q && (
                        <button className="btn" type="button" onClick={openCreate}>
                          + Add asset
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <PaginationBar
          page={meta.page || page}
          limit={limit}
          total={meta.total || 0}
          pages={meta.pages || 0}
          loading={loading}
          pageSizes={PAGE_SIZES}
          onPageChange={setPage}
          onLimitChange={(n) => {
            setLimit(n);
            setPage(1);
          }}
        />
      </section>

      {viewRow && (
        <div className="inv-modal-backdrop" role="presentation" onClick={closeView}>
          <div
            className="inv-modal inv-modal-wide card"
            role="dialog"
            aria-labelledby="inv-view-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="inv-modal-head">
              <h2 id="inv-view-title">Docs</h2>
              <button type="button" className="btn secondary btn-compact" onClick={closeView}>
                Close
              </button>
            </div>
            <p className="muted inv-modal-sub">
              {viewRow.deviceNameSnapshot} · {viewRow.serialNumber || 'No serial'}
            </p>
            <p className="muted inv-doc-intro">
              Upload, view, or replace signed agreements. Prior attachments stay available for
              reference.
            </p>
            {viewError && <p className="error">{viewError}</p>}
            {viewLoading && <p className="muted">Loading documents…</p>}

            {canManageAgreements && (
              <div className="inv-doc-upload">
                <input
                  ref={uploadDocRef}
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadSignedAgreement(f);
                  }}
                />
                <button
                  type="button"
                  className="btn btn-compact"
                  disabled={docBusy || viewLoading}
                  onClick={() => uploadDocRef.current?.click()}
                >
                  {docBusy ? 'Uploading…' : viewDocs.length ? 'Upload another agreement' : 'Upload signed agreement'}
                </button>
                <input
                  ref={replaceDocRef}
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f && replaceTargetId) replaceSignedAgreement(replaceTargetId, f);
                  }}
                />
              </div>
            )}

            {!viewLoading && !viewDocs.length && !viewError && (
              <p className="muted">
                No agreement on file yet.
                {canManageAgreements ? ' Upload a signed agreement to get started.' : ''}
              </p>
            )}
            {!viewLoading && !!viewDocs.length && (
              <ul className="inv-doc-list">
                {viewDocs.map((ag) => (
                  <li key={ag._id} className="inv-doc-item">
                    <div className="inv-doc-main">
                      <strong>{ag.title || ag.agreementNumber}</strong>
                      <div className="muted mono-sm">
                        {ag.agreementNumber} · {ag.status}
                        {ag.isActiveLink ? ' · Active link' : ''}
                      </div>
                      {(ag.documents || []).length > 0 && (
                        <ul className="inv-doc-attachments">
                          {ag.documents.map((doc) => (
                            <li key={doc._id}>
                              <button
                                type="button"
                                className="inv-doc-file"
                                disabled={!canViewAgreements || !doc.hasFile}
                                onClick={() => openAttachment(ag, doc)}
                                title={doc.hasFile ? 'Open attachment' : 'No file stored'}
                              >
                                <span>
                                  {doc.name || doc.fileName || 'Attachment'}
                                  {doc.isPrimary ? ' · Current' : ''}
                                  {doc.version ? ` · v${doc.version}` : ''}
                                </span>
                                <em className="mono-sm">
                                  {doc.createdAt
                                    ? formatDateTime(doc.createdAt)
                                    : doc.docKind || ''}
                                </em>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="inv-doc-actions">
                      {canViewAgreements && (
                        <button
                          type="button"
                          className="btn secondary btn-compact"
                          onClick={() => openAgreementPdf(ag)}
                        >
                          View
                        </button>
                      )}
                      {canManageAgreements && (
                        <button
                          type="button"
                          className="btn secondary btn-compact"
                          disabled={docBusy}
                          onClick={() => {
                            setReplaceTargetId(ag._id);
                            replaceDocRef.current?.click();
                          }}
                        >
                          Replace
                        </button>
                      )}
                      <Link
                        className="btn secondary btn-compact"
                        to={`/agreements/${ag._id}`}
                        onClick={closeView}
                      >
                        Open envelope
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {previewUrl && (
              <div className="inv-pdf-preview">
                <div className="inv-pdf-preview-head">
                  <strong>{previewTitle}</strong>
                  <button
                    type="button"
                    className="btn secondary btn-compact"
                    onClick={() => {
                      URL.revokeObjectURL(previewUrl);
                      setPreviewUrl('');
                      setPreviewTitle('');
                    }}
                  >
                    Close preview
                  </button>
                </div>
                <iframe title={previewTitle} src={previewUrl} className="inv-pdf-frame" />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );

  if (embedded) {
    return (
      <div className="inv-page">
        <div className="product-master-toolbar" style={{ marginBottom: 12 }}>
          <div>
            <h3 className="product-master-title" style={{ margin: 0 }}>
              {scopedType || 'Asset Register'}
              <span className="inv-count" aria-label={`${meta.total} total assets`}>
                {meta.total.toLocaleString()} assets
              </span>
            </h3>
            <p className="muted" style={{ margin: '4px 0 0' }}>
              {scopedType
                ? `Agreements, custody, and custodian for ${scopedType} only. Record inward in Movement One → Goods Receipt.`
                : 'Agreements, custody, and custodian for Medical and Non-Medical Devices.'}
            </p>
          </div>
          {headerActions}
        </div>
        {main}
      </div>
    );
  }

  return (
    <PageShell
      className="inv-page"
      breadcrumbs={[{ to: '/', label: MODULE.HOME }, { label: MODULE.ASSET_INVENTORY }]}
      title={
        <>
          {MODULE.ASSET_INVENTORY}
          <span className="inv-count" aria-label={`${meta.total} total assets`}>
            {meta.total.toLocaleString()} assets
          </span>
        </>
      }
      description="Register and track devices by type, value, status, custody, and custodian."
      actions={headerActions}
    >
      {main}
    </PageShell>
  );
}
