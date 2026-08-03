import { api, apiFetch } from '../../../shared/api.js';
import { COMMERCIAL_DOC_TYPES } from '../commercialDocumentConfig.js';
import { defaultInvoiceForm, defaultLineItem } from '../invoiceGenerator/invoiceStorage.js';
import {
  defaultLineRow,
  defaultProformaForm,
} from '../proformaGenerator/proformaStorage.js';
import {
  defaultPoLineItem,
  defaultPurchaseOrderForm,
} from '../purchaseOrder/purchaseOrderStorage.js';
import { defaultCreditNoteForm } from '../creditNote/creditNoteStorage.js';

export function docConfig(documentType) {
  return COMMERCIAL_DOC_TYPES.find((t) => t.key === documentType) || null;
}

function trim(v) {
  return v == null ? '' : String(v).trim();
}

function invoiceLikeToPayload(form, documentType) {
  const bill = form.billTo || {};
  const inv = form.invoice || {};
  const adj = form.adjustments || {};
  const ship = form.shipTo || {};
  return {
    clientMasterId: form.clientMasterId || null,
    clientId: form.clientId || null,
    recipientName: trim(bill.name),
    contactPerson: trim(bill.contactPerson),
    contactEmail: trim(bill.email),
    placeOfSupply: trim(inv.placeOfSupply || bill.address),
    deliveryAddress: trim(ship.address || bill.address),
    recipientGstin: trim(bill.gstin),
    recipientPan: trim(bill.pan),
    recipientStateCode: trim(bill.stateCode),
    projectName: trim(inv.projectName),
    reference: trim(inv.poReference || inv.vendorCode),
    cnReference: trim(inv.cnReference),
    dnReference: trim(inv.dnReference),
    receiptVoucher: trim(inv.receiptVoucherNo),
    documentDate: trim(inv.issueDate),
    dueDate: trim(inv.dueDate),
    reverseCharge: trim(inv.reverseCharge) === 'Y' ? 'Y' : 'N',
    cnAmount: adj.cnAmount,
    dnAmount: adj.dnAmount,
    advanceReceived: adj.advanceReceived,
    terms: Array.isArray(form.terms) ? form.terms : [],
    customNotes: trim(form.declaration),
    declaration: trim(form.declaration),
    shipToName: trim(ship.name),
    shipToContactPerson: trim(ship.contactPerson),
    shipToAddress: trim(ship.address),
    vehicleNo: trim(ship.vehicleNo),
    transporterName: trim(ship.transporterName),
    documentNumber: trim(inv.documentNumber),
    lineItems: (form.lineItems || [])
      .filter((row) => trim(row.description) || Number(row.qty) || Number(row.rate))
      .map((row, index) => ({
        description: trim(row.description),
        sacCode: trim(row.hsnSac) || '999316',
        qty: row.qty,
        rate: row.rate,
        discount: row.discount,
        igstRate: row.igstRate,
        cgstRate: row.cgstRate,
        sgstRate: row.sgstRate,
        sortOrder: index + 1,
      })),
    builderForm: form,
    documentType,
  };
}

function proformaToPayload(form) {
  const recipient = form.recipient || {};
  const doc = form.document || {};
  const adj = form.adjustments || {};
  const lineItems = [];
  let sectionTitle = '';
  for (const row of form.rows || []) {
    if (row.type === 'section') {
      sectionTitle = trim(row.title);
      continue;
    }
    if (!trim(row.description) && !Number(row.qty) && !Number(row.rate)) continue;
    lineItems.push({
      sectionTitle,
      description: trim(row.description),
      sacCode: trim(row.hsnSac) || '999316',
      qty: row.qty,
      rate: row.rate,
      discount: row.discount,
      igstRate: row.igstRate,
      cgstRate: row.cgstRate,
      sgstRate: row.sgstRate,
      sortOrder: lineItems.length + 1,
    });
  }
  return {
    clientMasterId: form.clientMasterId || null,
    clientId: form.clientId || null,
    recipientName: trim(recipient.name),
    projectName: trim(recipient.projectName),
    placeOfSupply: trim(recipient.placeOfSupply),
    deliveryAddress: trim(recipient.deliveryAddress),
    contactPerson: trim(recipient.contactPerson),
    contactEmail: trim(recipient.contactEmail),
    recipientGstin: trim(recipient.recipientGstin),
    recipientPan: trim(recipient.recipientPan),
    recipientStateCode: trim(recipient.stateCode),
    reference: trim(doc.reference),
    documentDate: trim(doc.issueDate),
    dueDate: trim(doc.dueDate),
    paymentTermsDays: doc.paymentTermsDays,
    cnAmount: adj.cnAmount,
    dnAmount: adj.dnAmount,
    advanceReceived: adj.advanceReceived,
    terms: Array.isArray(form.terms) ? form.terms : [],
    customNotes: trim(doc.customNotes),
    documentNumber: trim(doc.documentNumber),
    lineItems,
    builderForm: form,
    documentType: 'proforma',
  };
}

