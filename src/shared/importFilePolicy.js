/** Tabular import policy — keep in sync with server spreadsheetLimits.js */
export const IMPORT_ACCEPT_EXTENSIONS = ['.csv', '.xlsx', '.xls', '.xlsb'];
export const IMPORT_ACCEPT_ATTR =
  '.csv,.xlsx,.xls,.xlsb,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel.sheet.binary.macroEnabled.12';
export const IMPORT_ACCEPT_HINT =
  'Supported: .csv UTF-8 (preferred), .xlsx, .xls, or .xlsb · max 1,000 rows · max 3 MB.';
export const IMPORT_SAMPLE_EXT = '.csv';
export const MAX_IMPORT_ROWS = 1000;
