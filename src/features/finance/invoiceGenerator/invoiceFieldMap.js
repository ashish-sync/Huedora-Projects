/**
 * Variable mapping — invoice form → enterprise template slots.
 * Use for API integration, PDF export, and external systems.
 */
export const INVOICE_FIELD_MAP = {
  company: {
    logo: 'company.logoDataUrl',
    legalName: 'company.legalName',
    tagline: 'company.brandLine',
    address: 'company.address',
    email: 'company.email',
    phone: 'company.phone',
    website: 'company.website',
    contactPerson: 'company.contactPerson',
    gstin: 'company.gstin',
    pan: 'company.pan',
    cin: 'company.cin',
    stateCode: 'company.stateCode',
    lutBondNo: 'company.lutBondNo',
    fssaiNo: 'company.fssaiNo',
    tan: 'company.tan',
    dlNo: 'company.dlNo',
  },
  invoice: {
    number: 'invoice.documentNumber',
    copyLabel: 'invoice.copyLabel',
    issueDate: 'invoice.issueDate',
    dueDate: 'invoice.dueDate',
    dispatchFrom: 'invoice.dispatchFrom',
    dispatchDate: 'invoice.dispatchDate',
    placeOfSupply: 'invoice.placeOfSupply',
    vendorCode: 'invoice.vendorCode',
    poReference: 'invoice.poReference',
    projectName: 'invoice.projectName',
    reverseCharge: 'invoice.reverseCharge',
  },
  billTo: {
    name: 'billTo.name',
    contactPerson: 'billTo.contactPerson',
    address: 'billTo.address',
    email: 'billTo.email',
    phone: 'billTo.phone',
    gstin: 'billTo.gstin',
    pan: 'billTo.pan',
    stateCode: 'billTo.stateCode',
  },
  shipTo: {
    name: 'shipTo.name',
    contactPerson: 'shipTo.contactPerson',
    address: 'shipTo.address',
    vehicleNo: 'shipTo.vehicleNo',
    shipBy: 'shipTo.shipBy',
    transporterName: 'shipTo.transporterName',
  },
  bank: {
    accountHolder: 'bank.accountHolder',
    bankName: 'bank.bankName',
    accountNumber: 'bank.accountNumber',
    branch: 'bank.branchName',
    ifsc: 'bank.ifscCode',
  },
  payment: {
    upiId: 'payment.upiId',
    qrImage: 'payment.paymentQrDataUrl',
  },
  signature: {
    image: 'signature.imageDataUrl',
    signatoryName: 'signature.signatoryName',
    companyLabel: 'signature.companyLabel',
  },
  lineItem: {
    description: 'description',
    subDescription: 'subDescription',
    hsnSac: 'hsnSac',
    qty: 'qty',
    uom: 'uom',
    rate: 'rate',
    discount: 'discount',
    igstRate: 'igstRate',
    cgstRate: 'cgstRate',
    sgstRate: 'sgstRate',
  },
  computed: {
    subtotal: 'totals.subtotal',
    totalDiscount: 'totals.totalDiscount',
    taxAmount: 'totals.taxAmount',
    roundOff: 'totals.roundOff',
    grandTotal: 'totals.grandTotal',
    amountInWords: 'totals.amountInWords',
    taxMode: 'taxMode',
  },
  meta: {
    terms: 'terms',
    declaration: 'declaration',
  },
};

/** Resolve dotted path on invoice form object */
export function getInvoiceField(form, path) {
  return path.split('.').reduce((obj, key) => (obj == null ? undefined : obj[key]), form);
}
