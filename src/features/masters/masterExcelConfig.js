/** Master One export / sample / import endpoints.
 *  Samples are CSV; bulk downloads may remain Excel.
 *  Sample column headers are defined server-side in *.excel.js modules.
 */
export const MASTER_EXCEL = {
  parties: {
    exportPath: '/logistics/parties/export',
    samplePath: '/logistics/parties/sample',
    importPath: '/logistics/parties/import',
    downloadFilename: 'Suppliers_Vendors.xlsx',
    sampleFilename: 'Suppliers_Vendors_Sample.csv',
  },
  'expense-categories': {
    exportPath: '/logistics/expense-categories/export',
    samplePath: '/logistics/expense-categories/sample',
    importPath: '/logistics/expense-categories/import',
    downloadFilename: 'Expense_Categories.xlsx',
    sampleFilename: 'Expense_Categories_Sample.csv',
  },
  products: {
    exportPath: '/logistics/products/export',
    samplePath: '/logistics/products/sample',
    importPath: '/logistics/products/import',
    downloadFilename: 'Products.xlsx',
    sampleFilename: 'Products_Sample.csv',
  },
  contacts: {
    exportPath: '/contacts/export',
    samplePath: '/contacts/sample',
    importPath: '/contacts/import',
    downloadFilename: 'Contact_Directory.xlsx',
    sampleFilename: 'Contact_Directory_Sample.csv',
  },
  templates: {
    exportPath: '/templates/export',
    samplePath: '/templates/sample',
    importPath: '/templates/import',
    downloadFilename: 'Document_Master.xlsx',
    sampleFilename: 'Document_Master_Sample.csv',
  },
  signatures: {
    exportPath: '/signatures/export',
    samplePath: '/signatures/sample',
    importPath: '/signatures/import',
    downloadFilename: 'Signature_Master.xlsx',
    sampleFilename: 'Signature_Master_Sample.csv',
  },
  'pin-codes': {
    exportPath: '/geo/pin-codes/export',
    samplePath: '/geo/pin-codes/sample',
    importPath: '/geo/pin-codes/import',
    downloadFilename: 'Pin_Code_Master.csv',
    sampleFilename: 'Pin_Code_Master_Sample.csv',
    importHint:
      'Supported: .csv UTF-8 (preferred), .xlsx, .xls, or .xlsb · columns State, District, Pin Codes · no 1,000-row limit · max 3 MB.',
  },
  'client-masters': {
    exportPath: '/camp-ops/client-masters/export',
    samplePath: '/camp-ops/client-masters/sample',
    importPath: '/camp-ops/client-masters/import',
    downloadFilename: 'Client_Master.xlsx',
    sampleFilename: 'Client_Master_Sample.csv',
  },
};

export function masterExcelFor(entityId) {
  return MASTER_EXCEL[entityId] || null;
}
