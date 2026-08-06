/** Browser-side finance drafts, org cache, and document number sequences. */
export const FINANCE_LOCAL_STORAGE_KEYS = [
  'tylo_one_invoice_generator_v1',
  'tylo_one_invoice_number_seq',
  'tylo_one_proforma_generator_v1',
  'tylo_one_proforma_number_seq',
  'tylo_one_purchase_order_generator_v1',
  'tylo_one_purchase_order_number_seq',
  'tylo_one_credit_note_generator_v1',
  'tylo_one_credit_note_number_seq',
  'tylo_one_debit_note_generator_v1',
  'tylo_one_debit_note_number_seq',
  'tylo_one_delivery_challan_generator_v1',
  'tylo_one_delivery_challan_number_seq',
  'tylo_one_bill_of_supply_generator_v1',
  'tylo_one_bill_of_supply_number_seq',
  'tylo_one_quotation_generator_v1',
  'tylo_one_quotation_number_seq',
  'tylo_commercial_org_master_v1',
];

/** Bump when a full finance local reset should run for all users (local + live). */
export const FINANCE_LOCAL_RESET_VERSION = '2026-08-04-org-cache-quota';

const RESET_VERSION_KEY = 'tylo_finance_local_reset_version';

export function clearFinanceLocalData() {
  if (typeof window === 'undefined' || !window.localStorage) return;
  FINANCE_LOCAL_STORAGE_KEYS.forEach((key) => {
    window.localStorage.removeItem(key);
  });
}

/** One-shot wipe after deploy — clears filled drafts and uploaded org cache in the browser. */
export function applyFinanceLocalResetIfNeeded() {
  if (typeof window === 'undefined' || !window.localStorage) return;
  if (localStorage.getItem(RESET_VERSION_KEY) === FINANCE_LOCAL_RESET_VERSION) return;
  clearFinanceLocalData();
  localStorage.setItem(RESET_VERSION_KEY, FINANCE_LOCAL_RESET_VERSION);
}
