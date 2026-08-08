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
  MAX_PO_LINE_ITEMS,
} from '../purchaseOrder/purchaseOrderStorage.js';
import { defaultCreditNoteForm } from '../creditNote/creditNoteStorage.js';
import { defaultDebitNoteForm } from '../debitNote/debitNoteStorage.js';
import { defaultDeliveryChallanForm } from '../deliveryChallan/deliveryChallanStorage.js';
import { defaultBillOfSupplyForm } from '../billOfSupply/billOfSupplyStorage.js';
import { defaultQuotationForm } from '../quotation/quotationStorage.js';
import { builderFormForPersist } from './builderFormPersist.js';

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
    clientPurchaseOrderId: form.clientPurchaseOrderId || null,
    recipientName: trim(bill.name),
    contactPerson: trim(bill.contactPerson),
    contactEmail: trim(bill.email),
    placeOfSupply: trim(
      inv.placeOfSupplyState ||
        [bill.stateName, bill.stateCode].filter(Boolean).join(' / ') ||
        inv.placeOfSupply ||
        bill.address
    ),
    deliveryAddress: trim(ship.address || bill.address),
    recipientGstin: trim(bill.gstin),
    recipientPan: trim(bill.pan),
    recipientStateCode: trim(bill.stateCode),
    projectName: trim(inv.projectName),
    reference: trim(inv.poReference || inv.vendorCode),
    referenceDate: trim(inv.poDate || inv.referenceDate),
    servicePeriod: trim(inv.servicePeriod || inv.projectName),
    cnReference: trim(inv.cnReference),
    dnReference: trim(inv.dnReference),
    originalInvoiceDate: trim(inv.originalInvoiceDate),
    creditReason: trim(inv.creditReason),
    debitReason: trim(inv.debitReason),
    receiptVoucher: trim(inv.receiptVoucherNo),
    documentDate: trim(inv.issueDate),
    dueDate: trim(inv.dueDate),
    reverseCharge: trim(inv.reverseCharge) === 'Y' ? 'Y' : 'N',
    cnAmount: adj.cnAmount,
    dnAmount: adj.dnAmount,
    advanceReceived: adj.advanceReceived,
    roundOff: adj.roundOff,
    terms: Array.isArray(form.terms) ? form.terms : [],
    customNotes: trim(form.declaration),
    declaration: trim(form.declaration),
    shipToName: trim(ship.name),
    shipToContactPerson: trim(ship.contactPerson),
    shipToAddress: trim(ship.address),
    shipToGstin: trim(ship.gstin),
    shipToStateCode: trim(ship.stateCode),
    shipToStateName: trim(ship.stateName),
    recipientStateName: trim(bill.stateName),
    vehicleNo: trim(ship.vehicleNo),
    transporterName: trim(ship.transporterName),
    documentNumber: '',
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
    builderForm: builderFormForPersist(form),
    documentType,
  };
}

function proformaToPayload(form) {
  const recipient = form.recipient || {};
  const ship = form.shipTo || {};
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
    projectName: trim(doc.servicePeriod || recipient.projectName),
    servicePeriod: trim(doc.servicePeriod || recipient.projectName),
    placeOfSupply: trim(recipient.placeOfSupply),
    deliveryAddress: trim(ship.address || recipient.deliveryAddress),
    contactPerson: trim(recipient.contactPerson),
    contactEmail: trim(recipient.contactEmail),
    recipientGstin: trim(recipient.recipientGstin),
    recipientPan: trim(recipient.recipientPan),
    recipientStateCode: trim(recipient.stateCode),
    recipientStateName: trim(recipient.stateName),
    reference: trim(doc.reference),
    referenceDate: trim(doc.referenceDate),
    documentDate: trim(doc.issueDate),
    dueDate: trim(doc.dueDate),
    paymentTermsDays: doc.paymentTermsDays,
    cnAmount: adj.cnAmount,
    dnAmount: adj.dnAmount,
    advanceReceived: adj.advanceReceived,
    roundOff: adj.roundOff,
    terms: Array.isArray(form.terms) ? form.terms : [],
    customNotes: trim(doc.customNotes),
    declaration: trim(form.declaration),
    shipToName: trim(ship.name),
    shipToAddress: trim(ship.address),
    shipToGstin: trim(ship.gstin),
    shipToStateCode: trim(ship.stateCode),
    shipToStateName: trim(ship.stateName),
    documentNumber: '',
    lineItems,
    builderForm: builderFormForPersist(form),
    documentType: 'proforma',
  };
}

