import { describe, expect, it } from 'vitest';
import {
  CONTACT_CATEGORIES,
  DIRECTORY_CREATE_CATEGORIES,
  directoryCategoryChoices,
} from './contactPicklists.js';

describe('directoryCategoryChoices', () => {
  it('hides Vendor from new Contact Directory creates', () => {
    expect(DIRECTORY_CREATE_CATEGORIES).not.toContain('Vendor');
    expect(directoryCategoryChoices('')).toEqual(['Resource', 'Client', 'Healthcare Worker']);
    expect(directoryCategoryChoices('Client')).not.toContain('Vendor');
  });

  it('keeps Vendor available when editing an existing vendor contact', () => {
    expect(directoryCategoryChoices('Vendor')).toEqual(CONTACT_CATEGORIES);
  });
});
