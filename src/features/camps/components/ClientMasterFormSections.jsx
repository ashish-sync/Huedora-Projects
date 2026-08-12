import FieldError from '../../../components/ui/FieldError.jsx';
import { PhoneField } from '../../../components/ui/PhoneField.jsx';
import { CampNameSelect } from './CampNameSelect';
import { ClientNameSearchInput } from './ClientNameSearchInput';
import { AssignedSystemUserPicker } from './AssignedSystemUserPicker.jsx';
import { SearchableOptionsInput } from './SearchableOptionsInput';
import { ClientMasterConsumablesField } from './ClientMasterConsumablesField.jsx';
import { ClientMasterStateSelect } from './ClientMasterStateSelect.jsx';
import { normalizeHealthcareWorkers } from '../utils/healthcareWorkers.js';

const SERVICE_MODEL_OPTIONS = [
  'HCW Only',
  'Rented',
  'HCW + Device (Light Device)',
  'HCW + Device (Heavy Device)',
];
const HEALTHCARE_WORKER_OPTIONS = ['Technician', 'Phlebotomist', 'Dietician'];

function healthcareRoleSelected(selected, role) {
  const want = String(role || '').trim().toLowerCase();
  return normalizeHealthcareWorkers(selected).some((item) => {
    const have = String(item || '').trim().toLowerCase();
    if (have === want) return true;
    return (
      (want === 'dietician' || want === 'dietitian') &&
      (have === 'dietician' || have === 'dietitian')
    );
  });
}

function toggleHealthcareRole(selected, role) {
  const current = normalizeHealthcareWorkers(selected);
  if (healthcareRoleSelected(current, role)) {
    return current.filter((item) => !healthcareRoleSelected([item], role));
  }
  return [...current, role];
}

function numberInputProps(field, form, updateField, fieldErrors) {
  return {
    type: 'text',
    inputMode: 'numeric',
    value: form[field],
    onChange: (e) => updateField(field, e.target.value.replace(/[^\d]/g, '')),
    className: fieldErrors[field] ? 'input-invalid' : '',
  };
}

