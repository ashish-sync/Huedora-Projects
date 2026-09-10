import { useEffect, useMemo, useRef, useState } from 'react';
import AdaptiveSelect from '../../../components/ui/AdaptiveSelect.jsx';
import { HCW_RESOURCE_TYPES, resourceTypesForCategory } from '../../agreements/contactPicklists.js';
import { usePicklistOptions } from '../../../shared/usePicklistOptions.js';
import {
  assignmentResourceTypeForContact,
  buildHcwAssignCascade,
  contactToHcwFields,
  findAssignableHealthcareWorker,
  isHealthcareWorkerCategory,
} from '../utils/campHcwContact';
import {
  formatHealthcareWorkers,
  normalizeHealthcareWorkers,
} from '../utils/healthcareWorkers.js';

function AssignField({ label, hint, className = '', children }) {
  return (
    <label className={`camp-hcw-assign-field ${className}`.trim()}>
      <span className="camp-hcw-assign-field-label">
        <span className="camp-hcw-assign-field-title">{label}</span>
        {hint ? <span className="camp-hcw-assign-hint">{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}

function hcwResourceTypeChoices(masterOptions, otherLabel = 'Other') {
  const canonical = new Set(resourceTypesForCategory('Healthcare Worker'));
  return masterOptions.filter(
    (option) => canonical.has(option) || option === otherLabel || option === 'Others',
  );
}

function isServiceProviderResourceType(value = '') {
  return String(value || '').trim() === 'Service Provider';
}

function personOptionLabel(contact, { city, state }) {
  const parts = [contact.name];
  if (contact.contact) parts.push(contact.contact);
  if (contact.profession) parts.push(contact.profession);
  if (contact.serviceProviderName) parts.push(contact.serviceProviderName);
  if (!city && contact.city) parts.push(contact.city);
  if (!state && contact.state) parts.push(contact.state);
  return parts.filter(Boolean).join(' · ');
}

export function CampHcwAssignPicker({
  hcwContacts = [],
  contactsLoading = false,
  disabled = false,
  selectedContactId = '',
  clientMasterProfessions = [],
  clientMasterProfession = '',
  clientMasterLoading = false,
  clientMasterHcwGap = '',
  onSelect,
}) {
  const selectedContact = useMemo(
    () => findAssignableHealthcareWorker(hcwContacts, selectedContactId),
    [hcwContacts, selectedContactId],
  );

  const professions = useMemo(
    () => normalizeHealthcareWorkers(
      clientMasterProfessions.length ? clientMasterProfessions : clientMasterProfession,
    ),
    [clientMasterProfessions, clientMasterProfession],
  );
  const professionKey = professions.join('|');

  const [resourceType, setResourceType] = useState(
    () => assignmentResourceTypeForContact(selectedContact),
  );
  const [state, setState] = useState(() => selectedContact?.state || '');
  const [city, setCity] = useState(() => selectedContact?.city || '');
  const prevProfessionKeyRef = useRef(professionKey);

  const { options: masterResourceTypes, otherLabel } = usePicklistOptions(
    'contact.hcwResourceType',
    HCW_RESOURCE_TYPES,
  );

  const serviceProviderSelected = isServiceProviderResourceType(resourceType);

  const cascade = useMemo(
    () => buildHcwAssignCascade(hcwContacts, {
      resourceType,
      professions,
      state,
      city,
    }),
    [hcwContacts, resourceType, professions, state, city],
  );

  const resourceTypeOptions = useMemo(
    () => hcwResourceTypeChoices(masterResourceTypes, otherLabel),
    [masterResourceTypes, otherLabel],
  );

  const fieldsDisabled = disabled || contactsLoading;
  const masterRoleMissing = !professions.length
    && !clientMasterLoading
    && !contactsLoading;
  const canUseFilters = Boolean(resourceType) && professions.length > 0;
  const canPickState = canUseFilters;
  const canPickCity = Boolean(canPickState && state);
  const canPickPerson = canUseFilters;
  const rolesLabel = formatHealthcareWorkers(professions);

  useEffect(() => {
    if (!selectedContact) return;
    setResourceType(assignmentResourceTypeForContact(selectedContact));
    setState(selectedContact.state || '');
    setCity(selectedContact.city || '');
  }, [selectedContact?._id]);

  useEffect(() => {
    if (prevProfessionKeyRef.current === professionKey) return;
    prevProfessionKeyRef.current = professionKey;
    setState('');
    setCity('');
    onSelect?.(contactToHcwFields(null));
  }, [professionKey, onSelect]);

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
    const contact = cascade.people.find((item) => String(item._id) === String(contactId))
      || findAssignableHealthcareWorker(hcwContacts, contactId);
    onSelect?.(contactToHcwFields(contact, { fallbackProfessions: professions }));
  }

  const stateEmptyLabel = !resourceType
    ? 'Select resource type first'
    : masterRoleMissing
      ? 'Configure Healthcare Worker in Client Master'
      : 'Select state';

  const cityEmptyLabel = !canPickState
    ? 'Complete filters above first'
    : !state
      ? 'Select state first'
      : 'All cities';

  const personEmptyLabel = !canPickPerson
    ? (masterRoleMissing
      ? 'Configure Healthcare Worker in Client Master first'
      : 'Select resource type first')
    : cascade.people.length
      ? (serviceProviderSelected ? 'Select employee' : 'Select healthcare worker')
      : (serviceProviderSelected
        ? 'No matching employees under service providers'
        : 'No matching contacts');

  return (
    <div className="form-grid camp-hcw-assign-picker">
      <AssignField label="Resource Type">
        <AdaptiveSelect
          className="tylo-select"
          threshold={8}
          value={resourceType}
          onChange={(event) => handleResourceTypeChange(event.target.value)}
          disabled={fieldsDisabled || masterRoleMissing}
          required
        >
          <option value="">
            {contactsLoading || clientMasterLoading
              ? 'Loading…'
              : masterRoleMissing
                ? 'Configure Client Master first'
                : 'Select resource type'}
          </option>
          {resourceTypeOptions.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </AdaptiveSelect>
      </AssignField>

      <AssignField label="State">
        <AdaptiveSelect
          className="tylo-select"
          threshold={8}
          value={state}
          onChange={(event) => handleStateChange(event.target.value)}
          disabled={fieldsDisabled || !canPickState}
          required
        >
          <option value="">{stateEmptyLabel}</option>
          {cascade.states.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </AdaptiveSelect>
      </AssignField>

      <AssignField label="City">
        <AdaptiveSelect
          className="tylo-select"
          threshold={8}
          value={city}
          onChange={(event) => handleCityChange(event.target.value)}
          disabled={fieldsDisabled || !canPickCity}
        >
          <option value="">{cityEmptyLabel}</option>
          {cascade.cities.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </AdaptiveSelect>
      </AssignField>

      <AssignField
        label={serviceProviderSelected ? 'Employee Name' : 'Healthcare Worker Name'}
        hint={serviceProviderSelected
          ? 'Employees under Service Providers in Contact Directory (not the agency itself).'
          : undefined}
      >
        <AdaptiveSelect
          className="tylo-select"
          threshold={6}
          value={selectedContactId || ''}
          onChange={(event) => handlePersonChange(event.target.value)}
          disabled={fieldsDisabled || !canPickPerson}
          required
          placeholder={personEmptyLabel}
        >
          <option value="">{personEmptyLabel}</option>
          {cascade.people.map((contact) => (
            <option key={contact._id} value={contact._id}>
              {personOptionLabel(contact, { city, state })}
            </option>
          ))}
        </AdaptiveSelect>
      </AssignField>

      {masterRoleMissing ? (
        <p className="meta-text camp-hcw-assign-note full">
          {clientMasterHcwGap === 'load_failed'
            ? 'Could not load Client Master for this camp. Refresh and try again.'
            : clientMasterHcwGap === 'missing_hcw_roles'
              ? 'Client Master exists for this client, but Healthcare Worker roles are not set. Open Master One → Client Master for this Client + Division + Method and select Technician / Phlebotomist / Dietician (Contact Directory alone is not enough).'
              : clientMasterHcwGap === 'division_method_mismatch'
                ? 'Client Master has Healthcare Worker roles, but none match this camp’s Division and Method. Align Client Master Division/Method with the camp, or set roles on the matching row.'
                : 'Set Healthcare Worker roles in Master One → Client Master for this Client, Division, and Method. Assignment then lists matching Contact Directory contacts.'}
        </p>
      ) : null}

      {!cascade.assignable.length && canUseFilters && !contactsLoading ? (
        <p className="meta-text camp-hcw-assign-note full">
          {serviceProviderSelected
            ? `No employees under Service Providers match Client Master role(s) “${rolesLabel}”. Link Full-Time / Individual workers to a provider, or add Employees on the Service Provider in Contact Directory.`
            : `No Healthcare Worker contacts match resource type “${resourceType}”${rolesLabel ? ` and Client Master role(s) “${rolesLabel}”` : ''}. Add matching contacts in Contact Directory first.`}
        </p>
      ) : null}

      {cascade.assignable.length > 0
        && canPickPerson
        && !cascade.people.length
        && !contactsLoading
        && cascade.filterGap === 'profession' ? (
        <p className="meta-text camp-hcw-assign-note full">
          Contacts exist for “{resourceType}”, but none have Profession / Role in
          “{rolesLabel}”. Set Profession on linked staff or Service Provider employees
          to match Client Master (blank is allowed and will use Client Master on select).
        </p>
      ) : null}

      {cascade.assignable.length > 0
        && canPickPerson
        && !cascade.people.length
        && !contactsLoading
        && cascade.filterGap === 'state' ? (
        <p className="meta-text camp-hcw-assign-note full">
          Matching contacts exist, but none are in state “{state}”. Clear or change State.
        </p>
      ) : null}

      {cascade.assignable.length > 0
        && canPickPerson
        && !cascade.people.length
        && !contactsLoading
        && cascade.filterGap === 'city' ? (
        <p className="meta-text camp-hcw-assign-note full">
          Matching contacts exist, but none are in city “{city}”. Clear or change City.
        </p>
      ) : null}

      {!hcwContacts.some(isHealthcareWorkerCategory) && !contactsLoading ? (
        <p className="meta-text camp-hcw-assign-note full">
          No Healthcare Worker contacts found in Contact Directory. Add Healthcare Worker contacts there first.
        </p>
      ) : null}
    </div>
  );
}
