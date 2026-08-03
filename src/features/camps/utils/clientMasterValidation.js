import { isValidCampMethod } from '../constants/campNames';
import { emailListError, emailError, isValidPhone, phoneError } from '../../../shared/validation.js';
import { normalizeHealthcareWorkers } from './healthcareWorkers.js';

const DURATION_PATTERN = /^(\d{1,2}):([0-5]\d)$/;

export function validateClientMasterForm(form) {
  const errors = {};

  const programName = String(form.programName || '').trim();
  if (!programName) {
    errors.programName = 'Program / division name is required';
  }

  const campType = String(form.campType || '').trim();
  if (!campType) {
    errors.campType = 'Camp type is required';
  }

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
    campName: 120,
    campType: 80,
    spocName: 80,
    spocEmail: 120,
    requestTimeline: 80,
  };

  Object.entries(stringLimits).forEach(([field, max]) => {
    const value = String(form[field] || '').trim();
    if (value && value.length > max) {
      errors[field] = `Must be ${max} characters or less`;
    }
  });

  const healthcareWorkers = normalizeHealthcareWorkers(form.healthcareWorker);
  if (healthcareWorkers.some((role) => role.length > 80)) {
    errors.healthcareWorker = 'Each role must be 80 characters or less';
  }

  const campName = String(form.campName || '').trim();
  if (!campName) {
    errors.campName = 'Method is required';
  } else if (!isValidCampMethod(campName)) {
    errors.campName = 'Select a valid method or specify Others';
  }

  const campDuration = String(form.campDuration || '').trim();
  if (campDuration && !DURATION_PATTERN.test(campDuration)) {
    errors.campDuration = 'Use duration format like 4:00 or 6:30';
  }

  const spocNumber = String(form.spocNumber || '').trim();
  const spocPhoneError = phoneError(spocNumber, 'SPOC mobile number');
  if (spocPhoneError) {
    errors.spocNumber = spocPhoneError;
  }

  const spocEmailError = emailError(form.spocEmail, 'SPOC email address');
  if (spocEmailError) {
    errors.spocEmail = spocEmailError;
  }

  const assignedEmailError = emailListError(form.assignedUserEmails, 'Assigned user email');
  if (assignedEmailError) {
    errors.assignedUserEmails = assignedEmailError;
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

  const billing = record.billing || record.client || {};
  return {
    clientId: clientId ? String(clientId) : '',
    clientName: keepClientName ? (record.clientName || '') : '',
    clientCode: record.clientCode || record.client?.code || '',
    billingAddress: billing.address || '',
    billingGstin: billing.gstin || '',
    billingPan: billing.pan || '',
    billingStateName: billing.stateName || '',
    billingStateCode: billing.stateCode || '',
    programName: record.programName || '',
    campName: record.campName || 'BMD',
    campType: record.campType || '',
    healthcareWorker: normalizeHealthcareWorkers(record.healthcareWorker),
    poAmount: String(record.poAmount ?? ''),
    campDuration: record.campDuration || '4:00',
    spocName: record.spocName || billing.contactPerson || '',
    spocNumber: record.spocNumber || billing.phone || '',
    spocEmail: record.spocEmail || billing.email || '',
    requestTimeline: record.requestTimeline || '',
    assignedUserEmails: Array.isArray(record.assignedUserEmails)
      ? record.assignedUserEmails.join(', ')
      : (record.assignedUserEmails || ''),
    executedCampUnit: String(record.executedCampUnit ?? ''),
    cancelledCampUnit: String(record.cancelledCampUnit ?? ''),
    otUnit: String(record.otUnit ?? ''),
    minimumPatientCovered: String(record.minimumPatientCovered ?? ''),
    minimumKmsCovered: String(record.minimumKmsCovered ?? ''),
    extPatientUnit: String(record.extPatientUnit ?? ''),
    kmsUnit: String(record.kmsUnit ?? ''),
    mappedConsumables: Array.isArray(record.mappedConsumables) ? record.mappedConsumables : [],
    isActive: record.isActive !== false,
  };
}
