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

export function daysFromToday(dateValue) {
  const raw = String(dateValue || '').slice(0, 10);
  if (!raw) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(target.getTime())) return 0;
  return Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

export function isRequestDateFarFromToday(dateValue) {
  return Math.abs(daysFromToday(dateValue)) > 2;
}
