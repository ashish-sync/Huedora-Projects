export const DEFAULT_DOCTOR_SPECIALTY = 'General Practitioner';

export const DOCTOR_SPECIALTY_OPTIONS = [
  'General Practitioner',
  'Pediatrician',
  'Gynecologist',
  'Cardiologist',
  'Orthopedist',
  'Dermatologist',
  'Neurologist',
  'Urologist',
  'Other (Specify Others)',
];

export {
  daysFromToday,
  isRequestDateFarFromToday,
  isHistoricalCampDate,
} from '../utils/campDatePolicy.js';
