import { describe, expect, it } from 'vitest';
import {
  applyContactSnapshotToPlaceholders,
  placeholderContactField,
} from './contactPlaceholderFields.js';

describe('placeholderContactField', () => {
  it('maps Name, Address, City, State, and related directory fields', () => {
    expect(placeholderContactField({ key: 'Name', label: 'Name' })).toBe('name');
    expect(placeholderContactField({ key: 'Recipient Name', label: 'Recipient Name' })).toBe('name');
    expect(placeholderContactField({ key: 'Address', label: 'Address' })).toBe('address');
    expect(placeholderContactField({ key: 'City', label: 'City' })).toBe('city');
    expect(placeholderContactField({ key: 'State', label: 'State' })).toBe('state');
    expect(placeholderContactField({ key: 'District', label: 'District' })).toBe('district');
    expect(placeholderContactField({ key: 'Pin Code', label: 'Pin Code' })).toBe('pinCode');
    expect(placeholderContactField({ key: 'Email', label: 'Email' })).toBe('email');
    expect(placeholderContactField({ key: 'Mobile', label: 'Mobile' })).toBe('phone');
    expect(placeholderContactField({ key: 'Organization', label: 'Organization' })).toBe(
      'organization'
    );
  });

  it('does not steal Asset Name / Serial Number placeholders', () => {
    expect(placeholderContactField({ key: 'Asset Name', label: 'Asset Name' })).toBeNull();
    expect(placeholderContactField({ key: 'Serial Number', label: 'Serial Number' })).toBeNull();
  });
});

describe('applyContactSnapshotToPlaceholders', () => {
  it('prefills directory fields from the linked contact', () => {
    const placeholders = [
      { key: 'Name', label: 'Name' },
      { key: 'Address', label: 'Address' },
      { key: 'City', label: 'City' },
      { key: 'State', label: 'State' },
      { key: 'Asset Name', label: 'Asset Name' },
    ];
    const next = applyContactSnapshotToPlaceholders(placeholders, {
      name: 'Dr Anita Desai',
      address: '12 MG Road',
      city: 'Pune',
      state: 'Maharashtra',
    });
    expect(next.Name).toBe('Dr Anita Desai');
    expect(next.Address).toBe('12 MG Road');
    expect(next.City).toBe('Pune');
    expect(next.State).toBe('Maharashtra');
    expect(next['Asset Name']).toBeUndefined();
  });
});
