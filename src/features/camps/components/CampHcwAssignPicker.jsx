import { useEffect, useMemo, useState } from 'react';
import {
  HCW_RESOURCE_TYPES,
  HEALTHCARE_WORKER_PROFESSIONS,
} from '../../agreements/contactPicklists.js';
import { usePicklistOptions } from '../../../shared/usePicklistOptions.js';
import {
  HCW_CONTACT_CATEGORY,
  buildHcwAssignCascade,
  contactToHcwFields,
  findAssignableHealthcareWorker,
} from '../utils/campHcwContact';

function ReadOnlyField({ label, value }) {
  return (
    <label>
      {label}
      <input value={value ?? ''} readOnly className="input-readonly" />
    </label>
  );
}

function intersectWithMaster(availableValues, masterOptions) {
  const available = new Set(availableValues);
  return masterOptions.filter((option) => available.has(option));
}

export function CampHcwAssignPicker({
  hcwContacts = [],
  contactsLoading = false,
  disabled = false,
  selectedContactId = '',
  onSelect,
}) {
  const selectedContact = useMemo(
    () => findAssignableHealthcareWorker(hcwContacts, selectedContactId),
    [hcwContacts, selectedContactId],
  );

  const [resourceType, setResourceType] = useState(() => selectedContact?.resourceType || '');
  const [profession, setProfession] = useState(() => selectedContact?.profession || '');
  const [city, setCity] = useState(() => selectedContact?.city || '');

  const { options: masterResourceTypes } = usePicklistOptions(
    'contact.hcwResourceType',
    HCW_RESOURCE_TYPES,
  );
  const { options: masterProfessions } = usePicklistOptions(
    'contact.profession.healthcareWorker',
    HEALTHCARE_WORKER_PROFESSIONS,
  );

  const cascade = useMemo(
    () => buildHcwAssignCascade(hcwContacts, { resourceType, profession, city }),
    [hcwContacts, resourceType, profession, city],
  );

  const resourceTypeOptions = useMemo(
    () => intersectWithMaster(cascade.resourceTypes, masterResourceTypes)
      .filter((option) => option !== 'Service Provider'),
    [cascade.resourceTypes, masterResourceTypes],
  );

  const professionOptions = useMemo(
    () => intersectWithMaster(cascade.professions, masterProfessions),
    [cascade.professions, masterProfessions],
  );

  const fields = contactToHcwFields(selectedContact);
  const fieldsDisabled = disabled || contactsLoading;
  const canPickProfession = Boolean(resourceType);
  const canPickCity = Boolean(resourceType && profession);
  const canPickPerson = Boolean(resourceType && profession);

  useEffect(() => {
    if (!selectedContact) return;
    setResourceType(selectedContact.resourceType || '');
    setProfession(selectedContact.profession || '');
    setCity(selectedContact.city || '');
  }, [selectedContact?._id]);

  function handleResourceTypeChange(nextResourceType) {
    setResourceType(nextResourceType);
    setProfession('');
    setCity('');
    onSelect?.(contactToHcwFields(null));
  }

  function handleProfessionChange(nextProfession) {
    setProfession(nextProfession);
    setCity('');
    onSelect?.(contactToHcwFields(null));
  }

  function handleCityChange(nextCity) {
    setCity(nextCity);
    onSelect?.(contactToHcwFields(null));
  }

  function handlePersonChange(contactId) {
    const contact = cascade.people.find((item) => String(item._id) === String(contactId));
    onSelect?.(contactToHcwFields(contact));
  }

  return (
    <div className="form-grid camp-hcw-assign-picker">
      <ReadOnlyField label="Contact Category" value={HCW_CONTACT_CATEGORY} />

      <label>
        Resource Type
        <select
          value={resourceType}
          onChange={(event) => handleResourceTypeChange(event.target.value)}
          disabled={fieldsDisabled}
          required
        >
          <option value="">
            {contactsLoading ? 'Loading…' : 'Select resource type'}
          </option>
          {resourceTypeOptions.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </label>

      <label>
        Profession / Role
        <select
          value={profession}
          onChange={(event) => handleProfessionChange(event.target.value)}
          disabled={fieldsDisabled || !canPickProfession}
          required
        >
          <option value="">
            {canPickProfession ? 'Select profession' : 'Select resource type first'}
          </option>
          {professionOptions.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </label>

      <label>
        City
        <select
          value={city}
          onChange={(event) => handleCityChange(event.target.value)}
          disabled={fieldsDisabled || !canPickCity}
        >
          <option value="">
            {canPickCity ? 'All cities' : 'Select profession first'}
          </option>
          {cascade.cities.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </label>

      <label className="full">
        Healthcare Worker
        <select
          value={selectedContactId || ''}
          onChange={(event) => handlePersonChange(event.target.value)}
          disabled={fieldsDisabled || !canPickPerson}
          required
        >
          <option value="">
            {canPickPerson ? 'Select healthcare worker' : 'Select profession first'}
          </option>
          {cascade.people.map((contact) => (
            <option key={contact._id} value={contact._id}>
              {contact.name}
              {contact.contact ? ` · ${contact.contact}` : ''}
              {!city && contact.city ? ` · ${contact.city}` : ''}
            </option>
          ))}
        </select>
      </label>

      {selectedContactId ? (
        <>
          <ReadOnlyField label="HCW Category" value={fields.hcwCategory || '—'} />
          <ReadOnlyField label="HCW Name" value={fields.hcwName || '—'} />
          <ReadOnlyField label="HCW Contact" value={fields.hcwContact || '—'} />
        </>
      ) : null}

      {!cascade.assignable.length && !contactsLoading ? (
        <p className="meta-text full">
          No Healthcare Worker contacts found in Contact Directory. Add contacts under Contact Category
          {' '}
          <strong>Healthcare Worker</strong>
          {' '}
          first.
        </p>
      ) : null}
    </div>
  );
}
