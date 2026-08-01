import { useEffect, useMemo, useRef, useState } from 'react';
import { HCW_RESOURCE_TYPES, resourceTypesForCategory } from '../../agreements/contactPicklists.js';
import { usePicklistOptions } from '../../../shared/usePicklistOptions.js';
import {
  buildHcwAssignCascade,
  contactToHcwFields,
  findAssignableHealthcareWorker,
  isHealthcareWorkerCategory,
} from '../utils/campHcwContact';

function ReadOnlyField({ label, value, hint }) {
  return (
    <label>
      {label}
      {hint ? <span className="meta-text camp-hcw-assign-hint">{hint}</span> : null}
      <input value={value ?? ''} readOnly className="input-readonly" />
    </label>
  );
}

function hcwResourceTypeChoices(masterOptions, otherLabel = 'Other') {
  const canonical = new Set(resourceTypesForCategory('Healthcare Worker'));
  return masterOptions.filter(
    (option) => canonical.has(option) || option === otherLabel || option === 'Others',
  );
}

export function CampHcwAssignPicker({
  hcwContacts = [],
  contactsLoading = false,
  disabled = false,
  selectedContactId = '',
  clientMasterProfession = '',
  clientMasterLoading = false,
  onSelect,
}) {
  const selectedContact = useMemo(
    () => findAssignableHealthcareWorker(hcwContacts, selectedContactId),
    [hcwContacts, selectedContactId],
  );

  const profession = String(clientMasterProfession || '').trim();

  const [resourceType, setResourceType] = useState(() => selectedContact?.resourceType || '');
  const [state, setState] = useState(() => selectedContact?.state || '');
  const [city, setCity] = useState(() => selectedContact?.city || '');
  const prevProfessionRef = useRef(profession);

  const { options: masterResourceTypes, otherLabel } = usePicklistOptions(
    'contact.hcwResourceType',
    HCW_RESOURCE_TYPES,
  );

  const cascade = useMemo(
    () => buildHcwAssignCascade(hcwContacts, { resourceType, profession, state, city }),
    [hcwContacts, resourceType, profession, state, city],
  );

  const resourceTypeOptions = useMemo(
    () => hcwResourceTypeChoices(masterResourceTypes, otherLabel),
    [masterResourceTypes, otherLabel],
  );

  const fieldsDisabled = disabled || contactsLoading;
  const canPickState = Boolean(resourceType && profession);
  const canPickCity = Boolean(canPickState && state);
  const canPickPerson = Boolean(canPickState);

  useEffect(() => {
    if (!selectedContact) return;
    setResourceType(selectedContact.resourceType || '');
    setState(selectedContact.state || '');
    setCity(selectedContact.city || '');
  }, [selectedContact?._id]);

  useEffect(() => {
    if (prevProfessionRef.current === profession) return;
    prevProfessionRef.current = profession;
    setState('');
    setCity('');
    onSelect?.(contactToHcwFields(null));
  }, [profession, onSelect]);

  function handleResourceTypeChange(nextResourceType) {
    setResourceType(nextResourceType);
    setState('');
    setCity('');
    onSelect?.(contactToHcwFields(null));
  }

  function handleStateChange(nextState) {
    setState(nextState);
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
      <label>
        Resource Type
        <select
          className="tylo-select"
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

      <ReadOnlyField
        label="Profession / Role"
        hint="Based on Client Master"
        value={
          profession
            || (clientMasterLoading || contactsLoading
              ? 'Loading…'
              : 'Not configured in Client Master')
        }
      />

      <label>
        State
        <select
          className="tylo-select"
          value={state}
          onChange={(event) => handleStateChange(event.target.value)}
          disabled={fieldsDisabled || !canPickState}
          required
        >
          <option value="">
            {!profession
              ? 'Configure profession in Client Master'
              : canPickState
                ? 'Select state'
                : 'Select resource type first'}
          </option>
          {cascade.states.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </label>

      <label>
        City
        <select
          className="tylo-select"
          value={city}
          onChange={(event) => handleCityChange(event.target.value)}
          disabled={fieldsDisabled || !canPickCity}
        >
          <option value="">
            {canPickCity ? 'All cities' : 'Select state first'}
          </option>
          {cascade.cities.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </label>

      <label className="full">
        Healthcare Worker Name
        <select
          className="tylo-select"
          value={selectedContactId || ''}
          onChange={(event) => handlePersonChange(event.target.value)}
          disabled={fieldsDisabled || !canPickPerson}
          required
        >
          <option value="">
            {canPickPerson ? 'Select healthcare worker' : 'Complete filters above first'}
          </option>
          {cascade.people.map((contact) => (
            <option key={contact._id} value={contact._id}>
              {contact.name}
              {contact.contact ? ` · ${contact.contact}` : ''}
              {!city && contact.city ? ` · ${contact.city}` : ''}
              {!state && contact.state ? ` · ${contact.state}` : ''}
            </option>
          ))}
        </select>
      </label>

      {!profession && !clientMasterLoading && !contactsLoading ? (
        <p className="meta-text full">
          Set the Healthcare Worker role in Master One → Client Master for this client, division, and method.
        </p>
      ) : null}

      {!cascade.assignable.length && resourceType && !contactsLoading ? (
        <p className="meta-text full">
          No Healthcare Worker contacts match the selected resource type
          {profession ? ` and profession (${profession})` : ''}.
          Add matching contacts in Contact Directory first.
        </p>
      ) : null}

      {!hcwContacts.some(isHealthcareWorkerCategory) && !contactsLoading ? (
        <p className="meta-text full">
          No Healthcare Worker contacts found in Contact Directory. Add Healthcare Worker contacts there first.
        </p>
      ) : null}
    </div>
  );
}