function poToPayload(form) {
  const vendor = form.vendor || {};
  const buyer = form.buyer || {};
  const delivery = form.delivery || {};
  const billing = form.billing || {};
  const commercial = form.commercial || {};
  const po = form.po || {};
  return {
    vendorName: trim(vendor.name),
    vendorAddress: trim(vendor.address),
    vendorGstin: trim(vendor.gstin),
    vendorCode: trim(vendor.code),
    vendorMobile: trim(vendor.mobile),
    vendorStateCode: trim(vendor.stateCode),
    contactPerson: trim(vendor.contactPerson),
    contactEmail: trim(vendor.email),
    reference: trim(po.vendorQuoteRef),
    vendorQuoteRef: trim(po.vendorQuoteRef),
    vendorQuoteDate: trim(po.vendorQuoteDate),
    referenceDate: trim(po.vendorQuoteDate),
    projectName: trim(po.projectCostCentre),
    projectCostCentre: trim(po.projectCostCentre),
    revisionNo: po.revisionNo,
    documentDate: trim(po.documentDate),
    dueDate: trim(delivery.expectedDate || po.deliveryDate),
    expectedDeliveryDate: trim(delivery.expectedDate || po.deliveryDate),
    deliveryAddress: trim(delivery.address),
    deliveryContact: trim(delivery.contact),
    deliveryMobile: trim(delivery.mobile),
    deliveryInstructions: trim(delivery.instructions),
    buyerCompanyName: trim(buyer.companyName),
    buyerAddress: trim(buyer.address),
    buyerGstin: trim(buyer.gstin),
    buyerContactPerson: trim(buyer.contactPerson),
    buyerMobile: trim(buyer.mobile),
    buyerEmail: trim(buyer.email),
    billingAddress: trim(billing.address),
    billingGstin: trim(billing.gstin),
    billingState: trim(billing.state),
    billingStateCode: trim(billing.stateCode),
    billingPlaceOfSupply: trim(billing.placeOfSupply),
    paymentTerms: trim(commercial.paymentTerms),
    freight: trim(commercial.freight),
    insurance: trim(commercial.insurance),
    deliveryTerms: trim(commercial.deliveryTerms),
    warranty: trim(commercial.warranty),
    validity: trim(commercial.validity),
    terms: Array.isArray(form.terms) ? form.terms : [],
    notes: trim(form.notes),
    customNotes: trim(form.notes),
    roundOff: form.roundOff,
    documentNumber: '',
    lineItems: (form.lineItems || [])
      .filter((row) => trim(row.description) || Number(row.qty) || Number(row.rate))
      .map((row, index) => ({
        description: trim(row.description),
        unit: trim(row.unit || row.uom) || 'Nos',
        qty: row.qty,
        rate: row.rate,
        discount: row.discount,
        igstRate: row.igstRate,
        cgstRate: row.cgstRate,
        sgstRate: row.sgstRate,
        isFoc: Boolean(row.isFoc),
        sortOrder: index + 1,
      })),
    builderForm: builderFormForPersist(form),
    documentType: 'purchase_order',
    contactId: form.contactId || null,
  };
}

