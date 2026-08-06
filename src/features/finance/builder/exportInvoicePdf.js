import html2pdf from 'html2pdf.js';
import { pageSpec } from '../shared/a4Landscape.js';
import { formatDisplayDate } from '../invoiceGenerator/invoiceCalculations.js';

function waitForLayout() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

function replaceInputsWithText(root) {
  root.querySelectorAll('input, textarea, select').forEach((el) => {
    const span = document.createElement('span');
    span.className = 'ti-export-text';

    let text = el.value ?? el.textContent ?? '';
    if (el.type === 'date' && text) {
      text = formatDisplayDate(text);
    }

    const trimmed = String(text).trim();
    span.textContent = trimmed || '—';

    if (el.classList.contains('ei-inline--right') || el.closest('.ti-r')) {
      span.style.textAlign = 'right';
    }
    if (el.classList.contains('ei-inline--center') || el.closest('.ti-c')) {
      span.style.textAlign = 'center';
    }
    if (el.tagName === 'TEXTAREA') {
      span.style.whiteSpace = 'pre-wrap';
      span.style.display = 'block';
    }
    if (el.closest('.ti-r--strong') || el.closest('.ti-totals-grand')) {
      span.style.fontWeight = '700';
    }

    el.replaceWith(span);
  });

  root.querySelectorAll('button, .ti-add-line, .ei-add-line-btn').forEach((btn) => btn.remove());
}

/**
 * Build a clean, full-size DOM clone for PDF rasterization (no inputs, no UI chrome).
 */
const EXPORT_SELECTORS = '.tylo-invoice, .po-document, .po-doc, .dc-doc, .bos-doc';

export function buildDocumentExportNode(sourceRoot, { orientation = 'landscape' } = {}) {
  const article = sourceRoot?.querySelector?.(EXPORT_SELECTORS) || sourceRoot;
  if (!article) return null;

  const clone = article.cloneNode(true);
  if (clone.classList.contains('po-document') || clone.classList.contains('po-doc')) {
    clone.classList.add('po-document--export');
    clone.classList.add('po-doc--export');
  } else if (clone.classList.contains('dc-doc')) {
    clone.classList.add('dc-doc--export');
  } else {
    clone.classList.add('tylo-invoice--export');
  }
  replaceInputsWithText(clone);

  const { mm } = pageSpec(orientation);
  const host = document.createElement('div');
  host.className = 'ti-export-host';
  if (orientation === 'portrait') {
    host.classList.add('ti-export-host--portrait');
  }
  host.style.width = `${mm.widthMm}mm`;
  host.style.height = `${mm.heightMm}mm`;
  host.setAttribute('aria-hidden', 'true');
  host.appendChild(clone);
  document.body.appendChild(host);

  return { host, clone };
}

export function removeDocumentExportNode(host) {
  if (host?.parentNode) host.parentNode.removeChild(host);
}

/** @deprecated Use buildDocumentExportNode */
export const buildInvoiceExportNode = buildDocumentExportNode;

/** @deprecated Use removeDocumentExportNode */
export const removeInvoiceExportNode = removeDocumentExportNode;

function pdfExportOptions(filename = 'document.pdf', orientation = 'landscape') {
  const { mm, px } = pageSpec(orientation);
  const width = px.w;
  const height = px.h;
  return {
    margin: 0,
    filename,
    image: { type: 'png', quality: 1 },
    html2canvas: {
      scale: 4,
      useCORS: true,
      allowTaint: true,
      letterRendering: true,
      logging: false,
      width,
      height,
      windowWidth: width,
      windowHeight: height,
      backgroundColor: '#ffffff',
      scrollX: 0,
      scrollY: 0,
    },
    jsPDF: {
      unit: 'mm',
      format: [mm.widthMm, mm.heightMm],
      orientation,
      compress: true,
      precision: 16,
    },
    pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
  };
}

/**
 * Render the on-screen commercial document to a PDF blob (shared by Download + Print).
 */
export async function renderDocumentPdfBlob(sourceRoot, filename = 'document.pdf', { orientation = 'landscape' } = {}) {
  const built = buildDocumentExportNode(sourceRoot, { orientation });
  if (!built) throw new Error('Nothing to export');

  const { host, clone } = built;
  try {
    await waitForLayout();
    const blob = await html2pdf().set(pdfExportOptions(filename, orientation)).from(clone).outputPdf('blob');
    if (!(blob instanceof Blob)) throw new Error('PDF render failed');
    return blob;
  } finally {
    removeDocumentExportNode(host);
  }
}

function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Download commercial document PDF — same render pipeline as Print.
 */
export async function exportDocumentPdf(sourceRoot, filename = 'document.pdf', { orientation = 'landscape' } = {}) {
  const blob = await renderDocumentPdfBlob(sourceRoot, filename, { orientation });
  triggerBlobDownload(blob, filename);
}

/** @deprecated Use exportDocumentPdf */
export const exportInvoicePdf = exportDocumentPdf;

/**
 * Print using the exact same PDF as Download (no separate HTML/server template).
 */
export async function printDocumentPreview(sourceRoot, { title = 'Document', orientation = 'landscape' } = {}) {
  const filename = `${String(title || 'document').replace(/[^\w.-]+/g, '_')}.pdf`;
  const blob = await renderDocumentPdfBlob(sourceRoot, filename, { orientation });
  const url = URL.createObjectURL(blob);
  const { mm } = pageSpec(orientation);

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.setAttribute('title', title);
  Object.assign(iframe.style, {
    position: 'fixed',
    left: '-10000px',
    top: '0',
    width: `${mm.widthMm}mm`,
    height: `${mm.heightMm}mm`,
    border: '0',
    opacity: '1',
    pointerEvents: 'none',
    zIndex: '-1',
  });

  try {
    document.body.appendChild(iframe);

    await new Promise((resolve, reject) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      const fail = (err) => {
        if (settled) return;
        settled = true;
        reject(err);
      };

      iframe.onload = () => {
        const win = iframe.contentWindow;
        if (!win) {
          fail(new Error('Print window unavailable'));
          return;
        }

        const finish = () => done();
        win.addEventListener('afterprint', finish, { once: true });

        // PDF plugin may need a brief moment before print is ready.
        setTimeout(() => {
          try {
            win.focus();
            win.print();
          } catch (err) {
            fail(err);
            return;
          }
          setTimeout(finish, 60_000);
        }, 250);
      };

      iframe.onerror = () => fail(new Error('Failed to load print PDF'));
      iframe.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
  }
}
