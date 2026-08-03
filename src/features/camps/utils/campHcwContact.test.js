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

  it('matches profession case-insensitively', () => {
    const cascade = buildHcwAssignCascade(contacts, {
      resourceType: 'Freelancer',
      profession: 'technician',
      state: 'Delhi',
    });

    expect(cascade.people.map((person) => person.name)).toEqual(['Ravi Kumar']);
  });

  it('lists directory professions and people for resource type when profession is empty', () => {
    const cascade = buildHcwAssignCascade(contacts, {
      resourceType: 'Freelancer',
      profession: '',
    });

    expect(cascade.professions).toEqual(['Technician']);
    expect(cascade.states).toEqual(['Delhi', 'Maharashtra']);
    expect(cascade.people.map((person) => person.name)).toEqual(['Asha Patel', 'Ravi Kumar']);
  });

  it('lists employees under service providers, not the agency itself', () => {
    const withProvider = [
      ...contacts,
      {
        _id: 'sp1',
        contactCategory: 'Healthcare Worker',
        resourceType: 'Service Provider',
        name: 'Acme Diagnostics',
        state: 'Delhi',
        city: 'New Delhi',
        contact: '9999999999',
        providerEmployees: [
          {
            id: 'e1',
            name: 'Karan Mehta',
            mobile: '9888777666',
            profession: 'Technician',
          },
        ],
      },
      {
        _id: '6',
        contactCategory: 'Healthcare Worker',
        resourceType: 'Full-Time',
        profession: 'Phlebotomist',
        state: 'Delhi',
        city: 'New Delhi',
        name: 'Linked Employee',
        contact: '9777666555',
        serviceProviderContactId: 'sp1',
      },
    ];

    const cascade = buildHcwAssignCascade(withProvider, {
      resourceType: 'Service Provider',
      professions: ['Technician', 'Phlebotomist'],
      state: 'Delhi',
    });

    expect(cascade.people.map((person) => person.name).sort()).toEqual([
      'Karan Mehta',
      'Linked Employee',
    ]);
    expect(cascade.people.some((person) => person.name === 'Acme Diagnostics')).toBe(false);
  });

  it('matches Dietician and Dietitian as the same profession', () => {
    const withDietitian = [
      ...contacts,
      {
        _id: '5',
        contactCategory: 'Healthcare Worker',
        resourceType: 'Full-Time',
        profession: 'Dietitian',
        state: 'Delhi',
        city: 'New Delhi',
        name: 'Priya Shah',
      },
    ];

    const cascade = buildHcwAssignCascade(withDietitian, {
      resourceType: 'Full-Time',
      profession: 'Dietician',
    });

    expect(cascade.people.map((person) => person.name)).toEqual(['Priya Shah']);
  });

  it('filters by any of multiple Client Master professions', () => {
    const cascade = buildHcwAssignCascade(contacts, {
      resourceType: '',
      professions: ['Technician', 'Phlebotomist'],
      state: 'Delhi',
    });

    expect(cascade.people.map((person) => person.name).sort()).toEqual(['Neha Singh', 'Ravi Kumar']);
  });
});
