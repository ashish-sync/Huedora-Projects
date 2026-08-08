import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { api, apiFetch, downloadExcel } from '../../shared/api.js';
import { useDebouncedValue } from '../../shared/useDebouncedValue.js';

import { MODULE, FIELD, NAV, ACTION } from '../../shared/labels.js';
import { formatTextValue } from '../../shared/textFormat.js';
import { useAuth } from '../../shared/auth.jsx';
import { FeedbackAlerts } from '../../components/ui/FeedbackBanner.jsx';
import AdaptiveSelect from '../../components/ui/AdaptiveSelect.jsx';
import ProductImagesPanel from '../../components/products/ProductImagesPanel.jsx';
import PaginationBar from '../../components/ui/PaginationBar.jsx';
import MasterFilterShell from '../../components/masters/MasterFilterShell.jsx';
import MasterSearchField from '../../components/masters/MasterSearchField.jsx';
import {
  OWNERSHIP_TYPE_OPTIONS,
  ASSET_STATUS_OPTIONS,
  ASSET_CUSTODY_OPTIONS,
  formatOwnershipType,
} from '../devices/assetMasterOptions.js';
import { PAGE_SIZES } from '../../shared/validation.js';
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
  cost: '',
  agreementStatus: 'Not Initiated',
  custody: '',
  peripheralRemarks: '',
};

