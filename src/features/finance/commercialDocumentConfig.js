import {
  DOCUMENT_NUMBER_STANDARDS,
  creditNoteNumberExample,
  invoiceNumberExample,
  proformaNumberExample,
  purchaseOrderNumberExample,
} from './documentNumbering.js';

export { DOCUMENT_NUMBER_STANDARDS };

export const COMMERCIAL_DOC_TYPES = [
  {
    key: 'client_invoice',
    slug: 'invoice',
    label: 'Invoice',
    example: invoiceNumberExample,
    apiBase: '/finance/client-invoices',
    pdfPath: (id) => `/finance/client-invoices/${id}/pdf`,
    previewPath: '/finance/client-invoices/preview',
    issuePath: (id) => `/finance/client-invoices/${id}/issue`,
  },
  {
    key: 'purchase_order',
    slug: 'purchase-order',
    label: 'Purchase Order',
    example: purchaseOrderNumberExample,
    apiBase: '/finance/purchase-orders',
    pdfPath: (id) => `/finance/purchase-orders/${id}/pdf`,
    previewPath: '/finance/purchase-orders/preview',
    issuePath: (id) => `/finance/purchase-orders/${id}/issue`,
  },
  {
    key: 'proforma',
    slug: 'proforma',
    label: 'Proforma Invoice',
    example: proformaNumberExample,
    apiBase: '/finance/proformas',
    pdfPath: (id) => `/finance/proformas/${id}/pdf`,
    previewPath: '/finance/proformas/preview',
    issuePath: (id) => `/finance/proformas/${id}/issue`,
  },
  {
    key: 'credit_note',
    slug: 'credit-note',
    label: 'Credit Note',
    example: creditNoteNumberExample,
    apiBase: '/finance/credit-notes',
    pdfPath: (id) => `/finance/credit-notes/${id}/pdf`,
    previewPath: '/finance/credit-notes/preview',
    issuePath: (id) => `/finance/credit-notes/${id}/issue`,
  },
];

export function docTypeBySlug(slug) {
  return COMMERCIAL_DOC_TYPES.find((t) => t.slug === slug) || null;
}

export function docTypeLabel(documentType) {
  return COMMERCIAL_DOC_TYPES.find((t) => t.key === documentType)?.label || documentType;
}
