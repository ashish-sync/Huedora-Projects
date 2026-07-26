import { HCW_CATEGORIES } from '../constants/campLifecycle';

export const HCW_CONTACT_CATEGORY = 'Healthcare Worker';

const LEGACY_HCW_PROFESSIONS = new Set(
  ['technician', 'phlebotomist', 'dietitian', 'dietician', 'doctor', 'nurse', 'physio'],
);

export function isHealthcareWorkerCategory(contact) {
  return String(contact?.contactCategory || '').trim() === HCW_CONTACT_CATEGORY;
}

/** Assignable camp HCW: Healthcare Worker category, not a Service Provider org record. */
export function isAssignableHealthcareWorker(contact) {
  if (!isHealthcareWorkerCategory(contact)) return false;
  return String(contact.resourceType || '').trim() !== 'Service Provider';
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
  const assignable = filterAssignableHealthcareWorkers(contacts);
  const resourceType = String(filters.resourceType || '').trim();
  const profession = String(filters.profession || '').trim();
  const city = String(filters.city || '').trim();

  const byResourceType = resourceType
    ? assignable.filter((contact) => String(contact.resourceType || '').trim() === resourceType)
    : assignable;

  const byProfession = profession
    ? byResourceType.filter((contact) => String(contact.profession || '').trim() === profession)
    : byResourceType;

  const people = city
    ? byProfession.filter((contact) => String(contact.city || '').trim() === city)
    : byProfession;

  return {
    assignable,
    resourceTypes: uniqueSorted(assignable.map((contact) => contact.resourceType)),
    professions: uniqueSorted(byResourceType.map((contact) => contact.profession)),
    cities: uniqueSorted(byProfession.map((contact) => contact.city)),
    people: [...people].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))),
  };
}

export function findAssignableHealthcareWorker(contacts = [], contactId) {
  if (!contactId) return null;
  return filterAssignableHealthcareWorkers(contacts).find(
    (contact) => String(contact._id) === String(contactId),
  ) || null;
}