function deliveryChallanToPayload(form) {
  const inv = form.invoice || {};
  const from = form.from || {};
  const to = form.deliverTo || {};
  const courier = form.courier || {};
  const dispatch = form.dispatch || {};
  const ack = form.acknowledgement || {};
  return {
    clientMasterId: form.clientMasterId || null,
    clientId: form.clientId || null,
    documentDate: trim(inv.issueDate),
    dispatchDate: trim(inv.dispatchDate),
    expectedDeliveryDate: trim(inv.expectedDeliveryDate),
    dueDate: trim(inv.expectedDeliveryDate),
    fromCompanyName: trim(from.companyName),
    fromAddress: trim(from.address),
    fromGstin: trim(from.gstin),
    fromContactPerson: trim(from.contactPerson),
    fromMobile: trim(from.mobile),
    fromEmail: trim(from.email),
    recipientType: trim(to.recipientType),
    recipientName: trim(to.name),
    deliverToCompany: trim(to.company),
    contactPerson: trim(to.contactPerson),
    deliverToMobile: trim(to.mobile),
    deliveryAddress: trim(to.address),
    shipToAddress: trim(to.address),
    shipToName: trim(to.name),
    shipToContactPerson: trim(to.contactPerson),
    courierName: trim(courier.name),
    transporterName: trim(courier.name),
    awbNo: trim(courier.awbNo),
    reference: trim(courier.awbNo),
    courierMode: trim(courier.mode),
    packageCount: courier.packageCount,
    originCity: trim(courier.originCity),
    destinationCity: trim(courier.destinationCity),
    purposeOfMovement: trim(form.purposeOfMovement),
    projectName: trim(form.purposeOfMovement),
    packedBy: trim(dispatch.packedBy),
    checkedBy: trim(dispatch.checkedBy),
    dispatchedBy: trim(dispatch.dispatchedBy),
    receivedBy: trim(ack.receivedBy),
    receivedMobile: trim(ack.receivedMobile),
    conditionOnReceipt: trim(ack.conditionOnReceipt),
    receivedDate: trim(ack.receivedDate),
    declaration: trim(form.declaration),
    customNotes: trim(form.declaration),
    documentNumber: '',
    lineItems: (form.lineItems || [])
      .filter(
        (row) =>
          trim(row.description) ||
          trim(row.assetId) ||
          trim(row.manufacturerSerialNo) ||
          Number(row.qty)
      )
      .map((row, index) => ({
        assetId: trim(row.assetId),
        description: trim(row.description),
        make: trim(row.make),
        model: trim(row.model),
        manufacturerSerialNo: trim(row.manufacturerSerialNo),
        qty: row.qty,
        accessories: trim(row.accessories),
        condition: trim(row.condition),
        remarks: trim(row.remarks),
        sortOrder: index + 1,
      })),
    builderForm: builderFormForPersist(form),
    documentType: 'delivery_challan',
  };
}

