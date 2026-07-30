import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { api, apiFetch, downloadExcel } from '../../shared/api.js';

import { MODULE, FIELD, NAV } from '../../shared/labels.js';
import { useAuth } from '../../shared/auth.jsx';
import { FeedbackAlerts } from '../../components/ui/FeedbackBanner.jsx';
import AdaptiveSelect from '../../components/ui/AdaptiveSelect.jsx';
import ProductImagesPanel from '../../components/products/ProductImagesPanel.jsx';
import PaginationBar from '../../components/ui/PaginationBar.jsx';
import {
  OWNERSHIP_TYPE_OPTIONS,
  ASSET_STATUS_OPTIONS,
  ASSET_CUSTODY_OPTIONS,
  formatOwnershipType,
} from '../devices/assetMasterOptions.js';
import { phoneOrEmailError, PAGE_SIZES } from '../../shared/validation.js';
import { productAssetName, productOptionLabel } from '../../shared/productMasterLabel.js';
import { collectProductImages } from '../../shared/productImages.js';
import {
  pickSignedAgreementRecord,
} from './assetAgreementDocs.js';

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
  assetValue: '',
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

function productCostValue(product) {
  if (!product) return '';
  const raw = product.purchaseCost ?? product.standardCost ?? product.defaultPerUnitCost;
  return raw != null && raw !== '' ? String(raw) : '';
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
  const outletContext = useOutletContext() || {};
  const setPageActions = outletContext.setPageActions;
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

  const selectedProduct = useMemo(
    () => products.find((p) => String(p._id) === String(form.productId)),
    [products, form.productId]
  );
  const selectedProductImages = useMemo(
    () => collectProductImages(selectedProduct),
    [selectedProduct]
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
      assetValue: productCostValue(p) || f.assetValue,
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
      assetValue:
        row.deviceValue != null
          ? String(row.deviceValue)
          : master?.cost != null
            ? String(master.cost)
            : '',
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
          assetValue: form.assetValue === '' ? undefined : Number(form.assetValue),
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
          assetValue: form.assetValue === '' ? undefined : Number(form.assetValue),
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
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl('');
    setPreviewTitle('');
    setViewLoading(true);
    try {
      const { data } = await api(`/assets/${row._id}/documents`);
      const docs = data || [];
      setViewDocs(docs);
      const signed = pickSignedAgreementRecord(docs, row);
      if (signed && canViewAgreements) {
        await openAttachment(signed.agreement, signed.document, { silent: true });
      }
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
      const docs = await refreshDocs(viewRow._id);
      const signed = pickSignedAgreementRecord(docs, { ...viewRow, agreementStatus: 'Agreement Signed' });
      if (signed && canViewAgreements) {
        await openAttachment(signed.agreement, signed.document, { silent: true });
      }
      setMsg('Signed agreement uploaded to Document One.');
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
      const docs = await refreshDocs(viewRow._id);
      const signed = pickSignedAgreementRecord(docs, viewRow);
      if (signed && canViewAgreements) {
        await openAttachment(signed.agreement, signed.document, { silent: true });
      }
      setMsg('Agreement file updated.');
      load();
    } catch (err) {
      setViewError(err.message);
    } finally {
      setDocBusy(false);
      setReplaceTargetId('');
      if (replaceDocRef.current) replaceDocRef.current.value = '';
    }
  };

  const openAttachment = async (agreement, doc, { silent = false } = {}) => {
    if (!canViewAgreements) return;
    if (!silent) setViewError('');
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

  const viewSignedRecord = useMemo(
    () => (viewRow ? pickSignedAgreementRecord(viewDocs, viewRow) : null),
    [viewDocs, viewRow]
  );
  const hasSignedCopy = Boolean(viewSignedRecord);

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

  useEffect(() => {
    if (!embedded || !setPageActions) return undefined;
    setPageActions(headerActions);
    return () => setPageActions(null);
  }, [embedded, setPageActions, exportBusy, importBusy, canWrite]);

  const main = (
    <>
      {(error || msg) && <FeedbackAlerts error={error} message={msg} />}

      {canWrite && formOpen && (
        <form ref={formRef} className="form-card asset-form-card" onSubmit={save}>
          <div className="asset-form-header-row">
            <div className="asset-form-page-header">
              <h3>{editingId ? 'Edit asset' : 'Add asset'}</h3>
              <p className="meta-text muted">
                Register device ownership, status, custody, and custodian details.
              </p>
            </div>
            <div className="asset-form-header-actions">
              <button className="btn secondary btn-compact" type="button" onClick={closeForm}>
                Close
              </button>
            </div>
          </div>

          <div className="asset-form-body">
            <section className="asset-form-section">
              <h4 className="asset-form-section-title">Product</h4>
              <div className="asset-form-row asset-form-row-3">
                <div className="field">
                  <label htmlFor="asset-product-type">{FIELD.ASSET_TYPE} *</label>
                  <AdaptiveSelect
                    id="asset-product-type"
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
                  <label htmlFor="asset-product-id">Model / Variant *</label>
                  <AdaptiveSelect
                    id="asset-product-id"
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
                <div className="field">
                  <label htmlFor="asset-name">{FIELD.ASSET_NAME} (Display Name) *</label>
                  <input
                    id="asset-name"
                    required
                    readOnly={Boolean(form.productId)}
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Brand — Model"
                    title={form.productId ? 'From Product Master' : ''}
                  />
                </div>
              </div>
              {form.productId && selectedProductImages.length > 0 ? (
                <div className="asset-form-row asset-form-row-1">
                  <div className="field asset-product-images-field">
                    <label>Product reference images</label>
                    <ProductImagesPanel
                      product={selectedProduct}
                      compact
                      title="Product reference images"
                      hint="From Product Master — for visual identification."
                    />
                  </div>
                </div>
              ) : null}
            </section>

            <section className="asset-form-section">
              <h4 className="asset-form-section-title">Registration</h4>
              <div className="asset-form-row asset-form-row-2">
                <div className="field">
                  <label htmlFor="asset-ownership">{FIELD.OWNERSHIP_TYPE} *</label>
                  <AdaptiveSelect
                    id="asset-ownership"
                    required
                    value={form.assetType}
                    onChange={(e) => setForm({ ...form, assetType: e.target.value })}
                  >
                    <option value="">Select ownership type</option>
                    {OWNERSHIP_TYPE_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </AdaptiveSelect>
                </div>
                <div className="field">
                  <label htmlFor="asset-serial">Serial number *</label>
                  <input
                    id="asset-serial"
                    required
                    value={form.serialNumber}
                    onChange={(e) => setForm({ ...form, serialNumber: e.target.value })}
                    placeholder="SN-1001"
                  />
                </div>
              </div>
              <div className="asset-form-row asset-form-row-2">
                <div className="field">
                  <label htmlFor="asset-purchase">Purchase (MM/YYYY) *</label>
                  <input
                    id="asset-purchase"
                    required
                    type="month"
                    value={form.purchaseMonth}
                    onChange={(e) => setForm({ ...form, purchaseMonth: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label htmlFor="asset-status">{FIELD.ASSET_STATUS} *</label>
                  <AdaptiveSelect
                    id="asset-status"
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
              </div>
              <div className="asset-form-row asset-form-row-2">
                <div className="field">
                  <label htmlFor="asset-custody">{FIELD.ASSET_CUSTODY} *</label>
                  <AdaptiveSelect
                    id="asset-custody"
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
                <div className="field">
                  <label htmlFor="asset-value">{FIELD.ASSET_PERIPHERAL_DETAILS}</label>
                  <input
                    id="asset-value"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.assetValue}
                    onChange={(e) => setForm({ ...form, assetValue: e.target.value })}
                    placeholder="From Product Master or enter value"
                  />
                </div>
              </div>
            </section>

            <section className="asset-form-section">
              <h4 className="asset-form-section-title">Custodian</h4>
              <div className="asset-form-row asset-form-row-2">
                <div className="field">
                  <label htmlFor="asset-custodian">{FIELD.CUSTODIAN_NAME} *</label>
                  <AdaptiveSelect
                    id="asset-custodian"
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
                  <label htmlFor="asset-custodian-state">{FIELD.CUSTODIAN_STATE}</label>
                  <AdaptiveSelect
                    id="asset-custodian-state"
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
              </div>
              {form.contactId ? (
                <div className="asset-form-row asset-form-row-1">
                  <div className="asset-custodian-summary" aria-live="polite">
                    <strong>Selected custodian</strong>
                    {[form.custodianContact, form.custodianCity, form.custodianState]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  </div>
                </div>
              ) : null}
            </section>
          </div>

          <div className="form-actions">
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
                <th>{FIELD.ASSET_TYPE}</th>
                <th>{FIELD.ASSET_NAME}</th>
                <th>{FIELD.OWNERSHIP_TYPE}</th>
                <th>Serial No.</th>
                <th>{FIELD.ASSET_STATUS}</th>
                <th>{FIELD.ASSET_CUSTODY}</th>
                <th>{FIELD.CUSTODIAN_NAME}</th>
                <th>{FIELD.CUSTODIAN_CITY}</th>
                <th className="inv-col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a._id}>
                  <td className="inv-muted-cell">{a.productType || 'Medical Device'}</td>
                  <td>
                    <strong className="inv-device">{a.deviceNameSnapshot || '-'}</strong>
                  </td>
                  <td className="inv-muted-cell">
                    {formatOwnershipType(a.assetType || a.deviceMasterId?.assetType) || '-'}
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
                        title="Agreement (Document One)"
                        aria-label="View agreement"
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
                  <td colSpan={9}>
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
              <h2 id="inv-view-title">{MODULE.ASSET_AGREEMENT}</h2>
              <button type="button" className="btn secondary btn-compact" onClick={closeView}>
                Close
              </button>
            </div>
            <p className="muted inv-modal-sub">
              {viewRow.deviceNameSnapshot} · {viewRow.serialNumber || 'No serial'}
            </p>
            {viewError && <p className="error">{viewError}</p>}
            {viewLoading && <p className="muted">Loading agreement…</p>}

            {!viewLoading && hasSignedCopy && viewSignedRecord && (
              <div className="inv-agreement-signed">
                <p className="inv-agreement-signed-lead">
                  Signed agreement on file in {MODULE.DOCUMENT_HUB}.
                </p>
                <div className="inv-agreement-meta muted mono-sm">
                  {viewSignedRecord.agreement.agreementNumber}
                  {viewSignedRecord.agreement.status ? ` · ${viewSignedRecord.agreement.status}` : ''}
                </div>
                <div className="inv-agreement-actions">
                  {canViewAgreements && (
                    <button
                      type="button"
                      className="btn btn-compact"
                      onClick={() =>
                        openAttachment(viewSignedRecord.agreement, viewSignedRecord.document)
                      }
                    >
                      View signed copy
                    </button>
                  )}
                  {canViewAgreements && (
                    <Link
                      className="btn secondary btn-compact"
                      to={`/agreements/${viewSignedRecord.agreement._id}`}
                      onClick={closeView}
                    >
                      Open in {MODULE.DOCUMENT_HUB}
                    </Link>
                  )}
                  {canManageAgreements && (
                    <button
                      type="button"
                      className="btn secondary btn-compact"
                      disabled={docBusy}
                      onClick={() => {
                        setReplaceTargetId(viewSignedRecord.agreement._id);
                        replaceDocRef.current?.click();
                      }}
                    >
                      Replace file
                    </button>
                  )}
                </div>
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
            )}

            {!viewLoading && !hasSignedCopy && (
              <div className="inv-agreement-empty">
                <p className="inv-agreement-empty-title">No signed agreement yet</p>
                <p className="muted inv-agreement-empty-desc">
                  Start a new agreement in {MODULE.DOCUMENT_HUB}, or upload a signed copy if you
                  already have one.
                </p>
                {canManageAgreements && (
                  <div className="inv-agreement-actions inv-agreement-actions--center">
                    <Link
                      className="btn btn-compact"
                      to={`/agreements/new?assetId=${viewRow._id}`}
                      onClick={closeView}
                    >
                      New Agreement
                    </Link>
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
                      className="btn secondary btn-compact"
                      disabled={docBusy}
                      onClick={() => uploadDocRef.current?.click()}
                    >
                      {docBusy ? 'Uploading…' : 'Upload signed copy'}
                    </button>
                  </div>
                )}
                {!canManageAgreements && (
                  <p className="muted">Contact an administrator to create an agreement.</p>
                )}
              </div>
            )}

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
        </div>
      )}
    </>
  );

  if (embedded) {
    return (
      <div className="inv-page">
        {!setPageActions ? (
          <div className="product-master-toolbar" style={{ marginBottom: 12 }}>
            <div>
              <h3 className="product-master-title" style={{ margin: 0 }}>
                {scopedType || NAV.ASSETS_OVERVIEW}
                <span className="inv-count" aria-label={`${meta.total} total assets`}>
                  {meta.total.toLocaleString()} assets
                </span>
              </h3>
            </div>
            {headerActions}
          </div>
        ) : null}
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