export function ClientMasterFormSectionFields({
  sectionId,
  form,
  fieldErrors = {},
  loading = false,
  canCreateCompany = false,
  onFieldChange,
  onClientNameChange,
  onSelectRecord,
  onAssignedUsersChange,
  programScopeLabel = '',
}) {
  const updateField = onFieldChange;

  switch (sectionId) {
    case 'clientInfo':
      return (
        <div className="form-grid client-master-section-grid">
          <label>
            Client Name
            <ClientNameSearchInput
              value={form.clientName}
              error={fieldErrors.clientName}
              onChange={onClientNameChange}
              onSelectRecord={onSelectRecord}
              requireExistingClient={!canCreateCompany}
            />
            {!canCreateCompany ? (
              <small className="meta-text">Select an existing company. You cannot create new companies.</small>
            ) : null}
          </label>
          <label>
            Client Code
            <input
              value={form.clientCode}
              onChange={(e) => updateField('clientCode', e.target.value.toUpperCase())}
              placeholder={canCreateCompany ? 'Optional — auto-generated if new Client' : 'Filled when you select a company'}
              readOnly={!canCreateCompany}
              className={fieldErrors.clientCode ? 'input-invalid' : ''}
            />
            <FieldError message={fieldErrors.clientCode} />
          </label>
          <label>
            Display Name
            <input
              value={form.displayName}
              onChange={(e) => updateField('displayName', e.target.value)}
              placeholder="Program label shown in camp flows (optional)"
              className={fieldErrors.displayName ? 'input-invalid' : ''}
            />
            <FieldError message={fieldErrors.displayName} />
          </label>
          <label>
            Status
            <select
              value={form.isActive ? 'active' : 'inactive'}
              onChange={(e) => updateField('isActive', e.target.value === 'active')}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
        </div>
      );

    case 'billing':
      return (
        <div className="form-grid client-master-section-grid">
          <label className="client-master-section-span-2">
            Billing Address
            <textarea
              rows={2}
              value={form.billingAddress}
              onChange={(e) => updateField('billingAddress', e.target.value)}
              placeholder="Registered / billing address for GST invoices"
            />
          </label>
          <label>
            State
            <ClientMasterStateSelect
              stateName={form.billingStateName}
              stateCode={form.billingStateCode}
              onChange={({ stateName, stateCode }) => {
                updateField('billingStateName', stateName);
                updateField('billingStateCode', stateCode);
              }}
            />
          </label>
          <label>
            State Code
            <input
              value={form.billingStateCode}
              onChange={(e) => updateField('billingStateCode', e.target.value)}
              placeholder="27"
              maxLength={2}
            />
          </label>
          <label>
            GSTIN
            <input
              value={form.billingGstin}
              onChange={(e) => updateField('billingGstin', e.target.value.toUpperCase())}
              placeholder="15-character GSTIN"
              maxLength={15}
            />
          </label>
          <label>
            PAN
            <input
              value={form.billingPan}
              onChange={(e) => updateField('billingPan', e.target.value.toUpperCase())}
              placeholder="AAAAA0000A"
              maxLength={10}
            />
          </label>
        </div>
      );

    case 'program':
      return (
        <div className="form-grid client-master-section-grid">
          <label>
            Division / Therapy
            <input
              value={form.programName}
              onChange={(e) => updateField('programName', e.target.value)}
              placeholder="e.g. Viva BMD Camps, Ortreso"
              className={fieldErrors.programName ? 'input-invalid' : ''}
            />
            <FieldError message={fieldErrors.programName} />
          </label>
          <label>
            Method
            <CampNameSelect
              value={form.campName}
              onChange={(value) => updateField('campName', value)}
              error={fieldErrors.campName}
            />
          </label>
          <label>
            Service Model
            <SearchableOptionsInput
              value={form.campType}
              onChange={(value) => updateField('campType', value)}
              options={SERVICE_MODEL_OPTIONS}
              placeholder="e.g. HCW + Device (Light Device)"
              groupLabel="Service models"
              error={fieldErrors.campType}
            />
          </label>
          <div className={`client-master-hcw-field${fieldErrors.healthcareWorker ? ' is-invalid' : ''}`}>
            <span className="client-master-field-label" id="client-master-hcw-label">
              Healthcare Worker
            </span>
            <div className="client-master-hcw-roles" role="group" aria-labelledby="client-master-hcw-label">
              {HEALTHCARE_WORKER_OPTIONS.map((option) => {
                const checked = healthcareRoleSelected(form.healthcareWorker, option);
                return (
                  <label key={option} className={`client-master-hcw-role${checked ? ' is-selected' : ''}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={loading}
                      onChange={() =>
                        updateField('healthcareWorker', toggleHealthcareRole(form.healthcareWorker, option))
                      }
                    />
                    <span>{option}</span>
                  </label>
                );
              })}
            </div>
            <FieldError message={fieldErrors.healthcareWorker} />
          </div>
          <label>
            Camp Duration
            <input
              value={form.campDuration}
              onChange={(e) => updateField('campDuration', e.target.value)}
              placeholder="4:00"
              className={fieldErrors.campDuration ? 'input-invalid' : ''}
            />
            <FieldError message={fieldErrors.campDuration} />
          </label>
        </div>
      );

    case 'spoc':
      return (
        <div className="form-grid client-master-section-grid">
          <label>
            SPOC Name
            <input
              value={form.spocName}
              onChange={(e) => updateField('spocName', e.target.value)}
              className={fieldErrors.spocName ? 'input-invalid' : ''}
            />
            <FieldError message={fieldErrors.spocName} />
          </label>
          <PhoneField
            label="SPOC Number"
            value={form.spocNumber}
            onChange={(value) => updateField('spocNumber', value)}
            error={fieldErrors.spocNumber}
          />
          <label>
            SPOC Email Address
            <input
              value={form.spocEmail}
              onChange={(e) => updateField('spocEmail', e.target.value)}
              placeholder="spoc@client.com, ops@client.com"
              title="Comma-separated SPOC email addresses"
              className={fieldErrors.spocEmail ? 'input-invalid' : ''}
            />
            <FieldError message={fieldErrors.spocEmail} />
          </label>
          <label>
            Request Timeline
            <input
              value={form.requestTimeline}
              onChange={(e) => updateField('requestTimeline', e.target.value)}
              placeholder="5 Days Before"
              className={fieldErrors.requestTimeline ? 'input-invalid' : ''}
            />
            <FieldError message={fieldErrors.requestTimeline} />
          </label>
          <label className="client-master-section-span-2">
            Assigned User Login Emails
            <AssignedSystemUserPicker
              value={form.assignedUserEmails}
              onChange={onAssignedUsersChange || ((next) => onFieldChange('assignedUserEmails', next))}
              error={fieldErrors.assignedUserEmails}
            />
            {programScopeLabel ? (
              <small className="meta-text">
                Mapped to {programScopeLabel}. Users only see camps for this client, division, and method.
              </small>
            ) : (
              <small className="meta-text">
                Set Client Name, Division / Therapy, and Method first to map assigned users.
              </small>
            )}
            <FieldError message={fieldErrors.assignedUserEmails} />
          </label>
        </div>
      );

    case 'commercial':
      return (
        <div className="form-grid client-master-section-grid">
          <label>
            Executed Camp Unit
            <input {...numberInputProps('executedCampUnit', form, updateField, fieldErrors)} />
            <FieldError message={fieldErrors.executedCampUnit} />
          </label>
          <label>
            Cancelled Camp Unit
            <input {...numberInputProps('cancelledCampUnit', form, updateField, fieldErrors)} />
            <FieldError message={fieldErrors.cancelledCampUnit} />
          </label>
          <label>
            OT Unit
            <input {...numberInputProps('otUnit', form, updateField, fieldErrors)} />
            <FieldError message={fieldErrors.otUnit} />
          </label>
          <label>
            Minimum Patient Covered
            <input {...numberInputProps('minimumPatientCovered', form, updateField, fieldErrors)} />
            <FieldError message={fieldErrors.minimumPatientCovered} />
          </label>
          <label>
            Minimum Kms Covered
            <input {...numberInputProps('minimumKmsCovered', form, updateField, fieldErrors)} />
            <FieldError message={fieldErrors.minimumKmsCovered} />
          </label>
          <label>
            Ext. Patient Unit
            <input {...numberInputProps('extPatientUnit', form, updateField, fieldErrors)} />
            <FieldError message={fieldErrors.extPatientUnit} />
          </label>
          <label>
            Kms Unit
            <input {...numberInputProps('kmsUnit', form, updateField, fieldErrors)} />
            <FieldError message={fieldErrors.kmsUnit} />
          </label>
          <div className="client-master-section-span-full">
            <ClientMasterConsumablesField
              value={form.mappedConsumables}
              onChange={(value) => updateField('mappedConsumables', value)}
            />
          </div>
        </div>
      );

    default:
      return null;
  }
}
