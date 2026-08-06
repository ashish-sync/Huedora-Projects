/**
 * Gate commercial billing draft creation for all 8 document types:
 * Quotation, Purchase Order, Proforma, Tax Invoice, Credit Note, Debit Note,
 * Delivery Challan, Bill of Supply.
 *
 * Require ≥2 meaningful user entries before the first server autosave / draft.
 * Org-master, seed dates, default declarations, default payment terms, and the
 * sample line description do not count.
 */

function trim(v) {
  return v == null ? '' : String(v).trim();
}

function filled(v) {
  return trim(v) !== '';
}

function countIf(...values) {
  return values.reduce((n, v) => n + (filled(v) ? 1 : 0), 0);
}

const DEFAULT_LINE_DESCRIPTION = 'Healthcare Camp / Activation Services';

const DEFAULT_CREDIT_REASONS = new Set([
  'Rate Revision / Cancellation / Service Adjustment',
  'Rate Revision',
  'Cancellation',
  'Service Adjustment',
]);

const DEFAULT_DEBIT_REASONS = new Set([
  'Additional Service / Underbilling / Rate Revision / Tax Adjustment',
  'Additional Service',
  'Underbilling',
  'Rate Revision',
  'Tax Adjustment',
]);

function isUserLineDescription(description) {
  const t = trim(description);
  return Boolean(t) && t !== DEFAULT_LINE_DESCRIPTION;
}

function isDefaultPaymentTerm(term) {
  return /payment is due within/i.test(trim(term)) || /payment terms:\s*30 days/i.test(trim(term));
}

function countCustomTerms(terms) {
  const list = Array.isArray(terms) ? terms.map(trim).filter(Boolean) : [];
  let n = 0;
  for (const term of list) {
    if (!isDefaultPaymentTerm(term)) n += 1;
  }
  return n;
}

function countInvoiceLikeLineItems(lineItems) {
  let n = 0;
  for (const line of lineItems || []) {
    if (isUserLineDescription(line?.description)) n += 1;
    else if (filled(line?.hsnSac) && trim(line.hsnSac) !== '999316') n += 1;
    else if (Number(line?.rate) > 0) n += 1;
    else if (Number(line?.qty) > 0 && Number(line?.qty) !== 1 && isUserLineDescription(line?.description)) {
      n += 1;
    }
  }
  return n;
}

/** Tax Invoice, Quotation, Credit/Debit Note, Bill of Supply (invoice-shaped forms). */
function countInvoiceLikeEntries(form) {
  const bill = form?.billTo || {};
  const ship = form?.shipTo || {};
  const inv = form?.invoice || {};
  const adj = form?.adjustments || {};

  let n = countIf(
    bill.name,
    bill.address,
    bill.gstin,
    bill.email,
    bill.contactPerson,
    bill.pan,
    bill.stateName,
    bill.stateCode,
    ship.name,
    ship.address,
    ship.gstin,
    ship.contactPerson,
    ship.stateName,
    ship.stateCode,
    inv.projectName,
    inv.poReference,
    inv.vendorCode,
    inv.poDate,
    inv.referenceDate,
    inv.servicePeriod,
    inv.cnReference,
    inv.dnReference,
    inv.receiptVoucherNo,
    inv.originalInvoiceDate,
    form?.clientMasterId
  );

  const creditReason = trim(inv.creditReason);
  if (creditReason && !DEFAULT_CREDIT_REASONS.has(creditReason)) n += 1;

  const debitReason = trim(inv.debitReason);
  if (debitReason && !DEFAULT_DEBIT_REASONS.has(debitReason)) n += 1;

  // Do not count seed MSME / document declarations — only user edits beyond empty.
  // (Declarations are system-provided on new drafts.)

  if (Number(adj.cnAmount) || Number(adj.dnAmount) || Number(adj.advanceReceived)) {
    n += 1;
  }
  if (adj.roundOff !== '' && adj.roundOff != null && Number(adj.roundOff) !== 0) {
    n += 1;
  }

  n += countInvoiceLikeLineItems(form?.lineItems);
  n += countCustomTerms(form?.terms);

  return n;
}

