import html2pdf from 'html2pdf.js';
import { A4_LANDSCAPE, A4_LANDSCAPE_PX } from '../shared/a4Landscape.js';
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
const EXPORT_SELECTORS = '.tylo-invoice, .po-document';

export function buildDocumentExportNode(sourceRoot) {
  const article = sourceRoot?.querySelector?.(EXPORT_SELECTORS) || sourceRoot;
  if (!article) return null;

  const clone = article.cloneNode(true);
  if (clone.classList.contains('po-document')) {
    clone.classList.add('po-document--export');
  } else {
    clone.classList.add('tylo-invoice--export');
  }
  replaceInputsWithText(clone);

  const host = document.createElement('div');
  host.className = 'ti-export-host';
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

/**
 * Export commercial document DOM to a crisp A4 landscape PDF (297 × 210 mm).
 */
export async function exportDocumentPdf(sourceRoot, filename = 'document.pdf') {
  const built = buildDocumentExportNode(sourceRoot);
  if (!built) throw new Error('Nothing to export');

  const { host, clone } = built;

  try {
    await waitForLayout();

    const width = A4_LANDSCAPE_PX.w;
    const height = A4_LANDSCAPE_PX.h;

    await html2pdf()
      .set({
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
          format: [A4_LANDSCAPE.widthMm, A4_LANDSCAPE.heightMm],
          orientation: 'landscape',
          compress: true,
          precision: 16,
        },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
      })
      .from(clone)
      .save();
  } finally {
    removeDocumentExportNode(host);
  }
}

/** @deprecated Use exportDocumentPdf */
export const exportInvoicePdf = exportDocumentPdf;
