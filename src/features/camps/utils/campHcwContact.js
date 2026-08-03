import { HCW_CATEGORIES } from '../constants/campLifecycle';
import { normalizeHealthcareWorkers } from './healthcareWorkers.js';

export const HCW_CONTACT_CATEGORY = 'Healthcare Worker';

const LEGACY_HCW_PROFESSIONS = new Set(
  ['technician', 'phlebotomist', 'dietitian', 'dietician', 'doctor', 'nurse', 'physio'],
);

export function isHealthcareWorkerCategory(contact) {
  return String(contact?.contactCategory || '').trim() === HCW_CONTACT_CATEGORY;
}

/** Assignable camp HCW staff: Healthcare Worker category, not a Service Provider org record. */
export function isAssignableHealthcareWorker(contact) {
  if (!isHealthcareWorkerCategory(contact)) return false;
  return String(contact.resourceType || '').trim() !== 'Service Provider';
}

/** Service Provider organisation row in Contact Directory (never assigned to a camp). */
export function isAssignableHealthcareWorkerOrg(contact) {
  if (!isHealthcareWorkerCategory(contact)) return false;
  return String(contact.resourceType || '').trim() === 'Service Provider';
}

function providerByIdMap(contacts = []) {
  const map = new Map();
  contacts.filter(isAssignableHealthcareWorkerOrg).forEach((provider) => {
    map.set(String(provider._id), provider);
  });
  return map;
}

function enrichStaffWithProvider(contact, providersById) {
  const providerId = String(contact.serviceProviderContactId || '').trim();
  const provider = providerId ? providersById.get(providerId) : null;
  return {
    ...contact,
    state: String(contact.state || '').trim() || provider?.state || '',
    city: String(contact.city || '').trim() || provider?.city || '',
    serviceProviderName: contact.serviceProviderName || provider?.name || '',
  };
}

/**
 * Employees under Service Providers in Contact Directory:
 * - linked Full-Time / Individual contacts with serviceProviderContactId
 * - embedded providerEmployees roster on the agency record
 */
export function listServiceProviderEmployees(contacts = []) {
  const providersById = providerByIdMap(contacts);
  const linked = contacts
    .filter((contact) => (
      isAssignableHealthcareWorker(contact)
      && String(contact.serviceProviderContactId || '').trim()
    ))
    .map((contact) => ({
      ...enrichStaffWithProvider(contact, providersById),
      isProviderEmployee: false,
    }));

  const linkedKeys = new Set(
    linked.map((contact) => `${String(contact.contact || contact.mobile || '').trim()}|${normalizeHcwProfessionKey(contact.profession)}`),
  );

  const embedded = [];
  contacts.filter(isAssignableHealthcareWorkerOrg).forEach((provider) => {
    (Array.isArray(provider.providerEmployees) ? provider.providerEmployees : []).forEach((employee) => {
      const name = String(employee?.name || '').trim();
      if (!name) return;
      const mobile = String(employee?.mobile || employee?.contact || '').trim();
      const profession = String(employee?.profession || '').trim();
      const dedupeKey = `${mobile}|${normalizeHcwProfessionKey(profession)}`;
      if (mobile && linkedKeys.has(dedupeKey)) return;

      const employeeId = String(employee?.id || '').trim() || `${name}:${mobile}`;
      embedded.push({
        _id: `spe:${provider._id}:${employeeId}`,
        contactCategory: HCW_CONTACT_CATEGORY,
        resourceType: 'Service Provider',
        name,
        contact: mobile,
        mobile,
        profession,
        state: provider.state || '',
        city: provider.city || '',
        serviceProviderContactId: provider._id,
        serviceProviderName: provider.name || '',
        isProviderEmployee: true,
      });
    });
  });

  return [...linked, ...embedded];
}

/** Resource type shown in Assignment for an already-selected contact. */
export function assignmentResourceTypeForContact(contact) {
  if (!contact) return '';
  if (contact.isProviderEmployee || String(contact.serviceProviderContactId || '').trim()) {
    return 'Service Provider';
  }
  return String(contact.resourceType || '').trim();
}

function assignableContactsForResourceType(contacts = [], resourceType = '') {
  const rt = String(resourceType || '').trim();
  if (!rt) return filterAssignableHealthcareWorkers(contacts);
  if (rt === 'Service Provider') {
    return listServiceProviderEmployees(contacts);
  }
  return contacts.filter((contact) => {
    if (!isAssignableHealthcareWorker(contact)) return false;
    return String(contact.resourceType || '').trim() === rt;
  });
}

