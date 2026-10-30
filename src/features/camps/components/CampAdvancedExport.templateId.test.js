import { describe, expect, it } from 'vitest';
import { exportTemplateId } from './CampAdvancedExport.jsx';

describe('exportTemplateId', () => {
  it('prefers Mongo _id so saved templates can be selected and deleted', () => {
    expect(exportTemplateId({ _id: 'abc123', name: 'Ops' })).toBe('abc123');
    expect(exportTemplateId({ id: 'legacy', name: 'Ops' })).toBe('legacy');
    expect(exportTemplateId({ _id: 'abc123', id: 'legacy' })).toBe('abc123');
    expect(exportTemplateId({})).toBe('');
  });
});
