import { useEffect, useMemo, useRef, useState } from 'react';
import AdaptiveSelect from '../../../components/ui/AdaptiveSelect.jsx';
import { HCW_RESOURCE_TYPES, resourceTypesForCategory } from '../../agreements/contactPicklists.js';
import { usePicklistOptions } from '../../../shared/usePicklistOptions.js';
import {
  assignmentResourceTypeForContact,
  buildHcwAssignCascade,
  contactToHcwFields,
  findAssignableHealthcareWorker,
  isAssignableHealthcareWorkerOrg,
  isHealthcareWorkerCategory,
} from '../utils/campHcwContact';
import {
  formatHealthcareWorkers,
  normalizeHealthcareWorkers,
} from '../utils/healthcareWorkers.js';
import { fetchAssignContactFacets } from '../utils/fetchHcwContacts.js';

function AssignField({ label, hint, className = '', children }) {
  return (
    <label className={`camp-hcw-assign-field ${className}`.trim()}>
      <span className="camp-hcw-assign-field-title">{label}</span>
      {children}
      {hint ? <span className="camp-hcw-assign-hint">{hint}</span> : null}
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

function uniqueSorted(values = []) {
  return [...new Set(values.map((v) => String(v || '').trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
}

export function CampHcwAssignPicker({
  hcwContacts = [],
  contactsLoading = false,
  onPersonSearch = null,
  onFiltersChange = null,
  disabled = false,
  selectedContactId = '',
  clientMasterProfessions = [],
  clientMasterProfession = '',
  clientMasterLoading = false,
  clientMasterHcwGap = '',
  /** Prefill State from the camp request (helps SP employee load). */
  campState = '',
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
  // Service Provider: do NOT prefill camp state — agencies are often national /
  // other-state; auto state was wiping the Employee Name list.
  const [state, setState] = useState(() => {
    if (selectedContact?.state) return selectedContact.state;
    const initialRt = assignmentResourceTypeForContact(selectedContact);
    if (isServiceProviderResourceType(initialRt)) return '';
    return String(campState || '').trim() || '';
  });
  const [city, setCity] = useState(() => selectedContact?.city || '');
  const [providerId, setProviderId] = useState(() => (
    String(selectedContact?.serviceProviderContactId || '').trim()
  ));
  const [directoryStates, setDirectoryStates] = useState([]);
  const [directoryCities, setDirectoryCities] = useState([]);
  const [facetsLoading, setFacetsLoading] = useState(false);
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

  const serviceProviderOptions = useMemo(() => {
    if (!serviceProviderSelected) return [];
    const fromOrgs = hcwContacts.filter(isAssignableHealthcareWorkerOrg);
    const byId = new Map(fromOrgs.map((p) => [String(p._id), p]));
    for (const person of cascade.people) {
      const id = String(person.serviceProviderContactId || '').trim();
      if (!id || byId.has(id)) continue;
      byId.set(id, {
        _id: id,
        name: person.serviceProviderName || id,
        contactCategory: 'Healthcare Worker',
        resourceType: 'Service Provider',
      });
    }
    return [...byId.values()].sort((a, b) =>
      String(a.name || '').localeCompare(String(b.name || '')),
    );
  }, [serviceProviderSelected, hcwContacts, cascade.people]);

  const peopleOptions = useMemo(() => {
    if (!serviceProviderSelected || !providerId) return cascade.people;
    return cascade.people.filter(
      (person) => String(person.serviceProviderContactId || '') === String(providerId),
    );
  }, [cascade.people, serviceProviderSelected, providerId]);

  const resourceTypeOptions = useMemo(
    () => hcwResourceTypeChoices(masterResourceTypes, otherLabel),
    [masterResourceTypes, otherLabel],
  );

  const stateOptions = useMemo(
    () => uniqueSorted([...directoryStates, ...cascade.states]),
    [directoryStates, cascade.states],
  );

  const cityOptions = useMemo(
    () => uniqueSorted([...directoryCities, ...cascade.cities]),
    [directoryCities, cascade.cities],
  );

  const masterRoleMissing = !professions.length && !clientMasterLoading;
  const resourceTypeDisabled = disabled || masterRoleMissing;
  const canUseFilters = Boolean(resourceType) && professions.length > 0;
  const canPickState = canUseFilters && !facetsLoading;
  const canPickCity = Boolean(canUseFilters && state);
  const canPickPerson = canUseFilters;
  const rolesLabel = formatHealthcareWorkers(professions);

  useEffect(() => {
    if (!resourceType || !professions.length) {
      setDirectoryStates([]);
      setDirectoryCities([]);
      return undefined;
    }
    let cancelled = false;
    setFacetsLoading(true);
    fetchAssignContactFacets({
      resourceType,
      professions,
      useCache: true,
    })
      .then((facets) => {
        if (cancelled) return;
        const nextStates = Array.isArray(facets?.states) ? facets.states : [];
        setDirectoryStates(nextStates);
        setState((prev) => {
          const cur = String(prev || '').trim();
          if (!cur) {
            // Never auto-apply camp state for Service Provider — keep nationwide list.
            if (serviceProviderSelected) return prev;
            const camp = String(campState || '').trim();
            if (!camp) return prev;
            const campOk = nextStates.some(
              (name) => String(name).trim().toLowerCase() === camp.toLowerCase(),
            );
            return campOk ? camp : prev;
          }
          const stillValid = !nextStates.length || nextStates.some(
            (name) => String(name).trim().toLowerCase() === cur.toLowerCase(),
          );
          return stillValid ? prev : '';
        });
      })
      .catch(() => {
        if (!cancelled) setDirectoryStates([]);
      })
      .finally(() => {
        if (!cancelled) setFacetsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [resourceType, professionKey, campState, serviceProviderSelected]);

  useEffect(() => {
    const stateName = String(state || '').trim();
    if (!resourceType || !stateName || !professions.length) {
      setDirectoryCities([]);
      return undefined;
    }
    let cancelled = false;
    fetchAssignContactFacets({
      resourceType,
      professions,
      state: stateName,
      useCache: true,
    })
      .then((facets) => {
        if (cancelled) return;
        const nextCities = Array.isArray(facets?.cities) ? facets.cities : [];
        setDirectoryCities(nextCities);
        setCity((prev) => {
          const cur = String(prev || '').trim();
          if (!cur) return prev;
          const stillValid = nextCities.some(
            (name) => String(name).trim().toLowerCase() === cur.toLowerCase(),
          );
          return stillValid ? prev : '';
        });
      })
      .catch(() => {
        if (!cancelled) setDirectoryCities([]);
      });
    return () => {
      cancelled = true;
    };
  }, [resourceType, professionKey, state]);

  useEffect(() => {
    onFiltersChange?.({ resourceType, state, city, professions });
  }, [resourceType, state, city, professions, onFiltersChange]);

  // If Service Provider + a state filter yields zero employees but the nationwide
  // roster has people, drop the state filter (camp auto-prefill used to cause this).
  useEffect(() => {
    if (!serviceProviderSelected) return;
    const st = String(state || '').trim();
    if (!st || contactsLoading) return;
    if (!cascade.assignable.length) return;
    if (cascade.people.length > 0) return;
    if (cascade.filterGap !== 'state') return;
    setState('');
    setCity('');
    setProviderId('');
  }, [
    serviceProviderSelected,
    state,
    contactsLoading,
    cascade.assignable.length,
    cascade.people.length,
    cascade.filterGap,
  ]);

  useEffect(() => {
    if (!selectedContact) return;
    setResourceType(assignmentResourceTypeForContact(selectedContact));
    setState(selectedContact.state || '');
    setCity(selectedContact.city || '');
    setProviderId(String(selectedContact.serviceProviderContactId || '').trim());
  }, [selectedContact?._id]);

  useEffect(() => {
    if (prevProfessionKeyRef.current === professionKey) return;
    prevProfessionKeyRef.current = professionKey;
    // SP: keep state empty so agencies/employees load nationwide by default.
    setState(serviceProviderSelected ? '' : String(campState || '').trim());
    setCity('');
    setProviderId('');
    onSelect?.(contactToHcwFields(null));
  }, [professionKey, onSelect, campState, serviceProviderSelected]);

  function handleResourceTypeChange(nextResourceType) {
    setResourceType(nextResourceType);
    const nextIsSp = isServiceProviderResourceType(nextResourceType);
    setState(nextIsSp ? '' : String(campState || '').trim());
    setCity('');
    setProviderId('');
    onSelect?.(contactToHcwFields(null));
  }

  function handleStateChange(nextState) {
    setState(nextState);
    setCity('');
    setProviderId('');
    onSelect?.(contactToHcwFields(null));
  }

  function handleCityChange(nextCity) {
    setCity(nextCity);
    setProviderId('');
    onSelect?.(contactToHcwFields(null));
  }

  function handleProviderChange(nextProviderId) {
    setProviderId(nextProviderId);
    onSelect?.(contactToHcwFields(null));
  }

  function handlePersonChange(contactId) {
    const contact = peopleOptions.find((item) => String(item._id) === String(contactId))
      || cascade.people.find((item) => String(item._id) === String(contactId))
      || findAssignableHealthcareWorker(hcwContacts, contactId);
    onSelect?.(contactToHcwFields(contact, { fallbackProfessions: professions }));
  }

  const stateEmptyLabel = !resourceType
    ? 'Select resource type first'
    : masterRoleMissing
      ? 'Configure Healthcare Worker in Client Master'
      : facetsLoading
        ? 'Loading states…'
        : stateOptions.length
          ? 'Select state'
          : (serviceProviderSelected ? 'All states (optional)' : 'No states with matching contacts');

  const cityEmptyLabel = !canUseFilters
    ? 'Complete filters above first'
    : !state
      ? 'Select state first'
      : 'All cities';

  const personEmptyLabel = contactsLoading
    ? 'Loading contacts…'
    : !canPickPerson
      ? (masterRoleMissing
        ? 'Configure Healthcare Worker in Client Master first'
        : 'Select resource type first')
      : peopleOptions.length
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
          disabled={resourceTypeDisabled}
          required
        >
          <option value="">
            {clientMasterLoading && !professions.length
              ? 'Loading Client Master…'
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
          disabled={disabled || !canPickState}
          required={!serviceProviderSelected}
        >
          <option value="">{stateEmptyLabel}</option>
          {stateOptions.map((option) => (
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
          disabled={disabled || !canPickCity}
        >
          <option value="">{cityEmptyLabel}</option>
          {cityOptions.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </AdaptiveSelect>
      </AssignField>

      {serviceProviderSelected ? (
        <AssignField label="Service Provider">
          <AdaptiveSelect
            className="tylo-select"
            threshold={6}
            value={providerId}
            onChange={(event) => handleProviderChange(event.target.value)}
            disabled={disabled || !canPickPerson || contactsLoading}
          >
            <option value="">
              {contactsLoading
                ? 'Loading service providers…'
                : serviceProviderOptions.length
                  ? 'All service providers'
                  : 'No service providers loaded'}
            </option>
            {serviceProviderOptions.map((provider) => (
              <option key={provider._id} value={provider._id}>
                {provider.name || provider._id}
                {provider.city ? ` · ${provider.city}` : ''}
              </option>
            ))}
          </AdaptiveSelect>
        </AssignField>
      ) : null}

      <AssignField
        label={serviceProviderSelected ? 'Employee Name' : 'Healthcare Worker Name'}
        className="full"
      >
        <AdaptiveSelect
          className="tylo-select"
          threshold={6}
          value={selectedContactId || ''}
          onChange={(event) => handlePersonChange(event.target.value)}
          onInputChange={(inputValue, meta) => {
            if (meta?.action === 'input-change') {
              onPersonSearch?.(inputValue, { resourceType, state, city, professions });
            }
            return inputValue;
          }}
          disabled={disabled || !canPickPerson}
          required
          placeholder={personEmptyLabel}
        >
          <option value="">{personEmptyLabel}</option>
          {peopleOptions.map((contact) => (
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

      {serviceProviderSelected
        && canUseFilters
        && !contactsLoading
        && !cascade.assignable.length ? (
        <p className="meta-text camp-hcw-assign-note full">
          No employees under Service Providers match Client Master role(s) “{rolesLabel}”.
          Add Employees on the Service Provider in Contact Directory, or link Full-Time / Individual
          workers to a provider.
        </p>
      ) : null}

      {!serviceProviderSelected
        && !cascade.assignable.length
        && canUseFilters
        && !contactsLoading
        && state ? (
        <p className="meta-text camp-hcw-assign-note full">
          {`No Healthcare Worker contacts match resource type “${resourceType}”${rolesLabel ? ` and Client Master role(s) “${rolesLabel}”` : ''}. Add matching contacts in Contact Directory first.`}
        </p>
      ) : null}

      {cascade.assignable.length > 0
        && canPickPerson
        && !peopleOptions.length
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
        && !peopleOptions.length
        && !contactsLoading
        && cascade.filterGap === 'state' ? (
        <p className="meta-text camp-hcw-assign-note full">
          Matching contacts exist, but none are in state “{state}”. Clear or change State.
        </p>
      ) : null}

      {cascade.assignable.length > 0
        && canPickPerson
        && !peopleOptions.length
        && !contactsLoading
        && cascade.filterGap === 'city' ? (
        <p className="meta-text camp-hcw-assign-note full">
          Matching contacts exist, but none are in city “{city}”. Clear or change City.
        </p>
      ) : null}

      {serviceProviderSelected
        && providerId
        && cascade.assignable.length > 0
        && !peopleOptions.length
        && !contactsLoading ? (
        <p className="meta-text camp-hcw-assign-note full">
          This Service Provider has no employees matching the current filters. Clear State/City
          or choose “All service providers”.
        </p>
      ) : null}

      {!hcwContacts.some(isHealthcareWorkerCategory) && !contactsLoading && canUseFilters ? (
        <p className="meta-text camp-hcw-assign-note full">
          No Healthcare Worker contacts found in Contact Directory. Add Healthcare Worker contacts there first.
        </p>
      ) : null}
    </div>
  );
}