function assetStatusTone(status) {
  const s = String(status || '');
  if (s === 'Agreement Signed' || s === 'Active') return 'ok';
  if (['Tylo Office', 'Under Repairs'].includes(s)) return 'info';
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
  const debouncedQ = useDebouncedValue(q, 300);
  const [agreementStatus, setAgreementStatus] = useState('');
  const [custody, setCustody] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);

  const [products, setProducts] = useState([]);
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
      if (!res.ok) throw new Error('Could not download sample CSV');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Asset_Inventory_Sample.csv';
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
      if (debouncedQ.trim()) params.set('q', debouncedQ.trim());
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
  }, [page, limit, debouncedQ, agreementStatus, custody, scopedType]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api('/logistics/products?limit=500&isActive=true')
      .then((r) => setProducts(r.data || []))
      .catch(() => {});
  }, []);

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
      setForm((f) => ({ ...f, productId: '', name: '', cost: '' }));
      return;
    }
    const productCost = p.standardCost ?? p.defaultPerUnitCost ?? p.purchaseCost;
    setForm((f) => ({
      ...f,
      productId: p._id,
      name: productAssetName(p) || p.name || '',
      productType: p.productType || f.productType,
      cost:
        productCost === '' || productCost == null
          ? f.cost
          : String(productCost),
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
      cost:
        row.deviceValue != null
          ? String(row.deviceValue)
          : master?.cost != null
            ? String(master.cost)
            : '',
      agreementStatus: row.agreementStatus || 'Not Initiated',
      custody: row.custody || '',
      peripheralRemarks: row.remarks || master?.description || '',
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
        setError('Select Display Name from Product Master.');
        setBusy(false);
        return;
      }
      if (form.cost === '' || form.cost == null || !Number.isFinite(Number(form.cost)) || Number(form.cost) < 0) {
        setError('Purchase Amount is required and must be zero or greater.');
        setBusy(false);
        return;
      }
      const shared = {
        ...(form.productId ? { productId: form.productId } : {}),
        name: form.name.trim(),
        assetType: form.assetType,
        productType: scopedType || form.productType || 'Medical Device',
        serialNumber: form.serialNumber.trim(),
        purchaseMonth: form.purchaseMonth,
        cost: Number(form.cost),
        agreementStatus: form.agreementStatus,
        custody: form.custody,
        description: formatTextValue(form.peripheralRemarks, 'peripheralRemarks'),
      };
      if (editingId) {
        await api(`/assets/${editingId}`, {
          method: 'PATCH',
          body: shared,
        });
        setMsg('Asset updated.');
      } else {
        const { data } = await api('/devices', {
          method: 'POST',
          body: shared,
        });
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

  const refreshDocs = async (assetId) => {
    const { data } = await api(`/assets/${assetId}/documents`);
    const docs = data || [];
    setViewDocs(docs);
    return docs;
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
            className="btn btn-compact"
            type="button"
            disabled={exportBusy}
            onClick={downloadInventory}
          >
            {exportBusy ? ACTION.DOWNLOADING : ACTION.DOWNLOAD}
          </button>
          {canWrite ? (
            <>
              <button className="btn secondary btn-compact" type="button" onClick={downloadSample}>
                {ACTION.SAMPLE_FORMAT}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.xlsx,.xls,.xlsb,text/csv"
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
                {importBusy ? ACTION.IMPORTING : ACTION.IMPORT}
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
                Register product, serial, purchase details, ownership, status, and custody.
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
                        cost: '',
                      })
                    }
                    disabled={Boolean(scopedType)}
                  >
                    <option value="Medical Device">Medical Device</option>
                    <option value="Non-Medical Device">Non-Medical Device</option>
                  </AdaptiveSelect>
                </div>
                <div className="field">
                  <label htmlFor="asset-product-id">Display Name *</label>
                  <AdaptiveSelect
                    id="asset-product-id"
                    required={!editingId}
                    value={form.productId}
                    onChange={(e) => pickProduct(e.target.value)}
                  >
                    <option value="">Select Display Name from Product Master…</option>
                    {productsForType.map((p) => (
                      <option key={p._id} value={p._id}>
                        {productOptionLabel(p)}
                      </option>
                    ))}
                  </AdaptiveSelect>
                </div>
                <div className="field">
                  <label htmlFor="asset-serial">Serial Number *</label>
                  <input
                    id="asset-serial"
                    required
                    value={form.serialNumber}
                    onChange={(e) => setForm({ ...form, serialNumber: e.target.value })}
                    placeholder="SN-1001"
                  />
                </div>
              </div>
              <div className="asset-form-row asset-form-row-3">
                <div className="field">
                  <label htmlFor="asset-purchase">{FIELD.PURCHASE_MONTH} *</label>
                  <input
                    id="asset-purchase"
                    required
                    type="month"
                    value={form.purchaseMonth}
                    onChange={(e) => setForm({ ...form, purchaseMonth: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label htmlFor="asset-cost">{FIELD.ASSET_VALUE} *</label>
                  <input
                    id="asset-cost"
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.cost}
                    onChange={(e) => setForm({ ...form, cost: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
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
              </div>
              <div className="asset-form-row asset-form-row-3">
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
                  <label htmlFor="asset-peripheral-remarks">{FIELD.ASSET_PERIPHERAL_DETAILS}</label>
                  <input
                    id="asset-peripheral-remarks"
                    type="text"
                    value={form.peripheralRemarks}
                    onChange={(e) => setForm({ ...form, peripheralRemarks: e.target.value })}
                    placeholder="Optional remarks about asset or peripherals"
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

      <MasterFilterShell
        actions={
          <button className="btn secondary btn-compact" type="button" onClick={runSearch}>
            Refresh
          </button>
        }
      >
        <MasterSearchField
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && runSearch()}
          placeholder="Search asset name, serial, custodian, city…"
          aria-label="Search assets"
        />
        <AdaptiveSelect
          className="filter-select"
          value={agreementStatus}
          onChange={(e) => {
            setAgreementStatus(e.target.value);
            setPage(1);
          }}
          aria-label={FIELD.ASSET_STATUS}
        >
          <option value="">{FIELD.ALL_ASSET_STATUSES}</option>
          {ASSET_STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </AdaptiveSelect>
        <AdaptiveSelect
          className="filter-select"
          value={custody}
          onChange={(e) => {
            setCustody(e.target.value);
            setPage(1);
          }}
          aria-label={FIELD.ASSET_CUSTODY}
        >
          <option value="">{FIELD.ALL_ASSET_CUSTODY}</option>
          {ASSET_CUSTODY_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </AdaptiveSelect>
      </MasterFilterShell>

      <section className="inv-catalog card card--flush">
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
                        to={`/asset-one/assets/${a._id}`}
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
                      to={`/document-one/${viewSignedRecord.agreement._id}`}
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
                      to={`/document-one/new?assetId=${viewRow._id}`}
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
      description="Register and track devices by type, purchase amount, status, and custody."
      actions={headerActions}
    >
      {main}
    </PageShell>
  );
}
