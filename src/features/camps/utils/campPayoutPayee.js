import {
  isAssignableHealthcareWorkerOrg,
} from './campHcwContact.js';

/** Embedded roster employee ids look like `spe:<providerId>:<employeeId>`. */
export function embeddedServiceProviderId(assignmentId = '') {
  const raw = String(assignmentId || '').trim();
  if (!raw.startsWith('spe:')) return '';
  const parts = raw.split(':');
  return String(parts[1] || '').trim();
}

/**
 * Who gets paid for a camp assignment.
 * Service Provider path → agency; otherwise the assigned HCW employee/individual.
 */
export function resolveCampPayoutPayee(assignedContact, contacts = []) {
  if (!assignedContact) {
    return {
      assignedContact: null,
      payeeContact: null,
      payeeContactId: '',
      payeeName: '',
      payeeIsServiceProvider: false,
    };
  }

  const byId = new Map(
    (Array.isArray(contacts) ? contacts : [])
      .filter((row) => row?._id != null)
      .map((row) => [String(row._id), row]),
  );

  const assignedId = String(assignedContact._id || '').trim();
  const embeddedProviderId = embeddedServiceProviderId(assignedId);
  const linkedProviderId = String(assignedContact.serviceProviderContactId || '').trim();
  const providerId = embeddedProviderId || linkedProviderId;

  if (providerId) {
    const provider = byId.get(String(providerId)) || null;
    return {
      assignedContact,
      payeeContact: provider,
      payeeContactId: provider?._id || providerId,
      payeeName: String(provider?.name || assignedContact.serviceProviderName || '').trim(),
      payeeIsServiceProvider: true,
    };
  }

  if (isAssignableHealthcareWorkerOrg(assignedContact)) {
    return {
      assignedContact,
      payeeContact: assignedContact,
      payeeContactId: assignedContact._id || '',
      payeeName: String(assignedContact.name || '').trim(),
      payeeIsServiceProvider: true,
    };
  }

  return {
    assignedContact,
    payeeContact: assignedContact,
    payeeContactId: assignedContact._id || '',
    payeeName: String(assignedContact.name || '').trim(),
    payeeIsServiceProvider: false,
  };
}
