/** Shared with Contact Directory, New Agreement wizard, and Asset Register */

export const CONTACT_CATEGORIES = ['Resource', 'Client', 'Vendor'];

export const RESOURCE_TYPES = [
  'Full-Time',
  'Contractual',
  'Freelancer',
  'Consultant',
  'Service Provider',
  'Individual',
  'Other',
];

/** Default Profession / Role when Contact Category is Resource */
export const PROFESSIONS = [
  'Technician',
  'Phlebotomist',
  'Dietitian',
  'Doctor',
  'Nurse',
  'Biomedical Engineer',
  'Project Manager',
  'Operations Executive',
  'Human Resources',
  'Finance',
  'IT Support',
  'Administration',
  'Procurement',
  'Other',
];

/** Profession / Role when Contact Category is Client */
export const CLIENT_PROFESSIONS = [
  'Finance',
  'Product Manager',
  'Admin',
  'Procurement',
  'Other',
];

/** Profession / Role when Contact Category is Vendor */
export const VENDOR_PROFESSIONS = [
  'Sales Executive',
  'Service Engineer',
  'Operations Executive',
  'Finance Executive',
  'Owner / Proprietor',
  'Other',
];

export function professionsForCategory(contactCategory) {
  if (contactCategory === 'Client') return CLIENT_PROFESSIONS;
  if (contactCategory === 'Vendor') return VENDOR_PROFESSIONS;
  return PROFESSIONS;
}

export function professionPicklistKey(contactCategory) {
  if (contactCategory === 'Client') return 'contact.profession.client';
  if (contactCategory === 'Vendor') return 'contact.profession.vendor';
  return 'contact.profession';
}

/** Supply Category — only when Contact Category is Vendor */
export const SUPPLY_CATEGORIES = [
  'Medical Devices',
  'Medical Consumables',
  'Printing & Branding',
  'Office Supplies & Stationery',
  'Courier & Logistics',
  'IT Hardware & Software',
  'Biomedical Service & AMC',
  'Facility & Housekeeping',
  'Recruitment & Staffing',
  'Travel & Transport',
  'Catering',
  'Other',
];

export function isVendorContact(contact) {
  if (!contact) return false;
  const cat = String(contact.contactCategory || '').trim().toLowerCase();
  if (cat === 'vendor') return true;
  const rt = String(contact.resourceType || '').trim().toLowerCase();
  return rt === 'vendor' || rt === 'supplier';
}
