/** Tabular import policy — keep in sync with server spreadsheetLimits.js */
export const IMPORT_ACCEPT_ATTR =
  '.csv,.xlsb,text/csv,application/vnd.ms-excel.sheet.binary.macroEnabled.12';
export const IMPORT_ACCEPT_HINT =
  'Supported: .csv (preferred) or .xlsb · max 1,000 rows · max 3 MB. In Excel: File → Save As → CSV.';
export const IMPORT_SAMPLE_EXT = '.csv';
export const MAX_IMPORT_ROWS = 1000;
