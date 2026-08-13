/** Shared with Contact Directory, New Agreement wizard, and Asset Register */

export const CONTACT_CATEGORIES = ['Resource', 'Client', 'Vendor', 'Healthcare Worker'];

export const RESOURCE_TYPES = [
  'Full-Time',
  'Contractual',
  'Freelancer',
  'Consultant',
  'Other',
];

/** Engagement type when Contact Category is Healthcare Worker */
export const HCW_RESOURCE_TYPES = ['Full-Time', 'Individual', 'Service Provider'];

export function resourceTypesForCategory(contactCategory) {
  if (contactCategory === 'Resource') return RESOURCE_TYPES;
  if (contactCategory === 'Healthcare Worker') return HCW_RESOURCE_TYPES;
  return [];
}

export function isHcwStaffResourceType(resourceType) {
  return resourceType === 'Full-Time' || resourceType === 'Individual';
}

export function isServiceProviderContact(contact) {
  if (!contact) return false;
  return (
    contact.contactCategory === 'Healthcare Worker' &&
    String(contact.resourceType || '').trim() === 'Service Provider'
  );
}

/** Default Profession / Role when Contact Category is Resource */
export const PROFESSIONS = [
  'Technician',
  'Phlebotomist',
  'Dietician',
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

/** Profession / Role when Contact Category is Healthcare Worker */
export const HEALTHCARE_WORKER_PROFESSIONS = [
  'Doctor',
  'Nurse',
  'Phlebotomist',
  'Technician',
  'Dietician',
  'Physio',
  'Biomedical Engineer',
  'Other',
];

export function professionsForCategory(contactCategory) {
  if (contactCategory === 'Client') return CLIENT_PROFESSIONS;
  if (contactCategory === 'Vendor') return VENDOR_PROFESSIONS;
  if (contactCategory === 'Healthcare Worker') return HEALTHCARE_WORKER_PROFESSIONS;
  return PROFESSIONS;
}

export function professionPicklistKey(contactCategory) {
  if (contactCategory === 'Client') return 'contact.profession.client';
  if (contactCategory === 'Vendor') return 'contact.profession.vendor';
  if (contactCategory === 'Healthcare Worker') return 'contact.profession.healthcareWorker';
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