/** @deprecated Use isAssignableHealthcareWorker — kept for legacy Resource contacts in old data. */
export function isHcwContact(contact) {
  if (isAssignableHealthcareWorker(contact)) return true;
  if (!contact) return false;
  const category = String(contact.contactCategory || '').trim();
  if (category === 'Resource') {
    const profession = String(contact.profession || '').trim().toLowerCase();
    return LEGACY_HCW_PROFESSIONS.has(profession);
  }
  const profession = String(contact.profession || '').trim().toLowerCase();
  return LEGACY_HCW_PROFESSIONS.has(profession);
}

export function mapProfessionToHcwCategory(profession) {
  const value = String(profession || '').trim().toLowerCase();
  if (value === 'technician') return 'Technician';
  if (value === 'phlebotomist') return 'Phlebotomist';
  if (value === 'dietitian' || value === 'dietician') return 'Dietician';
  if (HCW_CATEGORIES.includes(profession)) return profession;
  return profession ? 'Other' : '';
}

export function contactPhone(contact) {
  return String(contact?.contact || contact?.mobile || '').trim();
}

export function contactToHcwFields(contact) {
  if (!contact) {
    return {
      hcwContactId: '',
      hcwCategory: '',
      hcwName: '',
      hcwContact: '',
    };
  }
  return {
    hcwContactId: contact._id || '',
    hcwCategory: mapProfessionToHcwCategory(contact.profession),
    hcwName: String(contact.name || '').trim(),
    hcwContact: contactPhone(contact),
  };
}

export function filterAssignableHealthcareWorkers(contacts = []) {
  return contacts.filter(isAssignableHealthcareWorker);
}

export function filterHcwContacts(contacts = []) {
  return filterAssignableHealthcareWorkers(contacts);
}

function uniqueSorted(values = []) {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
}

/** Normalize profession labels so Client Master / Contact Directory aliases match. */
export function normalizeHcwProfessionKey(value = '') {
  const key = String(value || '').trim().toLowerCase();
  if (!key) return '';
  if (key === 'dietician' || key === 'dietitian') return 'dietitian';
  return key;
}

export function professionsMatch(a = '', b = '') {
  const left = normalizeHcwProfessionKey(a);
  const right = normalizeHcwProfessionKey(b);
  return Boolean(left && right && left === right);
}

export function buildHcwAssignCascade(contacts = [], filters = {}) {
  const resourceType = String(filters.resourceType || '').trim();
  const professions = normalizeHealthcareWorkers(
    filters.professions ?? filters.profession ?? [],
  );
  const state = String(filters.state || '').trim();
  const city = String(filters.city || '').trim();

  const assignable = assignableContactsForResourceType(contacts, resourceType);
  const staffAssignable = filterAssignableHealthcareWorkers(contacts);

  const byResourceType = resourceType
    ? assignable
    : staffAssignable;

  const byProfession = professions.length
    ? byResourceType.filter((contact) => (
      professions.some((role) => professionsMatch(contact.profession, role))
    ))
    : byResourceType;

  const byState = state
    ? byProfession.filter((contact) => String(contact.state || '').trim() === state)
    : byProfession;

  const people = city
    ? byState.filter((contact) => String(contact.city || '').trim() === city)
    : byState;

  return {
    assignable: resourceType ? assignable : staffAssignable,
    resourceTypes: uniqueSorted(
      contacts
        .filter(isHealthcareWorkerCategory)
        .map((contact) => contact.resourceType),
    ),
    professions: uniqueSorted(byResourceType.map((contact) => contact.profession)),
    /** All staff professions across resource types — same concept as Client Master Healthcare Worker. */
    allStaffProfessions: uniqueSorted(
      staffAssignable.map((contact) => contact.profession),
    ),
    states: uniqueSorted(byProfession.map((contact) => contact.state)),
    cities: uniqueSorted(byState.map((contact) => contact.city)),
    people: [...people].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))),
  };
}

export function findAssignableHealthcareWorker(contacts = [], contactId) {
  if (!contactId) return null;
  const id = String(contactId);
  const providersById = providerByIdMap(contacts);

  const direct = contacts.find(
    (contact) =>
      isHealthcareWorkerCategory(contact) && String(contact._id) === id,
  );
  if (direct) {
    if (isAssignableHealthcareWorkerOrg(direct)) return null;
    return enrichStaffWithProvider(direct, providersById);
  }

  return listServiceProviderEmployees(contacts).find(
    (contact) => String(contact._id) === id,
  ) || null;
}
