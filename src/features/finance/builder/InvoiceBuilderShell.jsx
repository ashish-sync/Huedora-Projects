import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../shared/auth.jsx';
import { usePreviewScale } from '../documentGenerator/usePreviewScale.js';
import { canApproveCommercialDocument } from './commercialApproval.js';
import { exportDocumentPdf, printDocumentPreview } from './exportInvoicePdf.js';
import ModalShell from '../../../components/ui/ModalShell.jsx';
import './export-invoice.css';
import './builder.css';

function SaveIndicator({ state, savedAt, status, docId }) {
  if (state === 'saving') {
    return <span className="ib-save ib-save--saving">Saving…</span>;
  }
  if (state === 'saved' && savedAt) {
    return (
      <span className="ib-save ib-save--saved" title={savedAt.toLocaleString()}>
        Saved {savedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </span>
    );
  }
  if (status && status !== 'Draft') {
    return <span className="ib-save ib-save--idle">{status}</span>;
  }
  if (!docId) {
    return (
      <span className="ib-save ib-save--idle" title="Draft is created after at least 2 fields are filled">
        Not saved yet
      </span>
    );
  }
  return <span className="ib-save ib-save--idle">Server autosave</span>;
}

function ShortcutsModal({ open, onClose, newDocLabel = 'New document' }) {
  if (!open) return null;
  const mod = navigator.platform?.includes('Mac') ? '⌘' : 'Ctrl';
  const rows = [
    [`${mod} + \\`, 'Toggle edit panel'],
    [`${mod} + P`, 'Print'],
    [`${mod} + S`, 'Download PDF'],
    [`${mod} + Shift + N`, newDocLabel],
    ['?', 'Show shortcuts'],
  ];
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      titleId="ib-shortcuts-title"
      overlayClassName="ib-modal-backdrop"
      panelClassName="ib-modal"
    >
      <div className="ib-modal-head">
        <h2 id="ib-shortcuts-title">Keyboard shortcuts</h2>
        <button type="button" className="ib-icon-btn" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      <ul className="ib-shortcuts">
        {rows.map(([key, desc]) => (
          <li key={key}>
            <kbd>{key}</kbd>
            <span>{desc}</span>
          </li>
        ))}
      </ul>
    </ModalShell>
  );
}

