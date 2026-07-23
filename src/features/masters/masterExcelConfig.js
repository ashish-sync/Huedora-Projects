/** Excel export/sample/import endpoints for Master One entities. */
export const MASTER_EXCEL = {
  parties: {
    exportPath: '/logistics/parties/export',
    samplePath: '/logistics/parties/sample',
    importPath: '/logistics/parties/import',
    downloadFilename: 'Suppliers_Vendors.xlsx',
    sampleFilename: 'Suppliers_Vendors_Sample.xlsx',
  },
  'expense-categories': {
    exportPath: '/logistics/expense-categories/export',
    samplePath: '/logistics/expense-categories/sample',
    importPath: '/logistics/expense-categories/import',
    downloadFilename: 'Expense_Categories.xlsx',
    sampleFilename: 'Expense_Categories_Sample.xlsx',
  },
  products: {
    exportPath: '/logistics/products/export',
    samplePath: '/logistics/products/sample',
    importPath: '/logistics/products/import',
    downloadFilename: 'Products.xlsx',
    sampleFilename: 'Products_Sample.xlsx',
  },
  contacts: {
    exportPath: '/contacts/export',
    samplePath: '/contacts/sample',
    importPath: '/contacts/import',
    downloadFilename: 'Contact_Directory.xlsx',
    sampleFilename: 'Contact_Directory_Sample.xlsx',
  },
  templates: {
    exportPath: '/templates/export',
    samplePath: '/templates/sample',
    importPath: '/templates/import',
    downloadFilename: 'Document_Master.xlsx',
    sampleFilename: 'Document_Master_Sample.xlsx',
  },
  signatures: {
    exportPath: '/signatures/export',
    samplePath: '/signatures/sample',
    importPath: '/signatures/import',
    downloadFilename: 'Signature_Master.xlsx',
    sampleFilename: 'Signature_Master_Sample.xlsx',
  },
  'pin-codes': {
    exportPath: '/geo/pin-codes/export',
    samplePath: '/geo/pin-codes/sample',
    importPath: '/geo/pin-codes/import',
    downloadFilename: 'Geography_PIN_Codes.xlsx',
    sampleFilename: 'Geography_PIN_Codes_Sample.xlsx',
  },
  'client-masters': {
    exportPath: '/camp-ops/client-masters/export',
    samplePath: '/camp-ops/client-masters/sample',
    importPath: '/camp-ops/client-masters/import',
    downloadFilename: 'Client_Master.xlsx',
    sampleFilename: 'Client_Master_Sample.xlsx',
  },
};

export function masterExcelFor(entityId) {
  return MASTER_EXCEL[entityId] || null;
}
