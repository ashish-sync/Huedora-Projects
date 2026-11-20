import { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import ModalShell from '../../components/ui/ModalShell.jsx';
import Button from '../../components/ui/Button.jsx';
import {
  applyOrgMasterToInvoiceForm,
  applyOrgMasterToProformaForm,
  applyOrgMasterToPurchaseOrderForm,
  fetchCommercialOrgMaster,
  orgMasterFromDocument,
} from './commercialOrgMaster.js';
import { docTypeLabel } from './commercialDocumentConfig.js';
import { apiDocToForm, loadCommercialDocument } from './builder/builderPersistence.js';
import { exportDocumentPdf, printDocumentPreview } from './builder/exportInvoicePdf.js';
import TaxInvoicePreview from './invoiceGenerator/TaxInvoicePreview.jsx';
import ProformaPreview from './proformaGenerator/ProformaPreview.jsx';
import PurchaseOrderPreview from './purchaseOrder/PurchaseOrderPreview.jsx';
import CreditNotePreview from './creditNote/CreditNotePreview.jsx';
import DebitNotePreview from './debitNote/DebitNotePreview.jsx';
import DeliveryChallanPreview from './deliveryChallan/DeliveryChallanPreview.jsx';
import BillOfSupplyPreview from './billOfSupply/BillOfSupplyPreview.jsx';
import QuotationPreview from './quotation/QuotationPreview.jsx';

function applyOrgForType(documentType, form, master) {
  if (documentType === 'purchase_order') {
    return applyOrgMasterToPurchaseOrderForm(form, master);
  }
  if (documentType === 'proforma') {
    return applyOrgMasterToProformaForm(form, master);
  }
  if (documentType === 'delivery_challan') {
    const next = applyOrgMasterToInvoiceForm(form, master);
    return {
      ...next,
      from: {
        ...next.from,
        companyName: next.company?.legalName || '',
        address: next.company?.address || '',
        gstin: next.company?.gstin || '',
        mobile: next.company?.phone || '',
        email: next.company?.email || '',
        contactPerson: next.from?.contactPerson || '',
      },
    };
  }
  return applyOrgMasterToInvoiceForm(form, master);
}

export function pageOrientationForType(documentType) {
  return documentType === 'purchase_order' ? 'portrait' : 'landscape';
}

function PreviewBody({ documentType, form, previewRef }) {
  const common = { form, previewRef, editable: false };
  switch (documentType) {
    case 'proforma':
      return <ProformaPreview {...common} />;
    case 'purchase_order':
      return <PurchaseOrderPreview {...common} />;
    case 'credit_note':
      return <CreditNotePreview {...common} />;
    case 'debit_note':
      return <DebitNotePreview {...common} />;
    case 'delivery_challan':
      return <DeliveryChallanPreview {...common} />;
    case 'bill_of_supply':
      return <BillOfSupplyPreview {...common} />;
    case 'quotation':
      return <QuotationPreview {...common} />;
    case 'client_invoice':
    default:
      return <TaxInvoicePreview {...common} />;
  }
}

/**
 * Load a saved commercial document into the same form shape the builder preview uses.
 */
export async function loadCommercialDocumentPreviewForm(documentType, id) {
  const doc = await loadCommercialDocument(id);
  const type = doc.documentType || documentType;
  if (doc.documentType && documentType && doc.documentType !== documentType) {
    throw new Error('Document type does not match');
  }
  let liveMaster = null;
  try {
    liveMaster = await fetchCommercialOrgMaster(doc.orgProfileId || 'default');
  } catch {
    liveMaster = null;
  }
  const master = orgMasterFromDocument(doc, liveMaster);
  const form = applyOrgForType(type, apiDocToForm(type, doc), master);
  return { doc, form, documentType: type, master };
}

/**
 * Mount the builder HTML canvas off-screen and run Download/Print against it.
 */
export async function runWithCommercialHtmlPreview(documentType, id, fn) {
  const payload = await loadCommercialDocumentPreviewForm(documentType, id);
  const orientation = pageOrientationForType(payload.documentType);
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText =
    'position:fixed;left:-14000px;top:0;width:1400px;opacity:0;pointer-events:none;z-index:-1;';
  document.body.appendChild(host);
  const root = createRoot(host);
  const previewRef = { current: null };
  try {
    flushSync(() => {
      root.render(
        <div className="finance-html-preview-canvas" data-orientation={orientation}>
          <PreviewBody
            documentType={payload.documentType}
            form={payload.form}
            previewRef={previewRef}
          />
        </div>,
      );
    });
    await new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
    if (!previewRef.current) throw new Error('Document preview failed to render');
    return await fn(previewRef.current, { ...payload, orientation });
  } finally {
    root.unmount();
    host.remove();
  }
}

/**
 * Billing Center document-number viewer — HTML canvas identical to the builder.
 */
export default function CommercialDocumentHtmlPreviewModal({
  open = false,
  row = null,
  onClose,
  onError,
}) {
  const previewRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(null);
  const [documentType, setDocumentType] = useState('');
  const [title, setTitle] = useState('Document');
  const [subtitle, setSubtitle] = useState('');
  const [busy, setBusy] = useState('');

  useEffect(() => {
    if (!open || !row?._id) {
      setForm(null);
      setDocumentType('');
      setBusy('');
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setForm(null);
    setBusy('');
    setTitle(row.documentNumber || 'Document');
    setSubtitle(`${docTypeLabel(row.documentType)} · ${row.recipientName || '—'}`);

    loadCommercialDocumentPreviewForm(row.documentType, row._id)
      .then((payload) => {
        if (cancelled) return;
        setDocumentType(payload.documentType);
        setForm(payload.form);
        if (payload.doc?.documentNumber) setTitle(payload.doc.documentNumber);
      })
      .catch((err) => {
        if (cancelled) return;
        onError?.(err?.message || 'Unable to open document preview');
        onClose?.();
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, row?._id, row?.documentType, row?.documentNumber, row?.recipientName, onClose, onError]);

  const orientation = useMemo(
    () => pageOrientationForType(documentType || row?.documentType),
    [documentType, row?.documentType],
  );

  const handleDownload = async () => {
    const el = previewRef.current;
    if (!el || busy) return;
    setBusy('download');
    try {
      const fileName = `${String(title || 'document').replace(/[^\w.-]+/g, '_')}.pdf`;
      await exportDocumentPdf(el, fileName, { orientation });
    } catch (err) {
      onError?.(err?.message || 'Unable to download document');
    } finally {
      setBusy('');
    }
  };

  const handlePrint = async () => {
    const el = previewRef.current;
    if (!el || busy) return;
    setBusy('print');
    try {
      await printDocumentPreview(el, { title, orientation });
    } catch (err) {
      onError?.(err?.message || 'Unable to print document');
    } finally {
      setBusy('');
    }
  };

  if (!open) return null;

  return (
    <ModalShell
      open
      onClose={busy ? undefined : onClose}
      title={title}
      overlayClassName="modal-overlay finance-pdf-preview-overlay"
      panelClassName={`modal-card finance-pdf-preview-modal finance-html-preview-modal finance-html-preview-modal--${orientation}`}
    >
      {subtitle ? <p className="muted finance-pdf-preview-meta">{subtitle}</p> : null}
      <div className="finance-pdf-preview-frame finance-html-preview-frame">
        {loading || !form ? (
          <div className="finance-html-preview-loading muted">
            {loading ? 'Loading document…' : 'Preparing preview…'}
          </div>
        ) : (
          <div className="finance-html-preview-canvas" data-orientation={orientation}>
            <PreviewBody documentType={documentType} form={form} previewRef={previewRef} />
          </div>
        )}
      </div>
      <div className="modal-actions finance-pdf-preview-actions">
        <Button variant="secondary" disabled={Boolean(busy)} onClick={onClose}>
          Close
        </Button>
        <Button
          variant="secondary"
          disabled={!form || Boolean(busy)}
          loading={busy === 'download'}
          onClick={handleDownload}
        >
          {busy === 'download' ? 'Downloading…' : 'Download'}
        </Button>
        <Button
          variant="primary"
          disabled={!form || Boolean(busy)}
          loading={busy === 'print'}
          onClick={handlePrint}
        >
          {busy === 'print' ? 'Preparing…' : 'Print'}
        </Button>
      </div>
    </ModalShell>
  );
}