export default function InvoiceBuilderShell({
  docTypeLabel = 'Invoice',
  newDocLabel = 'New',
  newDocShortcutLabel = 'New document',
  panelAriaLabel = 'Document fields',
  exportFilePrefix = 'document',
  docNumber,
  status = 'Draft',
  grandTotal,
  saveState,
  savedAt,
  docId = null,
  error,
  busyAction = '',
  readOnly = false,
  loadingDoc = false,
  panelOpen,
  onTogglePanel,
  onPrint,
  onSaveNow,
  onSubmit,
  onApprove,
  onReject,
  onIssue,
  onNewInvoice,
  shortcutsOpen,
  onShortcutsClose,
  onShowShortcuts,
  exportRef,
  printRef,
  panel,
  children,
  /** 'landscape' (default) or 'portrait' — Purchase Order uses portrait A4. */
  pageOrientation = 'landscape',
}) {
  const previewRef = useRef(null);
  const autoPrintStarted = useRef(false);
  const [exporting, setExporting] = useState(false);
  const [printing, setPrinting] = useState(false);
  const { wrapRef, scale, zoomIn, zoomOut, resetZoom, fitToWidth, pagePx } = usePreviewScale({
    orientation: pageOrientation,
  });
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const canApprove = canApproveCommercialDocument(user);
  const isDraftLike = status === 'Draft' || status === 'Uploaded' || !status;
  const isSubmitted = status === 'Submitted';
  const wantsPrint = searchParams.get('print') === '1';

  useEffect(() => {
    const id = requestAnimationFrame(() => fitToWidth());
    return () => cancelAnimationFrame(id);
  }, [panelOpen, fitToWidth, pageOrientation]);

  const handleSaveAndExport = useCallback(async () => {
    setExporting(true);
    try {
      await onSaveNow?.();
      await new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      });
      const el = previewRef.current;
      if (!el) throw new Error('Preview not ready');
      await exportDocumentPdf(el, `${docNumber || exportFilePrefix}.pdf`, {
        orientation: pageOrientation,
      });
    } catch (err) {
      console.error('Save & export failed', err);
      window.alert(err?.message || 'PDF download failed');
    } finally {
      setExporting(false);
    }
  }, [docNumber, exportFilePrefix, onSaveNow, pageOrientation]);

  const handlePrint = useCallback(async () => {
    const el = previewRef.current;
    const title = [docTypeLabel, docNumber].filter(Boolean).join(' ').trim() || docTypeLabel;
    setPrinting(true);
    try {
      if (el) {
        await printDocumentPreview(el, { title, orientation: pageOrientation });
        return;
      }
      if (onPrint) {
        onPrint();
        return;
      }
      const prevTitle = document.title;
      document.title = title;
      try {
        window.print();
      } finally {
        document.title = prevTitle;
      }
    } catch (err) {
      console.error('Print failed', err);
      window.alert(err?.message || 'Print failed');
    } finally {
      setPrinting(false);
    }
  }, [docNumber, docTypeLabel, onPrint, pageOrientation]);

  useEffect(() => {
    if (exportRef) {
      exportRef.current = handleSaveAndExport;
    }
  }, [exportRef, handleSaveAndExport]);

  useEffect(() => {
    if (printRef) {
      printRef.current = handlePrint;
    }
  }, [printRef, handlePrint]);

  // Billing Center "Print" opens the builder with ?print=1 — same pipeline as toolbar Print.
  useEffect(() => {
    if (!wantsPrint || loadingDoc || autoPrintStarted.current) return undefined;
    const timer = window.setTimeout(() => {
      if (!previewRef.current || autoPrintStarted.current) return;
      autoPrintStarted.current = true;
      handlePrint().finally(() => {
        const next = new URLSearchParams(searchParams);
        next.delete('print');
        const qs = next.toString();
        navigate(`${window.location.pathname}${qs ? `?${qs}` : ''}`, { replace: true });
      });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [wantsPrint, loadingDoc, handlePrint, navigate, searchParams]);

  const shellClass = `ib-shell${panelOpen ? ' ib-shell--panel-open' : ''}${readOnly ? ' ib-shell--readonly' : ''}`;
  const busy = Boolean(busyAction) || exporting || printing || loadingDoc;
  const resolvedStatus = String(status || 'Draft');
  const hasDocNumber = Boolean(String(docNumber || '').trim());
  const toolbarDocLabel = hasDocNumber ? docNumber : 'Untitled';
  const showStatusPill = hasDocNumber || resolvedStatus !== 'Draft';

  return (
    <div className={shellClass}>
      <header className="ib-toolbar">
        <div className="ib-toolbar-left">
          <Link to="/finance-one/billing" className="ib-icon-btn" title="Back to Billing Center" aria-label="Back">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <div className="ib-toolbar-title">
            <span className="ib-toolbar-label">{docTypeLabel}</span>
            <span className="ib-toolbar-meta">
              <span className="ib-toolbar-doc">{toolbarDocLabel}</span>
              {showStatusPill ? (
                <span className={`ib-status-pill ib-status-pill--${resolvedStatus.toLowerCase()}`}>
                  {resolvedStatus}
                </span>
              ) : null}
            </span>
          </div>
          <SaveIndicator state={saveState} savedAt={savedAt} status={status} docId={docId} />
        </div>

        <div className="ib-toolbar-center">
          <div className="ib-toolbar-cluster">
            {grandTotal != null ? (
              <span className="ib-total-pill">
                <span className="ib-total-label">Total</span>
                <span className="ib-total-value">₹ {grandTotal}</span>
              </span>
            ) : null}
            <div className="ib-zoom" role="group" aria-label="Zoom">
              <button type="button" className="ib-zoom-btn" onClick={zoomOut} aria-label="Zoom out">
                −
              </button>
              <button type="button" className="ib-zoom-pct" onClick={resetZoom} title="Fit page to canvas">
                {Math.round(scale * 100)}%
              </button>
              <button type="button" className="ib-zoom-btn" onClick={zoomIn} aria-label="Zoom in">
                +
              </button>
            </div>
          </div>
        </div>

        <div className="ib-toolbar-right">
          {!isDraftLike ? (
            <button type="button" className="ib-text-btn" onClick={onNewInvoice} title={newDocLabel} disabled={busy}>
              {newDocLabel}
            </button>
          ) : null}
          <button type="button" className="ib-text-btn" onClick={handlePrint} title="Print (⌘P)" disabled={busy}>
            {printing ? 'Preparing…' : 'Print'}
          </button>
          {isDraftLike && onSubmit ? (
            <button
              type="button"
              className="ib-primary-btn"
              disabled={busy}
              onClick={() => onSubmit?.()}
              title="Send to Operations Head or Senior Manager for approval"
            >
              {busyAction === 'submit' ? 'Sending…' : 'Send for approval'}
            </button>
          ) : null}
          {isSubmitted && canApprove && onApprove ? (
            <button
              type="button"
              className="ib-primary-btn"
              disabled={busy}
              onClick={() => onApprove?.()}
              title="Approve document"
            >
              {busyAction === 'approve' ? 'Approving…' : 'Approve'}
            </button>
          ) : null}
          {isSubmitted && canApprove && onReject ? (
            <button
              type="button"
              className="ib-text-btn"
              disabled={busy}
              onClick={() => onReject?.()}
              title="Reject to draft"
            >
              {busyAction === 'reject' ? 'Rejecting…' : 'Reject'}
            </button>
          ) : null}
          {isSubmitted && !canApprove ? (
            <span className="ib-save ib-save--idle" title="Awaiting Operations Head or Senior Manager">
              Awaiting approval
            </span>
          ) : null}
          {!isDraftLike ? (
            <button
              type="button"
              className="ib-text-btn"
              disabled={busy}
              onClick={handleSaveAndExport}
              title="Download PDF (⌘S)"
            >
              {exporting ? 'Preparing PDF…' : 'Download PDF'}
            </button>
          ) : null}
          <button
            type="button"
            className={`ib-icon-btn ib-panel-btn${panelOpen ? ' is-active' : ''}`}
            onClick={onTogglePanel}
            title="Toggle panel (⌘\)"
            aria-label={panelOpen ? 'Hide edit panel' : 'Show edit panel'}
            aria-pressed={panelOpen}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M15 3v18" />
            </svg>
          </button>
        </div>
      </header>

      {error ? (
        <div className="ib-error-banner" role="alert">
          {error}
        </div>
      ) : null}
      {loadingDoc ? (
        <div className="ib-loading-banner" role="status">
          Loading document…
        </div>
      ) : null}

      <div className="ib-workspace">
        <main className="ib-canvas" ref={wrapRef}>
          <div className="ib-canvas-viewport">
            <div
              className="ib-page-stage"
              style={{ width: pagePx.w * scale, height: pagePx.h * scale }}
            >
              <div
                className="ib-page-scaler"
                style={{
                  transform: `scale(${scale})`,
                  width: pagePx.w,
                  height: pagePx.h,
                  transformOrigin: 'top center',
                }}
              >
                {typeof children === 'function' ? children(previewRef) : children}
              </div>
            </div>
          </div>
        </main>

        <aside className={`ib-panel${panelOpen ? ' is-open' : ''}`} aria-label={panelAriaLabel} aria-hidden={!panelOpen}>
          {panel}
        </aside>
      </div>

      <ShortcutsModal open={shortcutsOpen} onClose={onShortcutsClose} newDocLabel={newDocShortcutLabel} />
    </div>
  );
}
