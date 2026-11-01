import { describe, expect, it } from 'vitest';
import { vendorPatchFromMaster } from './VendorMasterPicker.jsx';

describe('vendorPatchFromMaster', () => {
  it('maps Vendor Master onto PO vendor and bill fields', () => {
    const patch = vendorPatchFromMaster({
      _id: 'ven-1',
      contactId: 'c-9',
      code: 'VEN0001',
      name: 'Apex Diagnostics',
      contactName: 'Ravi Kumar',
      email: 'ravi@apex.test',
      phone: '9876543210',
      city: 'Pune',
      state: 'Maharashtra',
      gstin: '27AAAAA0000A1Z5',
      panCard: 'AAAAA0000A',
    });

    expect(patch.vendorMasterId).toBe('ven-1');
    expect(patch.contactId).toBe('c-9');
    expect(patch.vendorName).toBe('Apex Diagnostics');
    expect(patch.vendor).toMatchObject({
      name: 'Apex Diagnostics',
      code: 'VEN0001',
      address: 'Pune, Maharashtra',
      gstin: '27AAAAA0000A1Z5',
      pan: 'AAAAA0000A',
      stateName: 'Maharashtra',
      stateCode: '27',
      contactPerson: 'Ravi Kumar',
      mobile: '9876543210',
      email: 'ravi@apex.test',
    });
  });

  it('uses the stored GST state code when present', () => {
    const patch = vendorPatchFromMaster({
      _id: 'ven-4',
      name: 'Apex Diagnostics',
      state: 'Maharashtra',
      stateCode: '27',
      gstin: '',
    });
    expect(patch.vendor.stateCode).toBe('27');
  });

  it('prefers the stored Vendor Master address over city and state', () => {
    const patch = vendorPatchFromMaster({
      _id: 'ven-3',
      name: 'Apex Diagnostics',
      city: 'Pune',
      state: 'Maharashtra',
      address: '12 Koregaon Park, Pune 411001',
    });
    expect(patch.vendor.address).toBe('12 Koregaon Park, Pune 411001');
  });

  it('derives GST state code from GSTIN when state name is unknown', () => {
    const patch = vendorPatchFromMaster({
      _id: 'ven-2',
      name: 'South Labs',
      gstin: '33BBBBB1111B1Z2',
      state: '',
    });
    expect(patch.vendor.stateCode).toBe('33');
  });
});
