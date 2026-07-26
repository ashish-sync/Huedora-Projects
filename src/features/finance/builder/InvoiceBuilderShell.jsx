import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePreviewScale } from '../documentGenerator/usePreviewScale.js';
import { A4_LANDSCAPE_PX } from '../shared/a4Landscape.js';
import { exportDocumentPdf } from './exportInvoicePdf.js';
import './export-invoice.css';

function SaveIndicator({ state, savedAt }) {
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
  return <span className="ib-save ib-save--idle">Autosave on</span>;
}

function ShortcutsModal({ open, onClose, newDocLabel = 'New document' }) {
  if (!open) return null;
  const mod = navigator.platform?.includes('Mac') ? '⌘' : 'Ctrl';
  const rows = [
    [`${mod} + \\`, 'Toggle edit panel'],
    [`${mod} + P`, 'Print'],
    [`${mod} + S`, 'Save & export PDF'],
    [`${mod} + Shift + N`, newDocLabel],
    ['?', 'Show shortcuts'],
  ];
  return (
    <div className="ib-modal-backdrop" onClick={onClose} role="presentation">
      <div className="ib-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Keyboard shortcuts">
        <div className="ib-modal-head">
          <h2>Keyboard shortcuts</h2>
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
      </div>
    </div>
  );
}

export default function InvoiceBuilderShell({
  docTypeLabel = 'Invoice',
  newDocLabel = 'New',
  newDocShortcutLabel = 'New document',
  panelAriaLabel = 'Document fields',
  exportFilePrefix = 'document',
  docNumber,
  grandTotal,
  saveState,
  savedAt,
  panelOpen,
  onTogglePanel,
  onPrint,
  onSaveNow,
  onExportPdf,
  onNewInvoice,
  shortcutsOpen,
  onShortcutsClose,
  onShowShortcuts,
  exportRef,
  panel,
  children,
}) {
  const previewRef = useRef(null);
  const [exporting, setExporting] = useState(false);
  const { wrapRef, scale, zoomIn, zoomOut, fitToWidth } = usePreviewScale();

  const handleSaveAndExport = useCallback(async () => {
    setExporting(true);
    try {
      await onSaveNow?.();
      await new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      });
      if (onExportPdf) {
        onExportPdf();
        return;
      }
      const el = previewRef.current;
      if (!el) return;
      await exportDocumentPdf(el, `${docNumber || exportFilePrefix}.pdf`);
    } catch (err) {
      console.error('Save & export failed', err);
    } finally {
      setExporting(false);
    }
  }, [docNumber, exportFilePrefix, onExportPdf, onSaveNow]);

  useEffect(() => {
    if (exportRef) {
      exportRef.current = handleSaveAndExport;
    }
  }, [exportRef, handleSaveAndExport]);

  useEffect(() => {
    const id = requestAnimationFrame(() => fitToWidth());
    return () => cancelAnimationFrame(id);
  }, [panelOpen, fitToWidth]);

  const shellClass = `ib-shell${panelOpen ? ' ib-shell--panel-open' : ''}`;

  return (
    <div className={shellClass}>
      <header className="ib-toolbar">
        <div className="ib-toolbar-left">
          <Link to="/finance" className="ib-icon-btn" title="Back to Finance" aria-label="Back">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <div className="ib-toolbar-title">
            <span className="ib-toolbar-label">{docTypeLabel}</span>
            <span className="ib-toolbar-doc">{docNumber || 'Draft'}</span>
            <span className="ib-toolbar-sub">Click any field on the document to edit</span>
          </div>
          <SaveIndicator state={saveState} savedAt={savedAt} />
        </div>

        <div className="ib-toolbar-center">
          <span className="ib-total-pill">
            <span className="ib-total-label">Total</span>
            <span className="ib-total-value">₹ {grandTotal}</span>
          </span>
        </div>

        <div className="ib-toolbar-right">
          <button type="button" className="ib-text-btn" onClick={onNewInvoice} title={newDocLabel}>
            {newDocLabel}
          </button>
          <button type="button" className="ib-text-btn" onClick={onShowShortcuts} title="Shortcuts (?)">
            ?
          </button>
          <button type="button" className="ib-text-btn" onClick={onPrint} title="Print (⌘P)">
            Print
          </button>
          <button
            type="button"
            className="ib-primary-btn"
            disabled={exporting}
            onClick={handleSaveAndExport}
            title="Save & export PDF (⌘S)"
          >
            {exporting ? 'Saving…' : 'Save & Export'}
          </button>
          <button
            type="button"
            className={`ib-icon-btn ib-panel-btn${panelOpen ? ' is-active' : ''}`}
            onClick={onTogglePanel}
            title="Toggle panel (⌘\)"
            aria-pressed={panelOpen}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M15 3v18" />
            </svg>
          </button>
        </div>
      </header>

      <div className="ib-workspace">
        <main className="ib-canvas" ref={wrapRef}>
          <div
            className="ib-page-stage"
            style={{ width: A4_LANDSCAPE_PX.w * scale, height: A4_LANDSCAPE_PX.h * scale }}
          >
            <div
              className="ib-page-scaler"
              style={{
                transform: `scale(${scale})`,
                width: A4_LANDSCAPE_PX.w,
                height: A4_LANDSCAPE_PX.h,
                transformOrigin: 'top center',
              }}
            >
              {typeof children === 'function' ? children(previewRef) : children}
            </div>
          </div>
          <div className="ib-zoom" role="group" aria-label="Zoom">
            <button type="button" className="ib-zoom-btn" onClick={zoomOut} aria-label="Zoom out">
              −
            </button>
            <button type="button" className="ib-zoom-pct" onClick={fitToWidth}>
              {Math.round(scale * 100)}%
            </button>
            <button type="button" className="ib-zoom-btn" onClick={zoomIn} aria-label="Zoom in">
              +
            </button>
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
