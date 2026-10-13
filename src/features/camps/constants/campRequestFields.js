/**
 * Camp One request-stage field labels and order.
 * Keep in sync with server manualPasteFieldConfig.json requestStageFields.
 *
 * Contact columns: TM/AM/RM/ZM/PM Name + Number (at least one level required on import).
 * Legacy Contact Person Level/Name/Number still map when present in older files.
 */
export const CAMP_REQUEST_FIELD_LABELS = {
  source: 'Source of Request',
  clientName: 'Client Name',
  campaignType: 'Division / Therapy',
  campaignName: 'Method',
  campDate: 'Camp Date',
  requestDate: 'Request Date',
  startTime: 'Camp Start Time',
  endTime: 'Camp End Time',
  doctorName: 'Doctor Name',
  doctorCode: 'Doctor Code',
  speciality: 'Doctor Type / Specialty',
  campAddress: 'Camp / Clinic Address',
  pincode: 'PIN Code',
  city: 'City',
  expectedPatients: 'Expected Patients',
  tmName: 'TM Name',
  tmPhone: 'TM Number',
  amName: 'AM Name',
  amPhone: 'AM Number',
  rmName: 'RM Name',
  rmPhone: 'RM Number',
  zmName: 'ZM Name',
  zmPhone: 'ZM Number',
  pmName: 'PM Name',
  pmPhone: 'PM Number',
};

export const CAMP_REQUEST_FIELD_ORDER = [
  'source',
  'clientName',
  'campaignType',
  'campaignName',
  'campDate',
  'requestDate',
  'startTime',
  'endTime',
  'doctorName',
  'doctorCode',
  'speciality',
  'campAddress',
  'pincode',
  'city',
  'expectedPatients',
  'tmName',
  'tmPhone',
  'amName',
  'amPhone',
  'rmName',
  'rmPhone',
  'zmName',
  'zmPhone',
  'pmName',
  'pmPhone',
];

/** Context fields set from the paste wizard UI rather than tabular columns. */
export const CAMP_IMPORT_CONTEXT_KEYS = ['clientName', 'campaignType', 'campaignName'];

export const CAMP_IMPORT_TABULAR_FIELDS = CAMP_REQUEST_FIELD_ORDER.filter(
  (key) => !CAMP_IMPORT_CONTEXT_KEYS.includes(key),
);