function poToPayload(form) {
  const vendor = form.vendor || {};
  const po = form.po || {};
  return {
    vendorName: trim(vendor.name),
    vendorAddress: trim(vendor.address || form.billingAddress),
    vendorGstin: trim(vendor.gstin),
    contactPerson: trim(vendor.contactPerson),
    contactEmail: trim(vendor.email),
    reference: trim(po.reference),
    projectName: trim(po.reference),
    documentDate: trim(po.documentDate),
    dueDate: trim(po.deliveryDate),
    terms: Array.isArray(form.terms) ? form.terms : [],
    notes: trim(form.notes),
    customNotes: trim(form.notes),
    documentNumber: trim(po.documentNumber),
    lineItems: (form.lineItems || [])
      .filter((row) => trim(row.description) || Number(row.qty) || Number(row.rate))
      .map((row, index) => ({
        description: trim(row.description),
        qty: row.qty,
        rate: row.rate,
        isFoc: Boolean(row.isFoc),
        sortOrder: index + 1,
      })),
    builderForm: form,
    documentType: 'purchase_order',
  };
}

export function formToApiPayload(documentType, form) {
  if (documentType === 'proforma') return proformaToPayload(form);
  if (documentType === 'purchase_order') return poToPayload(form);
  if (documentType === 'credit_note') return invoiceLikeToPayload(form, 'credit_note');
  return invoiceLikeToPayload(form, 'client_invoice');
}

function mergeInvoiceLike(base, doc) {
  const form = structuredClone(base);
  const bf = doc.builderForm && typeof doc.builderForm === 'object' ? doc.builderForm : null;
  if (bf) {
    return {
      ...form,
      ...bf,
      company: { ...form.company, ...(bf.company || {}) },
      bank: { ...form.bank, ...(bf.bank || {}) },
      payment: { ...form.payment, ...(bf.payment || {}) },
      billTo: { ...form.billTo, ...(bf.billTo || {}) },
      shipTo: { ...form.shipTo, ...(bf.shipTo || {}) },
      invoice: {
        ...form.invoice,
        ...(bf.invoice || {}),
        documentNumber: doc.documentNumber || bf.invoice?.documentNumber || '',
        issueDate: doc.documentDate || bf.invoice?.issueDate || form.invoice.issueDate,
        dueDate: doc.dueDate || bf.invoice?.dueDate || form.invoice.dueDate,
      },
      lineItems:
        Array.isArray(bf.lineItems) && bf.lineItems.length
          ? bf.lineItems
          : form.lineItems,
      terms: Array.isArray(bf.terms) ? bf.terms : form.terms,
      signature: { ...form.signature, ...(bf.signature || {}) },
      adjustments: { ...form.adjustments, ...(bf.adjustments || {}) },
    };
  }

  form.billTo = {
    ...form.billTo,
    name: doc.recipientName || '',
    contactPerson: doc.contactPerson || '',
    email: doc.contactEmail || '',
    address: doc.placeOfSupply || '',
    gstin: doc.recipientGstin || '',
    pan: doc.recipientPan || '',
    stateCode: doc.recipientStateCode || '',
  };
  form.shipTo = {
    ...form.shipTo,
    name: doc.shipToName || '',
    contactPerson: doc.shipToContactPerson || '',
    address: doc.shipToAddress || doc.deliveryAddress || '',
    vehicleNo: doc.vehicleNo || '',
    transporterName: doc.transporterName || '',
  };
  form.invoice = {
    ...form.invoice,
    documentNumber: doc.documentNumber || '',
    issueDate: doc.documentDate || form.invoice.issueDate,
    dueDate: doc.dueDate || form.invoice.dueDate,
    placeOfSupply: doc.placeOfSupply || '',
    projectName: doc.projectName || '',
    reverseCharge: doc.reverseCharge || 'N',
    cnReference: doc.cnReference || '',
    dnReference: doc.dnReference || '',
    receiptVoucherNo: doc.receiptVoucher || '',
    poReference: doc.reference || '',
  };
  form.adjustments = {
    cnAmount: doc.cnAmount || 0,
    dnAmount: doc.dnAmount || 0,
    advanceReceived: doc.advanceReceived || 0,
  };
  form.terms = Array.isArray(doc.terms) && doc.terms.length ? doc.terms : form.terms;
  form.declaration = doc.declaration || doc.customNotes || form.declaration;
  form.lineItems =
    Array.isArray(doc.lineItems) && doc.lineItems.length
      ? doc.lineItems.map((row) =>
          defaultLineItem({
            description: row.description || '',
            hsnSac: row.sacCode || '999316',
            qty: row.qty ?? 1,
            rate: row.rate ?? 0,
            discount: row.discount ?? 0,
            igstRate: row.igstRate ?? 18,
            cgstRate: row.cgstRate ?? 9,
            sgstRate: row.sgstRate ?? 9,
          })
        )
      : form.lineItems;
  return form;
}

