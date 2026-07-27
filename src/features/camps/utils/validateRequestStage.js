import { toApiDateValue } from './dateFormat';
import { computeDurationHours } from './campSchedule';
import { resolveCampSlot } from '../constants/campLifecycle';
import { resolveZoneForState } from '../../../constants/geoZones.js';

function hasText(value) {
  return Boolean(String(value ?? '').trim());
}

function phoneDigits(value) {
  return String(value ?? '').replace(/\D/g, '');
}

/**
 * Returns human-readable validation messages for the Request stage.
 * Empty array means the camp can proceed to Resource Assignment / approval.
 */
export function validateRequestStageForm(form = {}) {
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

  if (!hasText(form.doctorName)) errors.push('Doctor name is required');
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

  const expectedPatients = Number(form.expectedPatients);
  if (!Number.isFinite(expectedPatients) || expectedPatients <= 0) {
    errors.push('Expected patients must be greater than zero');
  }

  if (!hasText(form.fieldPersonName)) errors.push('Contact person name is required');

  const phone = phoneDigits(form.fieldPersonPhone);
  if (phone.length < 6 || phone.length > 15) {
    errors.push('Contact person number must be 6–15 digits');
  }

  return errors;
}

export function isRequestStageComplete(form = {}) {
  return validateRequestStageForm(form).length === 0;
}
