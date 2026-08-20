import { describe, expect, it } from 'vitest';
import {
  applyAssetSnapshotToLineRows,
  applyAssetSnapshotToPlaceholders,
  placeholderAssetField,
} from './assetPlaceholderFields.js';
import { displayLineColumnLabel } from './serviceAgreementLineColumns.js';

describe('placeholderAssetField', () => {
  it('maps Asset Type / Product Type, Asset Name, Ownership Type, and Serial Number', () => {
    expect(placeholderAssetField({ key: 'Asset Type', label: 'Asset Type' })).toBe('productType');
    expect(placeholderAssetField({ key: 'Product Type', label: 'Product Type' })).toBe('productType');
    expect(placeholderAssetField({ key: 'Asset Name', label: 'Asset Name' })).toBe('assetName');
    expect(placeholderAssetField({ key: 'Ownership Type', label: 'Ownership Type' })).toBe('ownershipType');
    expect(placeholderAssetField({ key: 'Device Name', label: 'Device Name' })).toBe('assetName');
    expect(placeholderAssetField({ key: 'Serial No.', label: 'Serial No.' })).toBe('serialNumber');
    expect(placeholderAssetField({ key: 'Per Camp (INR)', label: 'Per Camp (INR)' })).toBeNull();
  });
});

describe('applyAssetSnapshotToPlaceholders', () => {
  it('fills those four fields from the linked asset snapshot', () => {
    const placeholders = [
      { key: 'asset_type' },
      { key: 'asset_name' },
      { key: 'ownership_type' },
      { key: 'serial_number' },
    ];
    const next = applyAssetSnapshotToPlaceholders(placeholders, {
      productType: 'Medical Device',
      assetName: 'BP Monitor',
      ownershipType: 'Tylo Owned',
      serialNumber: 'SN-9',
    });
    expect(next.asset_type).toBe('Medical Device');
    expect(next.asset_name).toBe('BP Monitor');
    expect(next.ownership_type).toBe('Tylo Owned');
    expect(next.serial_number).toBe('SN-9');
  });
});

describe('applyAssetSnapshotToLineRows', () => {
  it('fills Device Name and Serial Number on the first line-item row', () => {
    const tables = [
      {
        id: 'table_2',
        columns: [
          { key: 'device_name', label: 'Device Name' },
          { key: 'serial_number', label: 'Serial Number' },
          { key: 'per_camp_inr', label: 'Per Camp (INR)' },
        ],
      },
    ];
    const next = applyAssetSnapshotToLineRows(tables, {
      assetName: 'BP Monitor',
      serialNumber: 'SN-9',
    });
    expect(next.table_2[0].device_name).toBe('BP Monitor');
    expect(next.table_2[0].serial_number).toBe('SN-9');
    expect(next.table_2[0].per_camp_inr).toBe('');
  });
});

describe('displayLineColumnLabel', () => {
  it('maps legacy column headers to canonical labels', () => {
    expect(displayLineColumnLabel({ label: 'Display Name' })).toBe('Device Name');
    expect(displayLineColumnLabel({ label: 'Per Camp Amt' })).toBe('Per Camp (INR)');
    expect(displayLineColumnLabel({ label: 'Round Trip covered' })).toBe('Distance Covered (Km)');
    expect(displayLineColumnLabel({ label: 'Remarks' })).toBe('Additional Remarks');
  });
});
