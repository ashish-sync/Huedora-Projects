import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import { api, apiFetch, downloadExcel } from '../../shared/api.js';
import { fetchContactsList } from '../../shared/contactsApi.js';
import { useDebouncedValue } from '../../shared/useDebouncedValue.js';

import { MODULE, FIELD, NAV, ACTION } from '../../shared/labels.js';
import ImportActionButton from '../../components/ui/ImportActionButton.jsx';
import { normalizeSerialNumber } from '../../shared/textFormat.js';
import { useAuth } from '../../shared/auth.jsx';
import { FeedbackAlerts } from '../../components/ui/FeedbackBanner.jsx';
import AdaptiveSelect from '../../components/ui/AdaptiveSelect.jsx';
import ProductImagesPanel from '../../components/products/ProductImagesPanel.jsx';
import PaginationBar from '../../components/ui/PaginationBar.jsx';
import MasterFilterShell from '../../components/masters/MasterFilterShell.jsx';
import MasterSearchField from '../../components/masters/MasterSearchField.jsx';
import Button from '../../components/ui/Button.jsx';
import Skeleton from '../../components/ui/Skeleton.jsx';
import {
  OWNERSHIP_TYPE_OPTIONS,
  ASSET_STATUS_OPTIONS,
  ASSET_CUSTODY_OPTIONS,
  formatOwnershipType,
  custodyRequiresCustodianContact,
  contactMatchesCustody,
} from '../devices/assetMasterOptions.js';
import { PAGE_SIZES } from '../../shared/validation.js';
import { productAssetName, productOptionLabel } from '../../shared/productMasterLabel.js';
import { collectProductImages } from '../../shared/productImages.js';
import {
  PRODUCT_CLASSIFICATIONS,
  PRODUCT_CATEGORY_KINDS,
  composeProductType,
  decomposeProductType,
} from '../../shared/productTypes.js';
import {
  hasSignedAgreementCopy,
  pickSignedAgreementRecord,
} from './assetAgreementDocs.js';

const emptyForm = {
  productId: '',
  name: '',
  assetType: '',
  productType: 'Medical Device',
  productCategoryKind: 'Device',
  serialNumber: '',
  purchaseMonth: '',
  cost: '',
  agreementStatus: 'Not Initiated',
  custody: '',
  contactId: '',
};

function assetClassificationLabel(productType) {
  return decomposeProductType(productType || 'Medical Device').classification || 'Medical';
}

function assetCategoryKind(productType, productCategoryKind) {
  if (productCategoryKind) return productCategoryKind;
  return decomposeProductType(productType || 'Medical Device').categoryKind || 'Device';
}

function productTypeFromCascade(classification, categoryKind) {
  return composeProductType(classification || 'Medical', categoryKind || 'Device');
}

function categoryOptionLabel(kind) {
  return kind === 'Consumable' ? 'Consumables' : kind;
}

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

const ASSET_MENU_WIDTH = 168;
const ASSET_MENU_GAP = 6;

