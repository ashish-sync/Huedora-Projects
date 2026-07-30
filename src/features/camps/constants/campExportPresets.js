export const EXPORT_PRESET_TEMPLATES = [
  {
    id: 'operations',
    label: 'Operations',
    hint: 'Request → execution',
    sectionIds: ['overview', 'request', 'review_closure', 'assignment', 'execution'],
  },
  {
    id: 'finance',
    label: 'Finance',
    hint: 'Revenue & settlement',
    sectionIds: ['overview', 'request', 'finance'],
  },
  {
    id: 'management',
    label: 'Management',
    hint: 'Review & oversight',
    sectionIds: ['overview', 'request', 'review_closure', 'assignment', 'finance'],
  },
  {
    id: 'full',
    label: 'All fields',
    hint: 'Complete export',
    sectionIds: null,
  },
];

export function columnKeysForSections(sections = [], sectionIds = null) {
  const allowed = sectionIds ? new Set(sectionIds) : null;
  const keys = [];
  const used = new Set();
  for (const section of sections) {
    if (allowed && !allowed.has(section.id)) continue;
    for (const column of section.columns || []) {
      if (used.has(column.key)) continue;
      used.add(column.key);
      keys.push(column.key);
    }
  }
  return keys;
}

export function columnKeysForPreset(sections = [], presetId) {
  const preset = EXPORT_PRESET_TEMPLATES.find((item) => item.id === presetId);
  if (!preset) return [];
  return columnKeysForSections(sections, preset.sectionIds);
}
