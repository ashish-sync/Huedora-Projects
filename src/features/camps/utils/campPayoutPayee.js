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

export function embeddedServiceProviderEmployeeId(assignmentId = '') {
  const raw = String(assignmentId || '').trim();
  if (!raw.startsWith('spe:')) return '';
  const parts = raw.split(':');
  return parts.slice(2).join(':').trim();
}

export function findEmbeddedProviderEmployee(provider, assignmentId = '') {
  const employees = Array.isArray(provider?.providerEmployees) ? provider.providerEmployees : [];
  if (!employees.length) return null;
  const employeeId = embeddedServiceProviderEmployeeId(assignmentId);
  if (!employeeId) return null;
  const byId = employees.find((emp) => String(emp?.id || '').trim() === employeeId);
  if (byId) return byId;
  return employees.find((emp) => {
    const name = String(emp?.name || '').trim();
    const mobile = String(emp?.mobile || emp?.contact || '').trim();
    return `${name}:${mobile}` === employeeId;
  }) || null;
}

export function campAmountFromContact(contact) {
  const n = Number(contact?.campAmount);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Camp Payout amount for the assigned HCW.
 * Service Provider path pays the agency, but the rate belongs to the employee.
 */
export function campAmountForAssignedHcw({
  assignmentId = '',
  assignedContact = null,
  payeeContact = null,
} = {}) {
  const assignedId = String(assignmentId || assignedContact?._id || '').trim();
  const provider = payeeContact
    || (isAssignableHealthcareWorkerOrg(assignedContact) ? assignedContact : null);
  const employee = findEmbeddedProviderEmployee(provider, assignedId);
  if (employee) {
    return campAmountFromContact(employee) || campAmountFromContact(provider);
  }
  return campAmountFromContact(assignedContact);
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
