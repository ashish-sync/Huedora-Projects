import { describe, expect, it } from 'vitest';
import {
  campAmountForAssignedHcw,
  resolveCampPayoutPayee,
} from './campPayoutPayee.js';

describe('resolveCampPayoutPayee', () => {
  it('uses the assigned HCW when no service provider is linked', () => {
    const hcw = {
      _id: 'hcw-1',
      name: 'Priya Sharma',
      resourceType: 'Full-Time',
    };
    const resolved = resolveCampPayoutPayee(hcw, [hcw]);
    expect(resolved.payeeIsServiceProvider).toBe(false);
    expect(resolved.payeeName).toBe('Priya Sharma');
    expect(resolved.payeeContactId).toBe('hcw-1');
  });

  it('pays the service provider when an employee is linked', () => {
    const provider = {
      _id: 'sp-1',
      name: 'Care Agency',
      contactCategory: 'Healthcare Worker',
      resourceType: 'Service Provider',
      bankName: 'HDFC Bank',
    };
    const employee = {
      _id: 'emp-1',
      name: 'Ravi Kumar',
      serviceProviderContactId: 'sp-1',
      serviceProviderName: 'Care Agency',
      resourceType: 'Full-Time',
    };
    const resolved = resolveCampPayoutPayee(employee, [provider, employee]);
    expect(resolved.payeeIsServiceProvider).toBe(true);
    expect(resolved.payeeName).toBe('Care Agency');
    expect(resolved.payeeContactId).toBe('sp-1');
    expect(resolved.payeeContact.bankName).toBe('HDFC Bank');
  });

  it('pays the service provider for embedded roster employees', () => {
    const provider = {
      _id: 'sp-9',
      name: 'Roster Agency',
      contactCategory: 'Healthcare Worker',
      resourceType: 'Service Provider',
    };
    const embedded = {
      _id: 'spe:sp-9:emp-a',
      name: 'Embedded Tech',
      serviceProviderContactId: 'sp-9',
      isProviderEmployee: true,
    };
    const resolved = resolveCampPayoutPayee(embedded, [provider]);
    expect(resolved.payeeIsServiceProvider).toBe(true);
    expect(resolved.payeeName).toBe('Roster Agency');
  });

  it('maps Camp Amount from the assigned Service Provider employee, not the agency', () => {
    const provider = {
      _id: 'sp-9',
      name: 'Roster Agency',
      contactCategory: 'Healthcare Worker',
      resourceType: 'Service Provider',
      campAmount: 9999,
      providerEmployees: [
        { id: 'emp-a', name: 'Embedded Tech', mobile: '9000000001', campAmount: 1800 },
        { id: 'emp-b', name: 'Other Tech', mobile: '9000000002', campAmount: 2400 },
      ],
    };
    const amount = campAmountForAssignedHcw({
      assignmentId: 'spe:sp-9:emp-b',
      assignedContact: null,
      payeeContact: provider,
    });
    expect(amount).toBe(2400);
  });

  it('uses the linked staff contact Camp Amount, not the agency', () => {
    const provider = {
      _id: 'sp-1',
      name: 'Care Agency',
      contactCategory: 'Healthcare Worker',
      resourceType: 'Service Provider',
      campAmount: 5000,
    };
    const employee = {
      _id: 'emp-1',
      name: 'Ravi Kumar',
      serviceProviderContactId: 'sp-1',
      campAmount: 1750,
    };
    expect(campAmountForAssignedHcw({
      assignmentId: 'emp-1',
      assignedContact: employee,
      payeeContact: provider,
    })).toBe(1750);
  });
});