function mergeDeliveryChallan(doc) {
  const form = structuredClone(defaultDeliveryChallanForm());
  const bf = doc.builderForm && typeof doc.builderForm === 'object' ? doc.builderForm : null;
  const docNo = officialDocumentNumber(doc);
  if (bf) {
    return {
      ...form,
      ...bf,
      company: { ...form.company, ...(bf.company || {}) },
      from: { ...form.from, ...(bf.from || {}) },
      deliverTo: { ...form.deliverTo, ...(bf.deliverTo || {}) },
      courier: { ...form.courier, ...(bf.courier || {}) },
      dispatch: { ...form.dispatch, ...(bf.dispatch || {}) },
      acknowledgement: { ...form.acknowledgement, ...(bf.acknowledgement || {}) },
      invoice: {
        ...form.invoice,
        ...(bf.invoice || {}),
        documentNumber: docNo,
        issueDate: doc.documentDate || bf.invoice?.issueDate || form.invoice.issueDate,
        dispatchDate: doc.dispatchDate || bf.invoice?.dispatchDate || form.invoice.dispatchDate,
        expectedDeliveryDate:
          doc.expectedDeliveryDate ||
          doc.dueDate ||
          bf.invoice?.expectedDeliveryDate ||
          form.invoice.expectedDeliveryDate,
      },
      lineItems:
        Array.isArray(bf.lineItems) && bf.lineItems.length ? bf.lineItems : form.lineItems,
      purposeOfMovement: bf.purposeOfMovement || doc.purposeOfMovement || form.purposeOfMovement,
      declaration: bf.declaration || doc.declaration || form.declaration,
    };
  }

  form.invoice = {
    ...form.invoice,
    documentNumber: docNo,
    issueDate: doc.documentDate || form.invoice.issueDate,
    dispatchDate: doc.dispatchDate || form.invoice.dispatchDate,
    expectedDeliveryDate: doc.expectedDeliveryDate || doc.dueDate || form.invoice.expectedDeliveryDate,
  };
  form.from = {
    companyName: doc.fromCompanyName || '',
    address: doc.fromAddress || '',
    gstin: doc.fromGstin || '',
    contactPerson: doc.fromContactPerson || '',
    mobile: doc.fromMobile || '',
    email: doc.fromEmail || '',
  };
  form.deliverTo = {
    recipientType: doc.recipientType || '',
    name: doc.recipientName || '',
    company: doc.deliverToCompany || '',
    contactPerson: doc.contactPerson || '',
    mobile: doc.deliverToMobile || '',
    address: doc.deliveryAddress || doc.shipToAddress || '',
  };
  form.courier = {
    name: doc.courierName || doc.transporterName || '',
    awbNo: doc.awbNo || doc.reference || '',
    mode: doc.courierMode || '',
    packageCount: doc.packageCount ?? '',
    originCity: doc.originCity || '',
    destinationCity: doc.destinationCity || '',
  };
  form.purposeOfMovement = doc.purposeOfMovement || doc.projectName || '';
  form.declaration = doc.declaration || form.declaration;
  form.dispatch = {
    packedBy: doc.packedBy || '',
    checkedBy: doc.checkedBy || '',
    dispatchedBy: doc.dispatchedBy || '',
  };
  form.acknowledgement = {
    receivedBy: doc.receivedBy || '',
    receivedMobile: doc.receivedMobile || '',
    conditionOnReceipt: doc.conditionOnReceipt || '',
    receivedDate: doc.receivedDate || '',
  };
  form.clientMasterId = doc.clientMasterId || '';
  form.clientId = doc.clientId || '';
  form.lineItems =
    Array.isArray(doc.lineItems) && doc.lineItems.length
      ? doc.lineItems.map((row) => ({
          assetId: row.assetId || '',
          description: row.description || '',
          make: row.make || '',
          model: row.model || '',
          manufacturerSerialNo: row.manufacturerSerialNo || row.serialNo || '',
          qty: row.qty ?? '',
          accessories: row.accessories || '',
          condition: row.condition || '',
          remarks: row.remarks || '',
        }))
      : form.lineItems;
  return form;
}

export function formToApiPayload(documentType, form) {
  if (documentType === 'proforma') return proformaToPayload(form);
  if (documentType === 'purchase_order') return poToPayload(form);
  if (documentType === 'credit_note') return invoiceLikeToPayload(form, 'credit_note');
  if (documentType === 'debit_note') return invoiceLikeToPayload(form, 'debit_note');
  if (documentType === 'delivery_challan') return deliveryChallanToPayload(form);
  if (documentType === 'bill_of_supply') return invoiceLikeToPayload(form, 'bill_of_supply');
  if (documentType === 'quotation') return invoiceLikeToPayload(form, 'quotation');
  return invoiceLikeToPayload(form, 'client_invoice');
}

/** Official numbers exist only after approval — blank for Draft / Submitted / Uploaded. */
function officialDocumentNumber(doc) {
  if (['Draft', 'Submitted', 'Uploaded'].includes(doc?.status)) return '';
  return doc?.documentNumber || '';
}

