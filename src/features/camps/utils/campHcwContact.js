import { HCW_CATEGORIES } from '../constants/campLifecycle';

const HCW_CONTACT_CATEGORIES = new Set(['Healthcare Worker', 'Resource']);

export function isHcwContact(contact) {
  if (!contact) return false;
  const category = String(contact.contactCategory || '').trim();
  if (HCW_CONTACT_CATEGORIES.has(category)) return true;
  const profession = String(contact.profession || '').trim().toLowerCase();
  return ['technician', 'phlebotomist', 'dietitian', 'dietician', 'doctor', 'nurse', 'physio'].includes(profession);
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

export function filterHcwContacts(contacts = []) {
  return contacts.filter(isHcwContact);
}
