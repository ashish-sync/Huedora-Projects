/** Copy Bill To party fields onto Ship To (keeps transport-only ship fields). */
export function copyBillToShipTo(billTo = {}, shipTo = {}) {
  return {
    ...shipTo,
    name: billTo.name || '',
    contactPerson: billTo.contactPerson || '',
    address: billTo.address || '',
    gstin: billTo.gstin || '',
    stateName: billTo.stateName || '',
    stateCode: billTo.stateCode || '',
  };
}

/** Proforma recipient → Ship To */
export function copyRecipientToShipTo(recipient = {}, shipTo = {}) {
  return {
    ...shipTo,
    name: recipient.name || '',
    contactPerson: recipient.contactPerson || '',
    address: recipient.placeOfSupply || recipient.deliveryAddress || '',
    gstin: recipient.recipientGstin || '',
    stateName: recipient.stateName || '',
    stateCode: recipient.stateCode || '',
  };
}

function setPathValue(root, path, value) {
  const keys = String(path).split('.');
  let cur = root;
  for (let i = 0; i < keys.length - 1; i += 1) {
    if (cur[keys[i]] == null || typeof cur[keys[i]] !== 'object') cur[keys[i]] = {};
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = value;
}

/**
 * Path update for invoice-like forms with optional Ship To ↔ Bill To sync.
 * - Toggling shipToSameAsBillTo on copies Bill To → Ship To
 * - Bill To edits while synced refresh Ship To
 * - Ship To edits while synced turn the sync off
 */
export function applyPathUpdateWithShipToSync(prev, path, value) {
  const next = structuredClone(prev);
  setPathValue(next, path, value);

  if (path === 'shipToSameAsBillTo') {
    if (value) next.shipTo = copyBillToShipTo(next.billTo, next.shipTo);
    return next;
  }

  if (next.shipToSameAsBillTo && path.startsWith('billTo.')) {
    next.shipTo = copyBillToShipTo(next.billTo, next.shipTo);
  } else if (next.shipToSameAsBillTo && path.startsWith('shipTo.')) {
    next.shipToSameAsBillTo = false;
  }

  return next;
}

/** Proforma: sync Ship To from recipient. */
export function applyProformaPathUpdateWithShipToSync(prev, path, value) {
  const next = structuredClone(prev);
  setPathValue(next, path, value);

  if (path === 'shipToSameAsBillTo') {
    if (value) next.shipTo = copyRecipientToShipTo(next.recipient, next.shipTo);
    return next;
  }

  if (next.shipToSameAsBillTo && path.startsWith('recipient.')) {
    next.shipTo = copyRecipientToShipTo(next.recipient, next.shipTo);
  } else if (next.shipToSameAsBillTo && path.startsWith('shipTo.')) {
    next.shipToSameAsBillTo = false;
  }

  return next;
}

/** After Client Master / Bill To patch, keep Ship To mirrored when sync is on. */
export function syncShipToAfterBillToPatch(prev, billToPatch = {}) {
  const billTo = { ...prev.billTo, ...billToPatch };
  if (!prev.shipToSameAsBillTo) {
    return {
      ...prev.shipTo,
      name: billToPatch.name || prev.shipTo?.name || '',
      address: billToPatch.address || prev.shipTo?.address || '',
      contactPerson: billToPatch.contactPerson || prev.shipTo?.contactPerson || '',
      gstin: billToPatch.gstin || prev.shipTo?.gstin || '',
      stateName: billToPatch.stateName || prev.shipTo?.stateName || '',
      stateCode: billToPatch.stateCode || prev.shipTo?.stateCode || '',
    };
  }
  return copyBillToShipTo(billTo, prev.shipTo);
}
