import { toApiDateValue } from './dateFormat';
import { computeDurationHours } from './campSchedule';
import { resolveCampSlot } from '../constants/campLifecycle';
import { resolveZoneForState } from '../../../constants/geoZones.js';
import { isValidPhone } from '../../../shared/validation.js';
import { getDoctorNameFormatError } from '../../../shared/textFormat.js';
import { getHistoricalCampDateErrors } from './campDatePolicy.js';
import { CONTACT_PERSON_LEVEL_OPTIONS } from '../constants/campLifecycle.js';
import { normalizeContactPersons } from './campContactPersons.js';

function hasText(value) {
  return Boolean(String(value ?? '').trim());
}

/**
 * Returns human-readable validation messages for the Request stage.
 * Empty array means the camp can proceed to Resource Assignment / approval.
 */
export function validateRequestStageForm(form = {}, options = {}) {
  const errors = [];

  if (!hasText(form.source)) errors.push('Source of request is required');
  if (!hasText(form.clientId)) errors.push('Client name is required');
  if (!hasText(form.campaignType)) errors.push('Division / therapy is required');
  if (!hasText(form.campaignName)) errors.push('Method is required');

  const campDate = toApiDateValue(form.campDate);
  if (!campDate) errors.push('Camp date is required');

  const startTime = String(form.startTime || '').trim();
  const endTime = String(form.endTime || '').trim();
  if (!/^\d{1,2}:\d{2}$/.test(startTime)) errors.push('Camp start time is required');
  if (!/^\d{1,2}:\d{2}$/.test(endTime)) errors.push('Camp end time is required');
  if (startTime && endTime) {
    const duration = computeDurationHours(startTime, endTime);
    if (!Number.isFinite(duration) || duration <= 0) {
      errors.push('Camp end time must be after start time');
    }
  }
  if (startTime && !resolveCampSlot(startTime)) {
    errors.push('Camp start time must fall within Morning, Noon, or Evening slot hours');
  }

  const doctorNameError = getDoctorNameFormatError(form.doctorName);
  if (doctorNameError) errors.push(doctorNameError);
  if (!hasText(form.doctorCode)) errors.push('Doctor code is required');
  if (!hasText(form.campAddress)) errors.push('Camp address is required');
  if (!hasText(form.state)) errors.push('State is required');
  if (!hasText(form.district)) errors.push('District is required');
  if (!hasText(form.city)) errors.push('City is required');
  if (!/^\d{6}$/.test(String(form.pincode || '').trim())) errors.push('Valid 6-digit pin code is required');
  if (!hasText(form.hq)) errors.push('HQ is required');
  const stateName = String(form.state || '').trim();
  const zone = String(form.zone || '').trim();
  if (!zone) {
    errors.push('Zone is required');
  } else if (stateName) {
    const expected = resolveZoneForState(stateName);
    if (expected && expected !== zone) {
      errors.push(`Zone must be ${expected} for ${stateName}`);
    }
  }

  const expectedPatientsRaw = String(form.expectedPatients ?? '').trim();
  if (!expectedPatientsRaw) {
    errors.push('Expected patients is required');
  } else if (!/^\d+$/.test(expectedPatientsRaw)) {
    errors.push('Expected patients must be a whole number');
  }

  const contacts = normalizeContactPersons(form);
  contacts.forEach((contact, index) => {
    const label = contacts.length > 1 ? `Contact person ${index + 1}` : 'Contact person';
    const level = String(contact.level || '').trim();
    if (!CONTACT_PERSON_LEVEL_OPTIONS.some((opt) => opt.value === level)) {
      errors.push(`${label} level is required`);
    }
    if (!hasText(contact.name)) errors.push(`${label} name is required`);
    if (!isValidPhone(contact.phone)) {
      errors.push(`${label} number must be exactly 10 digits`);
    }
  });

  errors.push(...getHistoricalCampDateErrors(
    { campDate: form.campDate, requestDate: form.requestDate },
    {
      canSetHistorical: options.canSetHistorical === true,
      existing: options.existing || null,
    },
  ));

  return errors;
}

export function isRequestStageComplete(form = {}) {
  return validateRequestStageForm(form).length === 0;
}