function mergeProforma(doc) {
  const form = structuredClone(defaultProformaForm());
  const bf = doc.builderForm && typeof doc.builderForm === 'object' ? doc.builderForm : null;
  if (bf) {
    return {
      ...form,
      ...bf,
      document: {
        ...form.document,
        ...(bf.document || {}),
        documentNumber: doc.documentNumber || bf.document?.documentNumber || '',
        issueDate: doc.documentDate || bf.document?.issueDate || form.document.issueDate,
        dueDate: doc.dueDate || bf.document?.dueDate || form.document.dueDate,
      },
      rows: Array.isArray(bf.rows) && bf.rows.length ? bf.rows : form.rows,
    };
  }
  form.recipient = {
    ...form.recipient,
    name: doc.recipientName || '',
    projectName: doc.projectName || '',
    placeOfSupply: doc.placeOfSupply || '',
    deliveryAddress: doc.deliveryAddress || '',
    contactPerson: doc.contactPerson || '',
    contactEmail: doc.contactEmail || '',
    recipientGstin: doc.recipientGstin || '',
    recipientPan: doc.recipientPan || '',
    stateCode: doc.recipientStateCode || '',
  };
  form.document = {
    ...form.document,
    documentNumber: doc.documentNumber || '',
    issueDate: doc.documentDate || form.document.issueDate,
    dueDate: doc.dueDate || form.document.dueDate,
    paymentTermsDays: doc.paymentTermsDays || form.document.paymentTermsDays,
    reference: doc.reference || '',
    customNotes: doc.customNotes || '',
  };
  form.adjustments = {
    cnAmount: doc.cnAmount || 0,
    dnAmount: doc.dnAmount || 0,
    advanceReceived: doc.advanceReceived || 0,
  };
  form.terms = Array.isArray(doc.terms) && doc.terms.length ? doc.terms : form.terms;
  form.rows =
    Array.isArray(doc.lineItems) && doc.lineItems.length
      ? doc.lineItems.map((row) =>
          defaultLineRow({
            description: row.description || '',
            hsnSac: row.sacCode || '999316',
            qty: row.qty ?? 1,
            rate: row.rate ?? 0,
            discount: row.discount ?? 0,
            igstRate: row.igstRate ?? 18,
            cgstRate: row.cgstRate ?? 9,
            sgstRate: row.sgstRate ?? 9,
          })
        )
      : form.rows;
  return form;
}

