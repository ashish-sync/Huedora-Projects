import {
  applyAssetSnapshotToLineRows,
  applyAssetSnapshotToPlaceholders,
  isDisplayNamePlaceholder,
  placeholderAssetField,
} from './assetPlaceholderFields.js';
import {
  collectLineSerialValues,
  collectUsedLineSerials,
  displayLineColumnLabel,
  findDuplicateLineSerial,
  isHiddenLineValuePlaceholder,
  mergeLineValuesIntoPlaceholders,
} from './serviceAgreementLineColumns.js';
import { describe, expect, it } from 'vitest';

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

describe('isDisplayNamePlaceholder', () => {
  it('detects Display Name merge fields', () => {
    expect(isDisplayNamePlaceholder({ label: 'Display Name' })).toBe(true);
    expect(isDisplayNamePlaceholder({ key: 'display_name' })).toBe(true);
    expect(isDisplayNamePlaceholder({ label: 'Asset Name' })).toBe(false);
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

describe('isHiddenLineValuePlaceholder', () => {
  it('hides Per Camp / Round Trip / Remarks merge fields from the form', () => {
    expect(isHiddenLineValuePlaceholder({ label: 'Per Camp Amt' })).toBe(true);
    expect(isHiddenLineValuePlaceholder({ label: 'Round Trip covered' })).toBe(true);
    expect(isHiddenLineValuePlaceholder({ label: 'Remarks' })).toBe(true);
    expect(isHiddenLineValuePlaceholder({ label: 'Name' })).toBe(false);
    expect(isHiddenLineValuePlaceholder({ label: 'Effective Date' })).toBe(false);
  });
});

describe('line serial uniqueness helpers', () => {
  const tables = [
    {
      id: 'table_2',
      columns: [
        { key: 'device_name', label: 'Device Name' },
        { key: 'serial_number', label: 'Serial Number' },
      ],
    },
  ];

  it('collectUsedLineSerials excludes the current row', () => {
    const rows = {
      table_2: [
        { device_name: 'A', serial_number: '123456' },
        { device_name: 'A', serial_number: '999' },
      ],
    };
    const used = collectUsedLineSerials(rows, tables, {
      excludeTableId: 'table_2',
      excludeRowIndex: 1,
    });
    expect([...used]).toEqual(['123456']);
  });

  it('findDuplicateLineSerial reports the second occurrence', () => {
    const rows = {
      table_2: [
        { device_name: 'A', serial_number: '123456' },
        { device_name: 'A', serial_number: '123456' },
      ],
    };
    expect(findDuplicateLineSerial(rows, tables)).toEqual({
      serial: '123456',
      rowIndex: 1,
      tableId: 'table_2',
    });
    expect(findDuplicateLineSerial({ table_2: [{ serial_number: '1' }] }, tables)).toBeNull();
  });

  it('collectLineSerialValues returns unique serials', () => {
    const rows = {
      table_2: [
        { serial_number: 'AAA' },
        { serial_number: 'aaa' },
        { serial_number: 'BBB' },
      ],
    };
    expect(collectLineSerialValues(rows, tables)).toEqual(['AAA', 'BBB']);
  });

  it('mergeLineValuesIntoPlaceholders fills hidden scalars from line cells', () => {
    const placeholders = [
      { key: 'display_name', label: 'Display Name' },
      { key: 'per_camp_amt', label: 'Per Camp Amt' },
      { key: 'round_trip', label: 'Round Trip covered' },
      { key: 'remarks', label: 'Remarks' },
      { key: 'name', label: 'Name' },
    ];
    const lineTables = [
      {
        id: 'table_2',
        columns: [
          { key: 'device_name', label: 'Device Name' },
          { key: 'per_camp', label: 'Per Camp (INR)' },
          { key: 'distance', label: 'Distance Covered (Km)' },
          { key: 'remarks', label: 'Additional Remarks' },
        ],
      },
    ];
    const lineRows = {
      table_2: [
        {
          device_name: 'Dr. Morepen — BP Monitor',
          per_camp: '400',
          distance: '50',
          remarks: '100 Rs on trip',
        },
      ],
    };
    const merged = mergeLineValuesIntoPlaceholders(
      { name: 'Ashish' },
      placeholders,
      lineTables,
      lineRows
    );
    expect(merged.display_name).toBe('Dr. Morepen — BP Monitor');
    expect(merged.per_camp_amt).toBe('400');
    expect(merged.round_trip).toBe('50');
    expect(merged.remarks).toBe('100 Rs on trip');
    expect(merged.name).toBe('Ashish');
  });
});
