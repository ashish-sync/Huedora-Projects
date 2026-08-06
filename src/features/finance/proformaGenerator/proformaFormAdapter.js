/** Map proforma form shape → invoice-like preview helpers. */
export function proformaToInvoiceView(proforma) {
  const lineItems = (proforma.rows || [])
    .filter((r) => r.type === 'line')
    .map((r) => ({
      id: r.id,
      description: r.description,
      hsnSac: r.hsnSac,
      qty: r.qty,
      rate: r.rate,
      discount: r.discount,
      igstRate: r.igstRate,
      cgstRate: r.cgstRate,
      sgstRate: r.sgstRate,
    }));

  const {
    company,
    recipient,
    shipTo,
    document: doc,
    bank,
    adjustments,
    terms,
    payment,
    signature,
    taxColumnLabels,
    declaration,
  } = proforma;

  return {
    company: {
      ...company,
      address: company?.registeredOffice || company?.address || '',
    },
    bank: {
      accountHolder: bank?.accountHolder,
      bankName: bank?.bankName,
      accountNumber: bank?.accountNumber,
      branchName: bank?.bankBranch || bank?.branchName,
      ifscCode: bank?.ifscCode,
    },
    payment: payment || {},
    signature: signature || {},
    taxColumnLabels: taxColumnLabels || { rateLabel: 'GST Rate %', amountLabel: 'GST' },
    billTo: {
      name: recipient?.name || '',
      address: recipient?.placeOfSupply || '',
      stateName: recipient?.stateName || '',
      stateCode: recipient?.stateCode || '',
      gstin: recipient?.recipientGstin || '',
      pan: recipient?.recipientPan || '',
      contactPerson: recipient?.contactPerson || '',
      email: recipient?.contactEmail || '',
    },
    shipTo: {
      name: shipTo?.name || '',
      contactPerson: shipTo?.contactPerson || '',
      address: shipTo?.address || recipient?.deliveryAddress || '',
      gstin: shipTo?.gstin || '',
      stateName: shipTo?.stateName || '',
      stateCode: shipTo?.stateCode || '',
    },
    invoice: {
      documentNumber: doc?.documentNumber || '',
      projectName: doc?.servicePeriod || recipient?.projectName || '',
      servicePeriod: doc?.servicePeriod || recipient?.projectName || '',
      issueDate: doc?.issueDate || '',
      dueDate: doc?.dueDate || '',
      reverseCharge: 'N',
      placeOfSupply: recipient?.placeOfSupply || '',
      poReference: doc?.reference || '',
      poDate: doc?.referenceDate || '',
    },
    lineItems,
    adjustments: adjustments || {},
    terms: terms || [],
    declaration: declaration || '',
  };
}

const PATH_MAP = {
  'billTo.name': 'recipient.name',
  'billTo.address': 'recipient.placeOfSupply',
  'billTo.stateName': 'recipient.stateName',
  'billTo.stateCode': 'recipient.stateCode',
  'billTo.gstin': 'recipient.recipientGstin',
  'billTo.pan': 'recipient.recipientPan',
  'billTo.contactPerson': 'recipient.contactPerson',
  'billTo.email': 'recipient.contactEmail',
  'shipTo.name': 'shipTo.name',
  'shipTo.contactPerson': 'shipTo.contactPerson',
  'shipTo.address': 'shipTo.address',
  'shipTo.gstin': 'shipTo.gstin',
  'shipTo.stateName': 'shipTo.stateName',
  'shipTo.stateCode': 'shipTo.stateCode',
  'invoice.documentNumber': 'document.documentNumber',
  'invoice.projectName': 'document.servicePeriod',
  'invoice.servicePeriod': 'document.servicePeriod',
  'invoice.issueDate': 'document.issueDate',
  'invoice.dueDate': 'document.dueDate',
  'invoice.poReference': 'document.reference',
  'invoice.poDate': 'document.referenceDate',
  'taxColumnLabels.rateLabel': 'taxColumnLabels.rateLabel',
  'taxColumnLabels.amountLabel': 'taxColumnLabels.amountLabel',
};

export function invoicePathToProforma(path) {
  return PATH_MAP[path] || path;
}