function mergePo(doc) {
  const form = structuredClone(defaultPurchaseOrderForm());
  const bf = doc.builderForm && typeof doc.builderForm === 'object' ? doc.builderForm : null;
  if (bf) {
    return {
      ...form,
      ...bf,
      po: {
        ...form.po,
        ...(bf.po || {}),
        documentNumber: doc.documentNumber || bf.po?.documentNumber || '',
        documentDate: doc.documentDate || bf.po?.documentDate || form.po.documentDate,
        deliveryDate: doc.dueDate || bf.po?.deliveryDate || form.po.deliveryDate,
      },
      lineItems:
        Array.isArray(bf.lineItems) && bf.lineItems.length ? bf.lineItems : form.lineItems,
    };
  }
  form.vendor = {
    ...form.vendor,
    name: doc.recipientName || '',
    address: doc.placeOfSupply || '',
    gstin: doc.recipientGstin || '',
    contactPerson: doc.contactPerson || '',
    email: doc.contactEmail || '',
  };
  form.billingAddress = doc.placeOfSupply || '';
  form.deliveryAddress = doc.deliveryAddress || '';
  form.po = {
    ...form.po,
    documentNumber: doc.documentNumber || '',
    documentDate: doc.documentDate || form.po.documentDate,
    deliveryDate: doc.dueDate || form.po.deliveryDate,
    reference: doc.projectName || doc.reference || '',
  };
  form.notes = doc.customNotes || '';
  form.terms = Array.isArray(doc.terms) && doc.terms.length ? doc.terms : form.terms;
  form.lineItems =
    Array.isArray(doc.lineItems) && doc.lineItems.length
      ? doc.lineItems.map((row) =>
          defaultPoLineItem({
            description: row.description || '',
            qty: row.qty ?? 1,
            rate: row.rate ?? 0,
            isFoc: Boolean(row.isFoc),
          })
        )
      : form.lineItems;
  return form;
}

export function apiDocToForm(documentType, doc) {
  if (!doc) {
    if (documentType === 'proforma') return defaultProformaForm();
    if (documentType === 'purchase_order') return defaultPurchaseOrderForm();
    if (documentType === 'credit_note') return defaultCreditNoteForm();
    return defaultInvoiceForm();
  }
  if (documentType === 'proforma') return mergeProforma(doc);
  if (documentType === 'purchase_order') return mergePo(doc);
  if (documentType === 'credit_note') return mergeInvoiceLike(defaultCreditNoteForm(), doc);
  return mergeInvoiceLike(defaultInvoiceForm(), doc);
}

export async function loadCommercialDocument(id) {
  const res = await api(`/finance/commercial-documents/${id}`);
  return res.data;
}

export async function saveCommercialDocument(documentType, form, existingId = null) {
  const cfg = docConfig(documentType);
  if (!cfg) throw new Error('Unknown document type');
  const body = formToApiPayload(documentType, form);
  if (existingId) {
    const res = await api(`${cfg.apiBase}/${existingId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    return res.data;
  }
  const res = await api(cfg.apiBase, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return res.data;
}

export async function issueCommercialDocument(documentType, id) {
  const cfg = docConfig(documentType);
  if (!cfg) throw new Error('Unknown document type');
  const res = await api(cfg.issuePath(id), { method: 'POST', body: '{}' });
  return res.data;
}

export async function submitCommercialDocument(id) {
  const res = await api(`/finance/commercial-documents/${id}/submit`, {
    method: 'POST',
    body: '{}',
  });
  return res.data;
}

export async function approveCommercialDocument(id) {
  const res = await api(`/finance/commercial-documents/${id}/approve`, {
    method: 'POST',
    body: '{}',
  });
  return res.data;
}

export async function rejectCommercialDocument(id) {
  const res = await api(`/finance/commercial-documents/${id}/reject`, {
    method: 'POST',
    body: '{}',
  });
  return res.data;
}

export async function cancelCommercialDocument(id) {
  const res = await api(`/finance/commercial-documents/${id}/cancel`, {
    method: 'POST',
    body: '{}',
  });
  return res.data;
}

export async function deleteCommercialDocument(id) {
  const res = await api(`/finance/commercial-documents/${id}`, { method: 'DELETE' });
  return res.data;
}

export async function downloadServerPdf(documentType, id, fileName) {
  const cfg = docConfig(documentType);
  if (!cfg) throw new Error('Unknown document type');
  const res = await apiFetch(`${cfg.pdfPath(id)}?download=1`);
  if (!res.ok) throw new Error('PDF download failed');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(fileName || 'document').replace(/[^\w.-]+/g, '_')}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

export function buildEditPath(documentType, id) {
  const cfg = docConfig(documentType);
  if (!cfg || !id) return '/finance/build';
  return `/finance/build/${cfg.slug}/${id}`;
}

export function isEditableStatus(status) {
  return status === 'Draft' || status === 'Uploaded' || !status;
}
