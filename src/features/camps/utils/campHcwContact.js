import { HCW_CATEGORIES } from '../constants/campLifecycle';

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

/** Service Provider organisation row in Contact Directory (assignable when resource type is Service Provider). */
export function isAssignableHealthcareWorkerOrg(contact) {
  if (!isHealthcareWorkerCategory(contact)) return false;
  return String(contact.resourceType || '').trim() === 'Service Provider';
}

function assignableContactsForResourceType(contacts = [], resourceType = '') {
  const hcw = contacts.filter(isHealthcareWorkerCategory);
  const rt = String(resourceType || '').trim();
  if (!rt) return hcw.filter((contact) => !isAssignableHealthcareWorkerOrg(contact));
  if (rt === 'Service Provider') {
    return hcw.filter(isAssignableHealthcareWorkerOrg);
  }
  return hcw.filter((contact) => {
    if (isAssignableHealthcareWorkerOrg(contact)) return false;
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

export function buildHcwAssignCascade(contacts = [], filters = {}) {
  const resourceType = String(filters.resourceType || '').trim();
  const profession = String(filters.profession || '').trim();
  const state = String(filters.state || '').trim();
  const city = String(filters.city || '').trim();

  const assignable = assignableContactsForResourceType(contacts, resourceType);
  const staffAssignable = filterAssignableHealthcareWorkers(contacts);

  const byResourceType = resourceType
    ? assignable
    : staffAssignable;

  const byProfession = profession
    ? byResourceType.filter((contact) => {
        if (isAssignableHealthcareWorkerOrg(contact)) return true;
        return String(contact.profession || '').trim() === profession;
      })
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
    states: uniqueSorted(byProfession.map((contact) => contact.state)),
    cities: uniqueSorted(byState.map((contact) => contact.city)),
    people: [...people].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))),
  };
}

export function findAssignableHealthcareWorker(contacts = [], contactId) {
  if (!contactId) return null;
  return (
    contacts.find(
      (contact) =>
        isHealthcareWorkerCategory(contact) && String(contact._id) === String(contactId),
    ) || null
  );
}