/** Proforma uses recipient / document / rows instead of billTo / invoice / lineItems. */
function countProformaEntries(form) {
  const recipient = form?.recipient || {};
  const ship = form?.shipTo || {};
  const doc = form?.document || {};
  const adj = form?.adjustments || {};

  let n = countIf(
    recipient.name,
    recipient.placeOfSupply,
    recipient.contactPerson,
    recipient.contactEmail,
    recipient.recipientGstin,
    recipient.recipientPan,
    recipient.stateName,
    recipient.stateCode,
    recipient.projectName,
    recipient.deliveryAddress,
    ship.name,
    ship.address,
    ship.gstin,
    ship.contactPerson,
    ship.stateName,
    ship.stateCode,
    doc.reference,
    doc.referenceDate,
    doc.servicePeriod,
    doc.customNotes,
    form?.clientMasterId
  );

  if (Number(adj.cnAmount) || Number(adj.dnAmount) || Number(adj.advanceReceived)) {
    n += 1;
  }

  for (const row of form?.rows || []) {
    if (row?.type && row.type !== 'line') continue;
    if (isUserLineDescription(row?.description)) n += 1;
    else if (filled(row?.hsnSac) && trim(row.hsnSac) !== '999316') n += 1;
    else if (Number(row?.rate) > 0) n += 1;
  }

  n += countCustomTerms(form?.terms);
  return n;
}

function countPurchaseOrderEntries(form) {
  const vendor = form?.vendor || {};
  const buyer = form?.buyer || {};
  const delivery = form?.delivery || {};
  const commercial = form?.commercial || {};
  const po = form?.po || {};
  const special = form?.specialTerms || {};
  const accept = form?.vendorAcceptance || {};

  // Do not count seed documentDate / expectedDate (auto-filled to today).
  let n = countIf(
    vendor.name,
    vendor.code,
    vendor.address,
    vendor.gstin,
    vendor.contactPerson,
    vendor.mobile,
    vendor.email,
    buyer.contactPerson,
    delivery.address,
    delivery.contact,
    delivery.mobile,
    delivery.instructions,
    commercial.paymentTerms,
    commercial.freight,
    commercial.insurance,
    commercial.deliveryTerms,
    commercial.warranty,
    commercial.validity,
    po.vendorQuoteRef,
    po.vendorQuoteDate,
    po.projectCostCentre,
    form?.contactId,
    special.deliverySchedule,
    special.warranty,
    special.replacementPolicy,
    special.penaltyClause,
    special.inspection,
    special.documentation,
    special.otherInstructions,
    accept.acceptedBy,
    accept.designation,
    accept.signature,
    accept.date
  );

  for (const line of form?.lineItems || []) {
    if (isUserLineDescription(line?.description)) n += 1;
    else if (Number(line?.rate) > 0) n += 1;
  }

  return n;
}

function countDeliveryChallanEntries(form) {
  const to = form?.deliverTo || {};
  const from = form?.from || {};
  const courier = form?.courier || {};
  const inv = form?.invoice || {};
  const ack = form?.acknowledgement || {};
  const dispatch = form?.dispatch || {};

  // Do not count seed issueDate / dispatchDate (auto-filled to today).
  let n = countIf(
    to.name,
    to.company,
    to.address,
    to.contactPerson,
    to.mobile,
    to.recipientType,
    from.contactPerson,
    courier.name,
    courier.awbNo,
    courier.mode,
    courier.packageCount,
    courier.originCity,
    courier.destinationCity,
    inv.expectedDeliveryDate,
    form?.purposeOfMovement,
    dispatch.packedBy,
    dispatch.checkedBy,
    dispatch.dispatchedBy,
    ack.receivedBy,
    ack.receivedMobile,
    ack.conditionOnReceipt,
    ack.receivedDate,
    form?.clientMasterId
  );

  for (const line of form?.lineItems || []) {
    if (
      isUserLineDescription(line?.description) ||
      filled(line?.assetId) ||
      filled(line?.manufacturerSerialNo) ||
      filled(line?.serialNo) ||
      filled(line?.make) ||
      filled(line?.model) ||
      (filled(line?.qty) && Number(line.qty) > 0)
    ) {
      n += 1;
    }
  }

  return n;
}

/** Count meaningful user-filled entries on a commercial builder form. */
export function countCommercialDraftEntries(form, documentType) {
  switch (documentType) {
    case 'purchase_order':
      return countPurchaseOrderEntries(form);
    case 'delivery_challan':
      return countDeliveryChallanEntries(form);
    case 'proforma':
      return countProformaEntries(form);
    case 'quotation':
    case 'client_invoice':
    case 'credit_note':
    case 'debit_note':
    case 'bill_of_supply':
      return countInvoiceLikeEntries(form);
    default:
      return countInvoiceLikeEntries(form);
  }
}

export const MIN_COMMERCIAL_DRAFT_ENTRIES = 2;

/** True when the form has enough content to create/keep a server draft. */
export function hasEnoughCommercialDraftContent(form, documentType, min = MIN_COMMERCIAL_DRAFT_ENTRIES) {
  return countCommercialDraftEntries(form, documentType) >= min;
}
