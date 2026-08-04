import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import html2pdf from 'html2pdf.js';
import {
  IconBack,
  IconDownload,
  IconPanel,
  IconPrint,
  IconRefresh,
  IconTrash,
  IconZoomIn,
  IconZoomOut,
} from './icons.jsx';
import { usePreviewScale } from './usePreviewScale.js';

/**
 * Premium document studio shell — preview-first canvas with collapsible edit panel.
 * Used by Invoice, Proforma, Purchase Order, and Credit Note generators.
 */
export default function DocumentGeneratorShell({
  title,
  docNumber,
  docTypeLabel,
  savedAt,
  statusMessage,
  statusVariant = 'info',
  accent = 'navy',
  filename,
  summarySlot,
  panelFooter,
  panelPosition = 'right',
  previewMode = 'html',
  previewIframe,
  defaultPanelOpen = true,
  guidePane,
  onReset,
  onClear,
  onPrint,
  onDownload,
  downloadBusy: downloadBusyProp,
  formPane,
  previewNode,
}) {
  const previewRef = useRef(null);
  const [internalBusy, setInternalBusy] = useState(false);
  const [panelOpen, setPanelOpen] = useState(defaultPanelOpen);
  const [mobileTab, setMobileTab] = useState('preview');
  const { wrapRef, scale, zoomIn, zoomOut, fitToWidth } = usePreviewScale();

  const busy = downloadBusyProp ?? internalBusy;

  const handlePrint = () => {
    if (onPrint) {
      onPrint();
      return;
    }
    window.print();
  };

  const handleDownloadPdf = async () => {
    if (onDownload) {
      onDownload();
      return;
    }
    const el = previewRef.current;
    if (!el) return;
    setInternalBusy(true);
    try {
      const clone = el.cloneNode(true);
      clone.style.transform = 'none';
      clone.style.width = '1123px';
      clone.style.height = '794px';
      const wrapper = document.createElement('div');
      wrapper.appendChild(clone);
      document.body.appendChild(wrapper);

      await html2pdf()
        .set({
          margin: 0,
          filename: filename || 'document.pdf',
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, letterRendering: true },
          jsPDF: { unit: 'px', format: [1123, 794], orientation: 'landscape' },
        })
        .from(clone)
        .save();

      document.body.removeChild(wrapper);
    } finally {
      setInternalBusy(false);
    }
  };

  const togglePanel = useCallback(() => {
    setPanelOpen((open) => !open);
  }, []);

  useEffect(() => {
    const id = requestAnimationFrame(() => fitToWidth());
    return () => cancelAnimationFrame(id);
  }, [panelOpen, fitToWidth]);

  const previewWithRef = previewMode === 'html' && previewNode ? previewNode(previewRef) : null;

  const studioClass = [
    'doc-studio',
    `doc-studio--${accent}`,
    panelOpen ? '' : 'doc-studio--panel-closed',
    guidePane ? 'doc-studio--with-guide' : '',
    mobileTab === 'form' ? 'doc-studio--mobile-edit' : 'doc-studio--mobile-preview',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={studioClass}>
      <div
        className={`doc-studio-workspace${panelPosition === 'left' ? ' doc-studio-workspace--panel-left' : ''}${guidePane ? ' doc-studio-workspace--with-guide' : ''}`}
      >
        <section className="doc-studio-canvas" ref={wrapRef} aria-label="Document preview">
          <div className="doc-studio-float-bar" role="toolbar" aria-label="Document actions">
            <div className="doc-studio-float-group doc-studio-float-group--nav">
              <Link to="/finance-one/billing" className="doc-studio-icon-btn" title="All documents">
                <IconBack />
              </Link>
              <div className="doc-studio-float-title">
                <span className="doc-studio-float-name">{title}</span>
                {docTypeLabel ? <span className="doc-studio-float-badge">{docTypeLabel}</span> : null}
              </div>
              <span className="doc-studio-float-id">{docNumber || 'Draft'}</span>
              {savedAt ? (
                <span className="doc-studio-float-saved" title={`Saved ${savedAt.toLocaleTimeString()}`}>
                  <span className="doc-studio-saved-dot" />
                  {savedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              ) : null}
            </div>

            <div className="doc-studio-float-group doc-studio-float-group--actions">
              {summarySlot}
              {onReset ? (
                <button type="button" className="doc-studio-icon-btn" onClick={onReset} title="New number">
                  <IconRefresh />
                </button>
              ) : null}
              {onClear ? (
                <button type="button" className="doc-studio-icon-btn" onClick={onClear} title="Clear draft">
                  <IconTrash />
                </button>
              ) : null}
              <button type="button" className="doc-studio-icon-btn" onClick={handlePrint} title="Print">
                <IconPrint />
              </button>
              <button
                type="button"
                className="doc-studio-btn-primary"
                disabled={busy || (previewMode === 'iframe' && !previewIframe?.url && !onDownload)}
                onClick={handleDownloadPdf}
              >
                <IconDownload />
                <span>{busy ? 'Exporting…' : 'Export PDF'}</span>
              </button>
              <button
                type="button"
                className={`doc-studio-icon-btn doc-studio-panel-toggle${panelOpen ? ' is-active' : ''}`}
                onClick={togglePanel}
                title={panelOpen ? 'Hide panel' : 'Show panel'}
                aria-pressed={panelOpen}
              >
                <IconPanel />
              </button>
            </div>
          </div>

          {statusMessage ? (
            <div className={`doc-studio-toast doc-studio-toast--${statusVariant}`} role="status">
              {statusMessage}
            </div>
          ) : null}

          <div className="doc-studio-canvas-inner">
            {previewMode === 'iframe' ? (
              <div className="doc-studio-iframe-stage">
                {previewIframe?.loading && previewIframe?.url ? (
                  <div className="doc-studio-iframe-loading">Updating…</div>
                ) : null}
                {previewIframe?.error ? (
                  <div className="doc-preview-frame doc-preview-frame--error">{previewIframe.error}</div>
                ) : previewIframe?.url ? (
                  <iframe title="Live preview" className="doc-preview-frame doc-preview-frame--pdf" src={previewIframe.url} />
                ) : (
                  <div className="doc-preview-frame doc-preview-frame--loading">
                    <span className="doc-preview-spinner" />
                    <span>{previewIframe?.loading ? 'Rendering preview…' : 'Preview will appear as you edit'}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="doc-studio-page-stage" style={{ width: 1123 * scale, height: 794 * scale }}>
                <div
                  className="doc-studio-page-scaler"
                  style={{ transform: `scale(${scale})`, width: 1123, height: 794 }}
                >
                  {previewWithRef}
                </div>
              </div>
            )}
          </div>

          {previewMode === 'html' ? (
            <div className="doc-studio-zoom" role="group" aria-label="Zoom">
              <button type="button" className="doc-studio-zoom-btn" onClick={zoomOut} aria-label="Zoom out">
                <IconZoomOut />
              </button>
              <button type="button" className="doc-studio-zoom-pct" onClick={fitToWidth} title="Fit to canvas">
                {Math.round(scale * 100)}%
              </button>
              <button type="button" className="doc-studio-zoom-btn" onClick={zoomIn} aria-label="Zoom in">
                <IconZoomIn />
              </button>
            </div>
          ) : null}
        </section>

        {guidePane ? <div className="doc-studio-guide-rail">{guidePane}</div> : null}

        <aside className="doc-studio-panel" aria-label="Document editor">
          <div className="doc-studio-panel-scroll">{formPane}</div>
          {panelFooter ? <div className="doc-studio-panel-footer">{panelFooter}</div> : null}
        </aside>
      </div>

      <nav className="doc-studio-mobile-nav" aria-label="Edit or preview">
        <button
          type="button"
          className={`doc-studio-mobile-tab${mobileTab === 'preview' ? ' is-active' : ''}`}
          onClick={() => setMobileTab('preview')}
        >
          Preview
        </button>
        <button
          type="button"
          className={`doc-studio-mobile-tab${mobileTab === 'form' ? ' is-active' : ''}`}
          onClick={() => setMobileTab('form')}
        >
          Edit
        </button>
      </nav>
    </div>
  );
}