function mergeInvoiceLike(base, doc) {
  const form = structuredClone(base);
  const bf = doc.builderForm && typeof doc.builderForm === 'object' ? doc.builderForm : null;
  const docNo = officialDocumentNumber(doc);
  if (bf) {
    return {
      ...form,
      ...bf,
      clientMasterId: bf.clientMasterId || doc.clientMasterId || '',
      clientId: bf.clientId || doc.clientId || '',
      clientPurchaseOrderId: bf.clientPurchaseOrderId || doc.clientPurchaseOrderId || '',
      company: { ...form.company, ...(bf.company || {}) },
      bank: { ...form.bank, ...(bf.bank || {}) },
      payment: { ...form.payment, ...(bf.payment || {}) },
      billTo: { ...form.billTo, ...(bf.billTo || {}) },
      shipTo: { ...form.shipTo, ...(bf.shipTo || {}) },
      invoice: {
        ...form.invoice,
        ...(bf.invoice || {}),
        documentNumber: docNo,
        issueDate: doc.documentDate || bf.invoice?.issueDate || form.invoice.issueDate,
        dueDate: doc.dueDate || bf.invoice?.dueDate || form.invoice.dueDate,
        poReference: bf.invoice?.poReference || doc.reference || form.invoice?.poReference || '',
        poDate: bf.invoice?.poDate || doc.referenceDate || form.invoice?.poDate || '',
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

  form.clientMasterId = doc.clientMasterId || '';
  form.clientId = doc.clientId || '';
  form.clientPurchaseOrderId = doc.clientPurchaseOrderId || '';
  form.billTo = {
    ...form.billTo,
    name: doc.recipientName || '',
    contactPerson: doc.contactPerson || '',
    email: doc.contactEmail || '',
    address: doc.placeOfSupply || '',
    gstin: doc.recipientGstin || '',
    pan: doc.recipientPan || '',
    stateCode: doc.recipientStateCode || '',
    stateName: doc.recipientStateName || '',
  };
  form.shipTo = {
    ...form.shipTo,
    name: doc.shipToName || '',
    contactPerson: doc.shipToContactPerson || '',
    address: doc.shipToAddress || doc.deliveryAddress || '',
    gstin: doc.shipToGstin || '',
    stateCode: doc.shipToStateCode || '',
    stateName: doc.shipToStateName || '',
    vehicleNo: doc.vehicleNo || '',
    transporterName: doc.transporterName || '',
  };
  form.invoice = {
    ...form.invoice,
    documentNumber: docNo,
    issueDate: doc.documentDate || form.invoice.issueDate,
    dueDate: doc.dueDate || form.invoice.dueDate,
    placeOfSupply: doc.placeOfSupply || '',
    projectName: doc.servicePeriod || doc.projectName || '',
    servicePeriod: doc.servicePeriod || doc.projectName || '',
    reverseCharge: doc.reverseCharge || 'N',
    cnReference: doc.cnReference || '',
    dnReference: doc.dnReference || '',
    receiptVoucherNo: doc.receiptVoucher || '',
    poReference: doc.reference || '',
    poDate: doc.referenceDate || '',
    cnReference: doc.cnReference || '',
    dnReference: doc.dnReference || '',
    originalInvoiceDate: doc.originalInvoiceDate || '',
    creditReason: doc.creditReason || '',
    debitReason: doc.debitReason || '',
  };
  form.adjustments = {
    cnAmount: doc.cnAmount || 0,
    dnAmount: doc.dnAmount || 0,
    advanceReceived: doc.advanceReceived || 0,
    roundOff: doc.roundOff ?? '',
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
  const docNo = officialDocumentNumber(doc);
  if (bf) {
    return {
      ...form,
      ...bf,
      shipTo: { ...form.shipTo, ...(bf.shipTo || {}) },
      document: {
        ...form.document,
        ...(bf.document || {}),
        documentNumber: docNo,
        issueDate: doc.documentDate || bf.document?.issueDate || form.document.issueDate,
        dueDate: doc.dueDate || bf.document?.dueDate || form.document.dueDate,
        reference: doc.reference || bf.document?.reference || form.document.reference,
        referenceDate: doc.referenceDate || bf.document?.referenceDate || form.document.referenceDate,
        servicePeriod:
          doc.servicePeriod ||
          doc.projectName ||
          bf.document?.servicePeriod ||
          form.document.servicePeriod,
      },
      rows: Array.isArray(bf.rows) && bf.rows.length ? bf.rows : form.rows,
      declaration: bf.declaration || doc.declaration || form.declaration,
    };
  }
  form.recipient = {
    ...form.recipient,
    name: doc.recipientName || '',
    projectName: doc.servicePeriod || doc.projectName || '',
    placeOfSupply: doc.placeOfSupply || '',
    deliveryAddress: doc.deliveryAddress || '',
    contactPerson: doc.contactPerson || '',
    contactEmail: doc.contactEmail || '',
    recipientGstin: doc.recipientGstin || '',
    recipientPan: doc.recipientPan || '',
    stateCode: doc.recipientStateCode || '',
    stateName: doc.recipientStateName || '',
  };
  form.shipTo = {
    name: doc.shipToName || '',
    address: doc.shipToAddress || doc.deliveryAddress || '',
    gstin: doc.shipToGstin || '',
    stateCode: doc.shipToStateCode || '',
    stateName: doc.shipToStateName || '',
  };
  form.document = {
    ...form.document,
    documentNumber: docNo,
    issueDate: doc.documentDate || form.document.issueDate,
    dueDate: doc.dueDate || form.document.dueDate,
    paymentTermsDays: doc.paymentTermsDays || form.document.paymentTermsDays,
    reference: doc.reference || '',
    referenceDate: doc.referenceDate || '',
    servicePeriod: doc.servicePeriod || doc.projectName || '',
    customNotes: doc.customNotes || '',
  };
  form.declaration = doc.declaration || form.declaration;
  form.adjustments = {
    cnAmount: doc.cnAmount || 0,
    dnAmount: doc.dnAmount || 0,
    advanceReceived: doc.advanceReceived || 0,
    roundOff: doc.roundOff ?? '',
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
  const docNo = officialDocumentNumber(doc);
  if (bf) {
    return {
      ...form,
      ...bf,
      buyer: { ...form.buyer, ...(bf.buyer || {}) },
      vendor: { ...form.vendor, ...(bf.vendor || {}) },
      delivery: { ...form.delivery, ...(bf.delivery || {}) },
      billing: { ...form.billing, ...(bf.billing || {}) },
      commercial: { ...form.commercial, ...(bf.commercial || {}) },
      po: {
        ...form.po,
        ...(bf.po || {}),
        documentNumber: docNo,
        documentDate: doc.documentDate || bf.po?.documentDate || form.po.documentDate,
        vendorQuoteRef: doc.vendorQuoteRef || doc.reference || bf.po?.vendorQuoteRef || form.po.vendorQuoteRef,
        vendorQuoteDate: doc.vendorQuoteDate || doc.referenceDate || bf.po?.vendorQuoteDate || '',
        projectCostCentre:
          doc.projectCostCentre || doc.projectName || bf.po?.projectCostCentre || form.po.projectCostCentre,
        revisionNo: doc.revisionNo ?? bf.po?.revisionNo ?? form.po.revisionNo,
      },
      lineItems: Array.isArray(bf.lineItems) && bf.lineItems.length
        ? bf.lineItems.slice(0, MAX_PO_LINE_ITEMS)
        : form.lineItems,
      contactId: bf.contactId || doc.contactId || '',
      specialTerms: { ...form.specialTerms, ...(bf.specialTerms || {}) },
      authorisation: {
        preparedBy: { ...form.authorisation.preparedBy, ...(bf.authorisation?.preparedBy || {}) },
        checkedBy: { ...form.authorisation.checkedBy, ...(bf.authorisation?.checkedBy || {}) },
        approvedBy: { ...form.authorisation.approvedBy, ...(bf.authorisation?.approvedBy || {}) },
      },
      vendorAcceptance: { ...form.vendorAcceptance, ...(bf.vendorAcceptance || {}) },
    };
  }
  form.contactId = doc.contactId || '';
  form.vendor = {
    ...form.vendor,
    name: doc.recipientName || '',
    code: doc.vendorCode || form.vendor.code,
    address: doc.vendorAddress || doc.placeOfSupply || '',
    gstin: doc.recipientGstin || doc.vendorGstin || '',
    contactPerson: doc.contactPerson || '',
    mobile: doc.vendorMobile || '',
    email: doc.contactEmail || '',
    stateCode: doc.recipientStateCode || '',
  };
  form.buyer = {
    companyName: doc.buyerCompanyName || '',
    address: doc.buyerAddress || '',
    gstin: doc.buyerGstin || '',
    contactPerson: doc.buyerContactPerson || '',
    mobile: doc.buyerMobile || '',
    email: doc.buyerEmail || '',
  };
  form.delivery = {
    address: doc.deliveryAddress || '',
    contact: doc.deliveryContact || '',
    mobile: doc.deliveryMobile || '',
    expectedDate: doc.expectedDeliveryDate || doc.dueDate || form.delivery.expectedDate,
    instructions: doc.deliveryInstructions || '',
  };
  form.billing = {
    address: doc.billingAddress || '',
    gstin: doc.billingGstin || '',
    state: doc.billingState || '',
    stateCode: doc.billingStateCode || '',
    placeOfSupply: doc.billingPlaceOfSupply || '',
  };
  form.commercial = {
    paymentTerms: doc.paymentTerms || '',
    freight: doc.freight || '',
    insurance: doc.insurance || '',
    deliveryTerms: doc.deliveryTerms || '',
    warranty: doc.warranty || '',
    validity: doc.validity || '',
  };
  form.po = {
    ...form.po,
    documentNumber: docNo,
    documentDate: doc.documentDate || form.po.documentDate,
    vendorQuoteRef: doc.vendorQuoteRef || doc.reference || '',
    vendorQuoteDate: doc.vendorQuoteDate || doc.referenceDate || '',
    revisionNo: doc.revisionNo ?? 0,
    projectCostCentre: doc.projectCostCentre || doc.projectName || '',
    deliveryDate: doc.dueDate || form.po.deliveryDate,
  };
  form.notes = doc.customNotes || '';
  form.roundOff = doc.roundOff ?? '';
  form.terms = Array.isArray(doc.terms) && doc.terms.length ? doc.terms : form.terms;
  form.lineItems =
    Array.isArray(doc.lineItems) && doc.lineItems.length
      ? doc.lineItems.slice(0, MAX_PO_LINE_ITEMS).map((row) =>
          defaultPoLineItem({
            description: row.description || '',
            unit: row.unit || row.uom || 'Nos',
            uom: row.unit || row.uom || 'Nos',
            qty: row.qty ?? 1,
            rate: row.rate ?? 0,
            discount: row.discount ?? 0,
            igstRate: row.igstRate ?? 18,
            cgstRate: row.cgstRate ?? 9,
            sgstRate: row.sgstRate ?? 9,
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
    if (documentType === 'debit_note') return defaultDebitNoteForm();
    if (documentType === 'delivery_challan') return defaultDeliveryChallanForm();
    if (documentType === 'bill_of_supply') return defaultBillOfSupplyForm();
    if (documentType === 'quotation') return defaultQuotationForm();
    return defaultInvoiceForm();
  }
  if (documentType === 'proforma') return mergeProforma(doc);
  if (documentType === 'purchase_order') return mergePo(doc);
  if (documentType === 'credit_note') return mergeInvoiceLike(defaultCreditNoteForm(), doc);
  if (documentType === 'debit_note') return mergeInvoiceLike(defaultDebitNoteForm(), doc);
  if (documentType === 'delivery_challan') return mergeDeliveryChallan(doc);
  if (documentType === 'bill_of_supply') return mergeInvoiceLike(defaultBillOfSupplyForm(), doc);
  if (documentType === 'quotation') return mergeInvoiceLike(defaultQuotationForm(), doc);
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

export async function recordCommercialPayment(id, amount) {
  const res = await api(`/finance/commercial-documents/${id}/payment`, {
    method: 'POST',
    body: JSON.stringify({ amount }),
  });
  return res.data;
}

export async function deleteCommercialDocument(id) {
  const res = await api(`/finance/commercial-documents/${id}`, { method: 'DELETE' });
  return res.data;
}

/** Fetch the sharp PDFKit-rendered PDF as a Blob (vector text — not html2canvas). */
export async function fetchServerPdfBlob(documentType, id) {
  const cfg = docConfig(documentType);
  if (!cfg) throw new Error('Unknown document type');
  const res = await apiFetch(`${cfg.pdfPath(id)}?download=1`);
  if (!res.ok) throw new Error('PDF download failed');
  const blob = await res.blob();
  if (!(blob instanceof Blob) || blob.size < 64) {
    throw new Error('PDF download failed');
  }
  return blob;
}

export async function downloadServerPdf(documentType, id, fileName) {
  const blob = await fetchServerPdfBlob(documentType, id);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(fileName || 'document').replace(/[^\w.-]+/g, '_')}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return blob;
}

export function buildEditPath(documentType, id) {
  const cfg = docConfig(documentType);
  if (!cfg || !id) return '/finance-one/billing';
  return `/finance-one/billing/${cfg.slug}/${id}`;
}

export function isEditableStatus(status) {
  return status === 'Draft' || status === 'Uploaded' || !status;
}
