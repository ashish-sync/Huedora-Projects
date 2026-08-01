import { describe, expect, it } from 'vitest';
import { buildHcwAssignCascade } from './campHcwContact.js';

const contacts = [
  {
    _id: '1',
    contactCategory: 'Healthcare Worker',
    resourceType: 'Freelancer',
    profession: 'Technician',
    state: 'Delhi',
    city: 'New Delhi',
    name: 'Ravi Kumar',
  },
  {
    _id: '2',
    contactCategory: 'Healthcare Worker',
    resourceType: 'Freelancer',
    profession: 'Technician',
    state: 'Maharashtra',
    city: 'Mumbai',
    name: 'Asha Patel',
  },
  {
    _id: '3',
    contactCategory: 'Healthcare Worker',
    resourceType: 'Employee',
    profession: 'Phlebotomist',
    state: 'Delhi',
    city: 'New Delhi',
    name: 'Neha Singh',
  },
];

describe('buildHcwAssignCascade', () => {
  it('filters by resource type, profession, state, and city', () => {
    const cascade = buildHcwAssignCascade(contacts, {
      resourceType: 'Freelancer',
      profession: 'Technician',
      state: 'Delhi',
      city: 'New Delhi',
    });

    expect(cascade.states).toEqual(['Delhi', 'Maharashtra']);
    expect(cascade.cities).toEqual(['New Delhi']);
    expect(cascade.people.map((person) => person.name)).toEqual(['Ravi Kumar']);
  });

  it('lists cities for the selected state only', () => {
    const cascade = buildHcwAssignCascade(contacts, {
      resourceType: 'Freelancer',
      profession: 'Technician',
      state: 'Maharashtra',
    });

    expect(cascade.cities).toEqual(['Mumbai']);
    expect(cascade.people.map((person) => person.name)).toEqual(['Asha Patel']);
  });

  it('lists service provider organisations when resource type is Service Provider', () => {
    const withProvider = [
      ...contacts,
      {
        _id: '4',
        contactCategory: 'Healthcare Worker',
        resourceType: 'Service Provider',
        name: 'Acme Diagnostics',
        state: 'Delhi',
        city: 'New Delhi',
        contact: '9999999999',
      },
    ];

    const cascade = buildHcwAssignCascade(withProvider, {
      resourceType: 'Service Provider',
      profession: 'Technician',
      state: 'Delhi',
    });

    expect(cascade.people.map((person) => person.name)).toEqual(['Acme Diagnostics']);
  });
});
