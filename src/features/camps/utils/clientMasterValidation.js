import { CAMP_NAME_OPTIONS } from '../constants/campNames';

const DURATION_PATTERN = /^(\d{1,2}):([0-5]\d)$/;

export function validateClientMasterForm(form) {
  const errors = {};

  const clientName = String(form.clientName || '').trim();
  if (!clientName) {
    errors.clientName = 'Client name is required';
  } else if (clientName.length < 2) {
    errors.clientName = 'Client name must be at least 2 characters';
  } else if (clientName.length > 120) {
    errors.clientName = 'Client name must be 120 characters or less';
  }

  const clientCode = String(form.clientCode || '').trim();
  if (clientCode && !/^[A-Z0-9_-]{2,20}$/i.test(clientCode)) {
    errors.clientCode = 'Client code must be 2–20 letters, numbers, hyphen or underscore';
  }

  const stringLimits = {
    programName: 160,
    drugTherapyName: 120,
    campName: 120,
    campType: 80,
    coordinatorName: 80,
    healthcareWorker: 80,
    spocName: 80,
    requestTimeline: 80,
  };

  Object.entries(stringLimits).forEach(([field, max]) => {
    const value = String(form[field] || '').trim();
    if (value && value.length > max) {
      errors[field] = `Must be ${max} characters or less`;
    }
  });

  const campName = String(form.campName || '').trim();
  if (campName && !CAMP_NAME_OPTIONS.includes(campName)) {
    errors.campName = 'Select a valid camp name';
  }

  const campDuration = String(form.campDuration || '').trim();
  if (campDuration && !DURATION_PATTERN.test(campDuration)) {
    errors.campDuration = 'Use duration format like 4:00 or 6:30';
  }

  const spocNumber = String(form.spocNumber || '').trim();
  if (spocNumber && !/^\d{6,15}$/.test(spocNumber)) {
    errors.spocNumber = 'SPOC number must be 6–15 digits';
  }

  const nonNegativeNumbers = [
    'poAmount',
    'executedCampUnit',
    'cancelledCampUnit',
    'otUnit',
    'minimumPatientCovered',
    'minimumKmsCovered',
    'extPatientUnit',
    'kmsUnit',
  ];

  nonNegativeNumbers.forEach((field) => {
    const raw = form[field];
    if (raw === '' || raw == null) return;
    const value = Number(raw);
    if (Number.isNaN(value)) {
      errors[field] = 'Must be a valid number';
    } else if (value < 0) {
      errors[field] = 'Must be zero or greater';
    } else if (!Number.isInteger(value) && field !== 'poAmount') {
      errors[field] = 'Must be a whole number';
    } else if (field === 'poAmount' && value > 999999999) {
      errors[field] = 'PO amount is too large';
    }
  });

  return errors;
}

export function hasValidationErrors(errors) {
  return Object.keys(errors).length > 0;
}

export function recordToForm(record, { keepClientName = true } = {}) {
  const clientRef = record.client;
  const clientId = typeof clientRef === 'object' && clientRef?._id
    ? clientRef._id
    : (clientRef || '');

  return {
    clientId: clientId ? String(clientId) : '',
    clientName: keepClientName ? (record.clientName || '') : '',
    clientCode: record.client?.code || '',
    programName: record.programName || '',
    drugTherapyName: record.drugTherapyName || '',
    campName: record.campName || 'BMD',
    campType: record.campType || '',
    coordinatorName: record.coordinatorName || '',
    healthcareWorker: record.healthcareWorker || '',
    poAmount: String(record.poAmount ?? ''),
    campDuration: record.campDuration || '4:00',
    spocName: record.spocName || '',
    spocNumber: record.spocNumber || '',
    requestTimeline: record.requestTimeline || '',
    executedCampUnit: String(record.executedCampUnit ?? ''),
    cancelledCampUnit: String(record.cancelledCampUnit ?? ''),
    otUnit: String(record.otUnit ?? ''),
    minimumPatientCovered: String(record.minimumPatientCovered ?? ''),
    minimumKmsCovered: String(record.minimumKmsCovered ?? ''),
    extPatientUnit: String(record.extPatientUnit ?? ''),
    kmsUnit: String(record.kmsUnit ?? ''),
    isActive: record.isActive !== false,
  };
}
