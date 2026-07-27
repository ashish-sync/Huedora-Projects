/**
 * Camp One request-stage field labels and order.
 * Keep in sync with server manualPasteFieldConfig.json requestStageFields.
 */
export const CAMP_REQUEST_FIELD_LABELS = {
  clientName: 'Client Name',
  campaignType: 'Division / Therapy',
  campaignName: 'Method',
  campDate: 'Camp Date',
  startTime: 'Camp Start Time',
  endTime: 'Camp End Time',
  doctorName: 'Doctor Name',
  doctorCode: 'Doctor Code',
  speciality: 'Doctor Speciality',
  hospitalName: 'Clinic / Hospital Name',
  campAddress: 'Camp Address',
  pincode: 'PIN Code',
  state: 'State',
  zone: 'Zone',
  district: 'District',
  city: 'City',
  hq: 'HQ',
  fieldPersonName: 'Contact Person Name',
  expectedPatients: 'Expected Patients',
  fieldPersonPhone: 'Contact Person Number',
  remarks: 'Remarks',
};

export const CAMP_REQUEST_FIELD_ORDER = [
  'clientName',
  'campaignType',
  'campaignName',
  'campDate',
  'startTime',
  'endTime',
  'doctorName',
  'doctorCode',
  'speciality',
  'hospitalName',
  'campAddress',
  'pincode',
  'state',
  'zone',
  'district',
  'city',
  'hq',
  'fieldPersonName',
  'expectedPatients',
  'fieldPersonPhone',
  'remarks',
];

export const CAMP_IMPORT_TABULAR_FIELDS = CAMP_REQUEST_FIELD_ORDER.filter(
  (key) => !['clientName', 'campaignType', 'campaignName'].includes(key),
);
