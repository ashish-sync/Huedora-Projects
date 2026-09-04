import { describe, expect, it } from 'vitest';
import { pdfExportOptions } from './exportInvoicePdf.js';

describe('pdfExportOptions', () => {
  it('uses compressed JPEG so Finance exports stay well under 40 MB', () => {
    const opts = pdfExportOptions('tax-invoice.pdf', 'landscape');
    expect(opts.image).toEqual({ type: 'jpeg', quality: 0.92 });
    expect(opts.jsPDF.compress).toBe(true);
    expect(opts.html2canvas.scale).toBe(3);
    expect(opts.html2canvas.scale).toBeLessThan(4);
  });

  it('keeps A4 page size for landscape and portrait', () => {
    const landscape = pdfExportOptions('doc.pdf', 'landscape');
    const portrait = pdfExportOptions('doc.pdf', 'portrait');
    expect(landscape.jsPDF.format).toEqual([297, 210]);
    expect(portrait.jsPDF.format).toEqual([210, 297]);
    expect(landscape.jsPDF.orientation).toBe('landscape');
    expect(portrait.jsPDF.orientation).toBe('portrait');
  });
});