function AssetRowActionsMenu({ canWrite, onEdit, onView, auditTo }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);
  const panelRef = useRef(null);

  const placeMenu = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const panelHeight = panelRef.current?.offsetHeight || 140;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < panelHeight + ASSET_MENU_GAP && rect.top > spaceBelow;
    const top = openUp
      ? Math.max(8, rect.top - panelHeight - ASSET_MENU_GAP)
      : Math.min(window.innerHeight - panelHeight - 8, rect.bottom + ASSET_MENU_GAP);
    const left = Math.min(
      window.innerWidth - ASSET_MENU_WIDTH - 8,
      Math.max(8, rect.right - ASSET_MENU_WIDTH),
    );
    setCoords({ top, left });
  }, []);

  useLayoutEffect(() => {
    if (!open) return undefined;
    placeMenu();
    const raf = window.requestAnimationFrame(() => placeMenu());
    const onReposition = () => placeMenu();
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [open, placeMenu, canWrite]);

  useEffect(() => {
    if (!open) return undefined;
    function onPointerDown(event) {
      const t = event.target;
      if (triggerRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKeyDown(event) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function run(action) {
    setOpen(false);
    action?.();
  }

  const menu = open
    ? createPortal(
        <div
          ref={panelRef}
          className="inv-actions-panel inv-actions-panel--portal"
          role="menu"
          aria-label="Asset actions"
          style={{ top: coords.top, left: coords.left, width: ASSET_MENU_WIDTH }}
        >
          {canWrite ? (
            <button type="button" role="menuitem" onClick={() => run(onEdit)}>
              Edit
            </button>
          ) : null}
          <button type="button" role="menuitem" onClick={() => run(onView)}>
            Agreement
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => run(() => navigate(auditTo))}
          >
            Audit Trail
          </button>
        </div>,
        document.body,
      )
    : null;

  return (
    <div className="inv-actions-menu">
      <button
        ref={triggerRef}
        type="button"
        className="inv-actions-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Asset actions"
        title="More actions"
        onClick={() => setOpen((v) => !v)}
      >
        ⋯
      </button>
      {menu}
    </div>
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
  const [contacts, setContacts] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const formRef = useRef(null);

  const [viewRow, setViewRow] = useState(null);
  const [viewDocs, setViewDocs] = useState([]);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewError, setViewError] = useState('');
  const [editHasAgreementDoc, setEditHasAgreementDoc] = useState(false);
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
      if (!res.ok) throw new Error('Could not download sample format');
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
    fetchContactsList({
      contactCategory: 'Healthcare Worker',
      limit: 2000,
      fullDirectory: true,
    })
      .then((rows) => setContacts(rows))
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
    const decomposed = decomposeProductType(p.productType, p.productClassification);
    setForm((f) => ({
      ...f,
      productId: p._id,
      name: productAssetName(p) || p.name || '',
      productType: p.productType || f.productType,
      productCategoryKind: decomposed.categoryKind || f.productCategoryKind || 'Device',
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
    const baseType = scopedType || 'Medical Device';
    const { categoryKind } = decomposeProductType(baseType);
    setEditingId('');
    setForm({
      ...emptyForm,
      productType: baseType,
      productCategoryKind: categoryKind || 'Device',
    });
    setFormOpen(true);
    setError('');
    setMsg('');
  };

  const openEdit = (row) => {
    const master = row.deviceMasterId && typeof row.deviceMasterId === 'object' ? row.deviceMasterId : null;
    const productType = row.productType || scopedType || 'Medical Device';
    const { categoryKind } = decomposeProductType(productType);
    const assetId = row._id;
    const initialStatus = row.agreementStatus || 'Not Initiated';
    setEditingId(assetId);
    setEditHasAgreementDoc(false);
    setForm({
      productId: master?.productId || '',
      name: row.deviceNameSnapshot || master?.name || '',
      assetType: row.assetType || master?.assetType || '',
      productType,
      productCategoryKind: categoryKind || 'Device',
      serialNumber: row.serialNumber || '',
      purchaseMonth: purchaseToMonthInput(row.addedMonth || master?.purchaseMonth),
      cost:
        row.deviceValue != null
          ? String(row.deviceValue)
          : master?.cost != null
            ? String(master.cost)
            : '',
      agreementStatus: initialStatus,
      custody: row.custody || '',
      contactId: row.contactId?._id || row.contactId || '',
    });
    setFormOpen(true);
    setError('');
    setMsg('');

    // Existing rows: Agreement Signed only if Actions already has a document.
    api(`/assets/${assetId}/documents`)
      .then(({ data }) => {
        const hasDoc = hasSignedAgreementCopy(data || [], {
          agreementStatus: 'Agreement Signed',
        });
        setEditHasAgreementDoc(hasDoc);
        if (!hasDoc && (initialStatus === 'Agreement Signed' || initialStatus === 'Active')) {
          setForm((f) =>
            f.agreementStatus === 'Agreement Signed' || f.agreementStatus === 'Active'
              ? { ...f, agreementStatus: 'Not Initiated' }
              : f
          );
        }
      })
      .catch(() => {
        setEditHasAgreementDoc(false);
      });
  };

  const closeForm = () => {
    setEditingId('');
    setEditHasAgreementDoc(false);
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
      if (custodyRequiresCustodianContact(form.custody) && !form.contactId) {
        setError(
          form.custody === 'Service Provider'
            ? 'Select a Healthcare Worker with Type “Service Provider” from Contact Directory.'
            : 'Select a Healthcare Worker with Type “Individual” from Contact Directory.'
        );
        setBusy(false);
        return;
      }
      if (custodyRequiresCustodianContact(form.custody) && form.contactId) {
        const selected = contacts.find((c) => c._id === form.contactId);
        if (selected && !contactMatchesCustody(selected, form.custody)) {
          setError(
            form.custody === 'Service Provider'
              ? 'Custodian Contact must be a Healthcare Worker with Type “Service Provider”.'
              : 'Custodian Contact must be a Healthcare Worker with Type “Individual”.'
          );
          setBusy(false);
          return;
        }
      }
      if (form.agreementStatus === 'Agreement Signed') {
        if (!editingId) {
          setError(
            'Asset Status cannot be Agreement Signed until a document is uploaded under Actions.'
          );
          setBusy(false);
          return;
        }
        try {
          const { data: docs } = await api(`/assets/${editingId}/documents`);
          if (!hasSignedAgreementCopy(docs || [], { agreementStatus: 'Agreement Signed' })) {
            setError(
              'Asset Status cannot be Agreement Signed until a document is uploaded under Actions.'
            );
            setBusy(false);
            return;
          }
        } catch (docErr) {
          setError(docErr.message || 'Could not verify agreement document.');
          setBusy(false);
          return;
        }
      }
      const shared = {
        ...(form.productId ? { productId: form.productId } : {}),
        name: form.name.trim(),
        assetType: form.assetType,
        productType:
          scopedType ||
          form.productType ||
          productTypeFromCascade(
            assetClassificationLabel(form.productType),
            form.productCategoryKind
          ) ||
          'Medical Device',
        serialNumber: normalizeSerialNumber(form.serialNumber),
        purchaseMonth: form.purchaseMonth,
        cost: Number(form.cost),
        agreementStatus: form.agreementStatus,
        custody: form.custody,
        ...(custodyRequiresCustodianContact(form.custody) || form.contactId
          ? { contactId: form.contactId || null }
          : {}),
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

  useEffect(() => {
    if (!viewRow) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') closeView();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [viewRow, previewUrl]);

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
              <ImportActionButton
                canImport
                hasSample
                compact
                onImport={runImport}
                onSample={downloadSample}
                importBusy={importBusy}
                accept=".csv,.xlsx,.xls,.xlsb,text/csv"
              />
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

      {canWrite && formOpen ? (
        <>
          <div
            className="cd-drawer-backdrop"
            onClick={() => !busy && closeForm()}
            aria-hidden="true"
          />
          <aside
            className={`cd-drawer cd-drawer--wide${editingId ? ' cd-drawer--editing' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="asset-drawer-heading"
            aria-label={editingId ? 'Edit asset' : 'Add asset'}
          >
            <div className="cd-drawer-header">
              <div className="cd-drawer-header-copy">
                <span className="cd-drawer-kicker">
                  {editingId ? 'Edit Asset Record' : 'New Asset Record'}
                </span>
                <h3 id="asset-drawer-heading" className="cd-drawer-title">
                  {editingId ? 'Edit asset' : 'Add asset'}
                </h3>
              </div>
              <button
                type="button"
                className="cd-drawer-close-btn"
                onClick={() => !busy && closeForm()}
                aria-label="Close drawer"
                title="Close"
                disabled={busy}
              >
                ×
              </button>
            </div>
            <form ref={formRef} className="cd-drawer-form asset-drawer-form" onSubmit={save}>
              <div className="cd-drawer-scroll">
                <section className="cd-form-section is-open asset-drawer-section">
                  <h4 className="cd-section-title">Asset details</h4>
                  <div className="cd-form-grid">
                    <div className="field">
                      <label htmlFor="asset-product-type">{FIELD.ASSET_TYPE} *</label>
                      <AdaptiveSelect
                        id="asset-product-type"
                        threshold={1}
                        required
                        value={assetClassificationLabel(form.productType || scopedType || 'Medical Device')}
                        onChange={(e) => {
                          const classification = e.target.value;
                          const categoryKind = assetCategoryKind(
                            form.productType,
                            form.productCategoryKind
                          );
                          setForm({
                            ...form,
                            productType: productTypeFromCascade(classification, categoryKind),
                            productCategoryKind: categoryKind,
                            productId: '',
                            name: '',
                            cost: '',
                          });
                        }}
                        disabled={Boolean(scopedType)}
                      >
                        {PRODUCT_CLASSIFICATIONS.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </AdaptiveSelect>
                    </div>
                    <div className="field">
                      <label htmlFor="asset-product-category">Product Category *</label>
                      <AdaptiveSelect
                        id="asset-product-category"
                        threshold={1}
                        required
                        value={assetCategoryKind(form.productType, form.productCategoryKind)}
                        onChange={(e) => {
                          const categoryKind = e.target.value;
                          const classification = assetClassificationLabel(
                            form.productType || scopedType || 'Medical Device'
                          );
                          setForm({
                            ...form,
                            productType: productTypeFromCascade(classification, categoryKind),
                            productCategoryKind: categoryKind,
                            productId: '',
                            name: '',
                            cost: '',
                          });
                        }}
                        disabled={Boolean(scopedType)}
                      >
                        {PRODUCT_CATEGORY_KINDS.map((c) => (
                          <option key={c} value={c}>
                            {categoryOptionLabel(c)}
                          </option>
                        ))}
                      </AdaptiveSelect>
                    </div>
                    <div className="field cd-span-2">
                      <label htmlFor="asset-product-id">Display Name *</label>
                      <AdaptiveSelect
                        id="asset-product-id"
                        threshold={1}
                        required={!editingId}
                        value={form.productId}
                        onChange={(e) => pickProduct(e.target.value)}
                        placeholder="Select Display Name from Product Master…"
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
                        threshold={1}
                        required
                        value={form.assetType}
                        onChange={(e) => setForm({ ...form, assetType: e.target.value })}
                        placeholder="Select ownership type"
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
                      <label htmlFor="asset-status">{FIELD.ASSET_STATUS} *</label>
                      <AdaptiveSelect
                        id="asset-status"
                        threshold={1}
                        required
                        value={form.agreementStatus}
                        onChange={(e) => setForm({ ...form, agreementStatus: e.target.value })}
                      >
                        {ASSET_STATUS_OPTIONS.filter(
                          (o) => o !== 'Agreement Signed' || editHasAgreementDoc
                        ).map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </AdaptiveSelect>
                      {!editHasAgreementDoc && (
                        <p className="field-hint muted">
                          Set Agreement Signed from Actions after uploading a document.
                        </p>
                      )}
                    </div>
                    <div className="field">
                      <label htmlFor="asset-custody">{FIELD.ASSET_CUSTODY} *</label>
                      <AdaptiveSelect
                        id="asset-custody"
                        threshold={1}
                        required
                        value={form.custody}
                        onChange={(e) => {
                          const next = e.target.value;
                          setForm((f) => {
                            const patch = { ...f, custody: next };
                            if (!custodyRequiresCustodianContact(next)) {
                              patch.contactId = '';
                            } else if (f.contactId) {
                              const current = contacts.find((c) => c._id === f.contactId);
                              if (!current || !contactMatchesCustody(current, next)) {
                                patch.contactId = '';
                              }
                            }
                            return patch;
                          });
                        }}
                        placeholder="Select custody"
                      >
                        <option value="">Select custody</option>
                        {ASSET_CUSTODY_OPTIONS.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </AdaptiveSelect>
                    </div>
                    {custodyRequiresCustodianContact(form.custody) ? (
                      <div className="field">
                        <label htmlFor="asset-custodian-contact">{FIELD.CUSTODIAN_CONTACT} *</label>
                        <AdaptiveSelect
                          id="asset-custodian-contact"
                          threshold={1}
                          required
                          value={form.contactId}
                          onChange={(e) => setForm({ ...form, contactId: e.target.value })}
                          placeholder="Select Contact Directory record"
                        >
                          <option value="">Select Contact Directory record</option>
                          {contacts
                            .filter((contact) => contactMatchesCustody(contact, form.custody))
                            .map((contact) => (
                              <option key={contact._id} value={contact._id}>
                                {contact.name}
                                {contact.contact
                                  ? ` · ${contact.contact}`
                                  : contact.email
                                    ? ` · ${contact.email}`
                                    : ''}
                                {contact.resourceType ? ` · ${contact.resourceType}` : ''}
                              </option>
                            ))}
                        </AdaptiveSelect>
                      </div>
                    ) : null}
                    <div
                      className={`field${custodyRequiresCustodianContact(form.custody) ? ' cd-span-2' : ''}`}
                    >
                      <label htmlFor="asset-serial">Serial Number *</label>
                      <input
                        id="asset-serial"
                        required
                        value={form.serialNumber}
                        onChange={(e) => setForm({ ...form, serialNumber: e.target.value })}
                        placeholder="SN-1001"
                      />
                    </div>
                    {form.productId && selectedProductImages.length > 0 ? (
                      <div className="field cd-span-2 asset-product-images-field">
                        <label>Product reference images</label>
                        <ProductImagesPanel
                          product={selectedProduct}
                          compact
                          title="Product reference images"
                          hint="From Product Master: for visual identification."
                        />
                      </div>
                    ) : null}
                  </div>
                </section>
              </div>
              <div className="cd-drawer-footer">
                <Button variant="secondary" type="button" size="compact" disabled={busy} onClick={closeForm}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit" size="compact" loading={busy}>
                  {editingId ? 'Save changes' : 'Add asset'}
                </Button>
              </div>
            </form>
          </aside>
        </>
      ) : null}

      <MasterFilterShell
        actions={
          <Button variant="secondary" size="compact" onClick={runSearch}>
            Refresh
          </Button>
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
              {loading && !rows.length ? (
                Array.from({ length: 5 }).map((_, r) => (
                  <tr key={`skeleton-${r}`}>
                    <td style={{ padding: '12px 14px' }}><Skeleton width="65%" height="14px" /></td>
                    <td style={{ padding: '12px 14px' }}><Skeleton width="85%" height="15px" /></td>
                    <td style={{ padding: '12px 14px' }}><Skeleton width="70%" height="14px" /></td>
                    <td style={{ padding: '12px 14px' }}><Skeleton width="75%" height="14px" /></td>
                    <td style={{ padding: '12px 14px' }}><Skeleton width="90px" height="22px" borderRadius="999px" /></td>
                    <td style={{ padding: '12px 14px' }}><Skeleton width="60%" height="14px" /></td>
                    <td style={{ padding: '12px 14px' }}><Skeleton width="70%" height="14px" /></td>
                    <td style={{ padding: '12px 14px' }}><Skeleton width="55%" height="14px" /></td>
                    <td style={{ padding: '12px 14px' }}><Skeleton width="32px" height="28px" /></td>
                  </tr>
                ))
              ) : (
                rows.map((a) => (
                <tr key={a._id}>
                  <td className="inv-muted-cell">
                    {assetClassificationLabel(a.productType || 'Medical Device')}
                  </td>
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
                    <AssetRowActionsMenu
                      canWrite={canWrite}
                      onEdit={() => openEdit(a)}
                      onView={() => openView(a)}
                      auditTo={`/asset-one/assets/${a._id}`}
                    />
                  </td>
                </tr>
              ))
              )}
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
                        <Button variant="primary" onClick={openCreate}>+ Add asset</Button>
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
            className={`inv-modal inv-modal-wide inv-modal--agreement${previewUrl ? ' inv-modal--preview-open' : ''}${!viewLoading && hasSignedCopy ? ' inv-modal--signed' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="inv-view-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="inv-view-title" className="sr-only">
              {MODULE.ASSET_AGREEMENT}
              {viewRow.deviceNameSnapshot ? ` — ${viewRow.deviceNameSnapshot}` : ''}
              {viewRow.serialNumber ? ` · ${viewRow.serialNumber}` : ''}
            </h2>

            {viewError && <p className="error">{viewError}</p>}
            {viewLoading && <p className="muted">Loading agreement…</p>}

            {!viewLoading && hasSignedCopy && viewSignedRecord && (
              <div className="inv-agreement-signed">
                <div className="inv-agreement-toolbar" role="toolbar" aria-label="Agreement actions">
                  <span className="inv-agreement-chip">
                    {viewSignedRecord.agreement.agreementNumber || 'Agreement'}
                  </span>
                  {viewSignedRecord.agreement.status ? (
                    <span className="inv-agreement-chip inv-agreement-chip--status">
                      {viewSignedRecord.agreement.status}
                    </span>
                  ) : null}
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
                    <Button
                      variant="secondary"
                      size="compact"
                      disabled={docBusy}
                      onClick={() => {
                        setReplaceTargetId(viewSignedRecord.agreement._id);
                        replaceDocRef.current?.click();
                      }}
                    >
                      Replace file
                    </Button>
                  )}
                  <Button
                    className="inv-agreement-toolbar__close"
                    variant="secondary"
                    size="compact"
                    onClick={closeView}
                  >
                    Close
                  </Button>
                </div>
                {previewUrl ? (
                  <div className="inv-pdf-preview">
                    <iframe
                      title={previewTitle || 'Signed agreement'}
                      src={previewUrl}
                      className="inv-pdf-frame"
                    />
                  </div>
                ) : (
                  <p className="muted inv-agreement-preview-hint">
                    Signed file is available — open it again from Document One if needed.
                  </p>
                )}
              </div>
            )}

            {!viewLoading && !hasSignedCopy && (
              <div className="inv-agreement-empty">
                <div className="inv-modal-head">
                  <div className="inv-modal-head-copy">
                    <p className="inv-agreement-empty-title">{MODULE.ASSET_AGREEMENT}</p>
                    <p className="muted inv-modal-sub">
                      {viewRow.deviceNameSnapshot}
                      {viewRow.serialNumber ? ` · ${viewRow.serialNumber}` : ''}
                    </p>
                  </div>
                  <Button variant="secondary" size="compact" onClick={closeView}>
                    Close
                  </Button>
                </div>
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
                    <Button
                      variant="secondary"
                      size="compact"
                      disabled={docBusy}
                      onClick={() => uploadDocRef.current?.click()}
                    >
                      {docBusy ? 'Uploading…' : 'Upload signed copy'}
                    </Button>
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
