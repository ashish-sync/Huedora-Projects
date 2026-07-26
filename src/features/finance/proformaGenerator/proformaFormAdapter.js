/** Map proforma form shape → invoice preview shape (Tylo template). */
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

  const { company, recipient, document: doc, bank, adjustments, terms, payment, signature, taxColumnLabels } = proforma;

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
    taxColumnLabels: taxColumnLabels || { rateLabel: 'GST %', amountLabel: 'GST' },
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
    invoice: {
      documentNumber: doc?.documentNumber || '',
      projectName: recipient?.projectName || '',
      issueDate: doc?.issueDate || '',
      dueDate: doc?.dueDate || '',
      reverseCharge: 'N',
      placeOfSupply: recipient?.placeOfSupply || '',
      receiptVoucherNo: doc?.reference || '',
      cnReference: '',
      dnReference: '',
    },
    lineItems,
    adjustments: adjustments || {},
    terms: terms || [],
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
  'invoice.documentNumber': 'document.documentNumber',
  'invoice.projectName': 'recipient.projectName',
  'invoice.issueDate': 'document.issueDate',
  'invoice.dueDate': 'document.dueDate',
  'invoice.receiptVoucherNo': 'document.reference',
  'taxColumnLabels.rateLabel': 'taxColumnLabels.rateLabel',
  'taxColumnLabels.amountLabel': 'taxColumnLabels.amountLabel',
};

export function invoicePathToProforma(path) {
  return PATH_MAP[path] || path;
}
