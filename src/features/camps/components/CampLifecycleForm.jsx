import { useMemo, useState } from 'react';
import CampAddressField from './CampAddressField.jsx';
import CampLocationFields from './CampLocationFields.jsx';
import { CampNameSelect } from './CampNameSelect';
import { DateInput } from './DateInput';
import OtherAwareSelect from '../../../components/ui/OtherAwareSelect.jsx';
import { PhoneField } from '../../../components/ui/PhoneField.jsx';
import { usePicklistOptions } from '../../../shared/usePicklistOptions.js';
import { CampLifecycleStepper } from './CampLifecycleStepper';
import {
  CAMP_SOURCE_OPTIONS,
  CONTACT_PERSON_LEVEL_OPTIONS,
  CHARGEABLE_STATUSES,
  ATTIRE_CHECK_OPTIONS,
  computeLifecycleDerived,
  canEditLifecycleStage,
  canVisitLifecycleStage,
  hasReachedLifecycleStage,
  lifecycleStageIndex,
  normalizeLifecycleStage,
  isExecutionReadyForFinance,
  normalizeExecutionDocType,
  EXECUTION_STATUS,
  normalizeExecutionStatus,
  resolveEffectiveExecutionStatus,
  getExecutionConsumablesBlockers,
  computePunctualityLateness,
  formatLatenessHhMm,
  PAYMENT_SUBMIT_STATUSES,
  financePaymentStatusLabel,
  paymentSubmitStatusLabel,
} from '../constants/campLifecycle';
import { ACTION } from '../../../shared/labels.js';
import { validateRequestStageForm } from '../utils/validateRequestStage';
import { DOCTOR_SPECIALTY_OPTIONS, isRequestDateFarFromToday } from '../constants/doctorSpecialty';
import { computeDurationHours } from '../utils/campSchedule';
import { CampAssignmentStage } from './CampAssignmentStage';
import CampConsumablesUsed from './CampConsumablesUsed.jsx';
import { CampExecutionDocuments } from './CampExecutionDocuments.jsx';
import {
  DEFAULT_CONTACT_PERSON_LEVEL,
  emptyContactPerson,
  syncPrimaryContactFields,
} from '../utils/campContactPersons';

function ReadOnlyField({ label, value }) {
  return (
    <label>
      {label}
      <input value={value ?? ''} readOnly className="input-readonly" />
    </label>
  );
}

function PunctualityField({ value, campStartTime, inTime }) {
  const [open, setOpen] = useState(false);
  const lateMinutes = computePunctualityLateness(campStartTime, inTime);
  const showInfo = lateMinutes != null;
  const popoverText = lateMinutes <= 0
    ? 'On time (00:00)'
    : `Late by ${formatLatenessHhMm(lateMinutes)}`;

  return (
    <label className="camp-punctuality-field">
      <span className="camp-field-label-row">
        Punctuality
        {showInfo ? (
          <span className="camp-punctuality-info-wrap">
            <button
              type="button"
              className="camp-info-btn camp-punctuality-info-btn"
              aria-label="Show lateness in hours and minutes"
              aria-expanded={open}
              onClick={() => setOpen((current) => !current)}
            >
              i
            </button>
            {open ? (
              <span className="camp-info-popover camp-punctuality-popover" role="status">
                {popoverText}
              </span>
            ) : null}
          </span>
        ) : null}
      </span>
      <input value={value ?? ''} readOnly className="input-readonly" />
    </label>
  );
}

function ExecutionStatusField({
  effectiveStatus,
}) {
  return (
    <div className="camp-execution-status-field">
      <ReadOnlyField label="Execution Status" value={effectiveStatus} />
    </div>
  );
}

function SelectField({ label, value, onChange, options, disabled, required }) {
  return (
    <label>
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} required={required}>
        <option value="">Select…</option>
        {options.map((opt) => {
          const val = typeof opt === 'string' ? opt : opt.value;
          const text = typeof opt === 'string' ? opt : opt.label;
          return <option key={val} value={val}>{text}</option>;
        })}
      </select>
    </label>
  );
}

export function CampLifecycleForm({
  form,
  updateField,
  updateFields,
  activeStage,
  onStageChange,
  campStatus = 'pending_review',
  clients = [],
  divisionOptions = [],
  campNameOptions = [],
  programsLoading = false,
  stageReadOnly = {},
  campId = null,
  onUploadDocuments,
  uploadBusy = false,
  onDownloadFinanceExport,
  downloadFinanceBusy = false,
  assignedHcwContact = null,
  assignedHcwLoading = false,
  hcwFinanceBlockers = [],
  hcwContacts = [],
  contactsLoading = false,
  onValidationError,
  reachedLifecycleStage = 'request',
  mappedConsumables = [],
}) {
  const resolvedActiveStage = normalizeLifecycleStage(activeStage, 'request');
  const derived = useMemo(() => computeLifecycleDerived(form), [form]);
  const { options: specialtyOptions } = usePicklistOptions('camp.doctorSpecialty', DOCTOR_SPECIALTY_OPTIONS);
  const requestDateWarning = isRequestDateFarFromToday(form.requestDate);

  const stageDisabled = (stage) => stageReadOnly[stage] ?? false;

  function renderRequestStage() {
    const disabled = stageDisabled('request');
    const durationHours = form.startTime && form.endTime
      ? computeDurationHours(form.startTime, form.endTime)
      : form.durationHours;
    const durationLabel = durationHours ? `${durationHours} hr` : '';
    const contactPersons = Array.isArray(form.contactPersons) && form.contactPersons.length
      ? form.contactPersons
      : [emptyContactPerson(form.contactPersonLevel || DEFAULT_CONTACT_PERSON_LEVEL)];

    const updateContactPerson = (index, patch) => {
      const next = contactPersons.map((contact, i) => (
        i === index ? { ...contact, ...patch } : contact
      ));
      updateFields?.(syncPrimaryContactFields(next));
    };

    const addContactPerson = () => {
      updateFields?.(syncPrimaryContactFields([
        ...contactPersons,
        emptyContactPerson(DEFAULT_CONTACT_PERSON_LEVEL),
      ]));
    };

    const removeContactPerson = (index) => {
      const next = contactPersons.filter((_, i) => i !== index);
      updateFields?.(syncPrimaryContactFields(next.length ? next : [emptyContactPerson()]));
    };

    return (
      <div className="camp-request-form">
        <div className="form-grid camp-request-grid">
          <div className="camp-request-source-client-row full">
            <SelectField
              label="Source of Request"
              value={form.source}
              onChange={(v) => updateField('source', v)}
              options={CAMP_SOURCE_OPTIONS}
              disabled={disabled}
              required
            />
            <label>
              Client Name
              <select value={form.clientId} onChange={(e) => updateField('clientId', e.target.value)} disabled={disabled} required>
                <option value="">Select client</option>
                {clients.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </label>
          </div>
          <div className="camp-request-division-method-row full">
            <label>
              Division / Therapy
              <select
                value={form.campaignType}
                onChange={(e) => updateField('campaignType', e.target.value)}
                disabled={disabled || programsLoading || !form.clientId || !divisionOptions.length}
                required
              >
                <option value="">{programsLoading ? 'Loading…' : 'Select division / therapy'}</option>
                {divisionOptions.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </label>
            <label>
              Method
              <CampNameSelect
                value={form.campaignName}
                onChange={(v) => updateField('campaignName', v)}
                disabled={disabled || programsLoading || !form.clientId || !form.campaignType || !campNameOptions.length}
                required
                options={campNameOptions}
                emptyLabel={!form.clientId ? 'Select client first' : !form.campaignType ? 'Select division first' : 'Select method'}
              />
            </label>
          </div>
          <div className="camp-request-dates-row full">
            <label>
              Camp Date
              <DateInput hideLabel value={form.campDate} onChange={(v) => updateField('campDate', v)} disabled={disabled} required />
            </label>
            <label>
              Request Date
              <DateInput
                hideLabel
                value={form.requestDate}
                onChange={(v) => updateField('requestDate', v)}
                disabled={disabled}
              />
            </label>
          </div>
          {requestDateWarning ? (
            <p className="meta-text full camp-request-date-warning">
              Request date is more than 2 days from today. Confirm this is intentional.
            </p>
          ) : null}
          <div className="camp-request-times full">
            <label>
              Camp Start Time
              <input type="time" value={form.startTime} onChange={(e) => updateField('startTime', e.target.value)} disabled={disabled} required />
            </label>
            <label>
              Camp End Time
              <input type="time" value={form.endTime} onChange={(e) => updateField('endTime', e.target.value)} disabled={disabled} required />
            </label>
            <ReadOnlyField label="Camp Duration" value={durationLabel} />
            <ReadOnlyField label="Camp Slot" value={derived.campSlot} />
          </div>
          <div className="camp-request-doctor-row full">
            <label>
              Doctor Name
              <input value={form.doctorName} onChange={(e) => updateField('doctorName', e.target.value)} disabled={disabled} required />
            </label>
            <label>
              Doctor Code
              <input value={form.doctorCode} onChange={(e) => updateField('doctorCode', e.target.value)} disabled={disabled} required />
            </label>
            <label>
              Doctor Type / Specialty
              <OtherAwareSelect
                options={specialtyOptions}
                value={form.speciality}
                onChange={(e) => updateField('speciality', e.target.value)}
                picklistKey="camp.doctorSpecialty"
                otherLabel="Other (Specify Others)"
                source="camp.request"
                disabled={disabled}
              />
            </label>
          </div>
          <div className="full field camp-address-field-block">
            <span className="camp-address-field-label">
              Camp / Clinic Address{!disabled ? ' *' : ''}
            </span>
            <CampAddressField
              disabled={disabled}
              required
              value={{
                campAddress: form.campAddress || '',
              }}
              onChange={(loc) => {
                updateFields?.({
                  campAddress: loc.campAddress ?? form.campAddress,
                  addressManualEntry: true,
                  googlePlaceId: '',
                  latitude: '',
                  longitude: '',
                  ...(form.hqManuallyEdited ? {} : { hq: loc.city ?? form.city ?? '' }),
                });
              }}
            />
          </div>
          <div className="camp-request-location-row full">
            <CampLocationFields
              disabled={disabled}
              required
              value={{
                city: form.city || '',
                cityId: form.cityId || '',
                state: form.state || '',
                district: form.district || '',
                pincode: form.pincode || '',
                zone: form.zone || '',
                stateId: form.stateId || '',
                districtId: form.districtId || '',
              }}
              onChange={(loc) => {
                updateFields?.({
                  city: loc.city || '',
                  cityId: loc.cityId || '',
                  state: loc.state || '',
                  district: loc.district || '',
                  pincode: loc.pincode || '',
                  zone: loc.zone || '',
                  stateId: loc.stateId || '',
                  districtId: loc.districtId || '',
                  ...(form.hqManuallyEdited ? {} : { hq: loc.city || '' }),
                });
              }}
            />
          </div>
          <div className="camp-request-contacts full">
            {contactPersons.map((contact, index) => (
              <div className="camp-request-contact-row" key={`contact-${index}`}>
                <label>
                  <span className="camp-request-contact-label">
                    Contact Person Level
                    {index === 0 ? (
                      <button
                        type="button"
                        className="camp-contact-add-btn"
                        onClick={addContactPerson}
                        disabled={disabled}
                        aria-label="Add another contact person"
                        title="Add contact person"
                      >
                        +
                      </button>
                    ) : null}
                  </span>
                  <select
                    value={contact.level || DEFAULT_CONTACT_PERSON_LEVEL}
                    onChange={(e) => updateContactPerson(index, { level: e.target.value })}
                    disabled={disabled}
                    required
                  >
                    <option value="">Select…</option>
                    {CONTACT_PERSON_LEVEL_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Contact Person Name
                  <input
                    value={contact.name || ''}
                    onChange={(e) => updateContactPerson(index, { name: e.target.value })}
                    disabled={disabled}
                    required
                  />
                </label>
                <PhoneField
                  label="Contact Person Number"
                  value={contact.phone || ''}
                  onChange={(value) => updateContactPerson(index, { phone: value })}
                  required
                  disabled={disabled}
                />
                {index > 0 ? (
                  <button
                    type="button"
                    className="camp-contact-remove-btn"
                    onClick={() => removeContactPerson(index)}
                    disabled={disabled}
                    aria-label={`Remove contact person ${index + 1}`}
                    title="Remove contact person"
                  >
                    ×
                  </button>
                ) : null}
              </div>
            ))}
          </div>
          <div className="camp-request-footer-row full">
            <label>
              HQ
              <input
                value={form.hq}
                onChange={(e) => updateFields?.({ hq: e.target.value, hqManuallyEdited: true })}
                disabled={disabled}
                required
              />
            </label>
            <label>
              Expected Patients
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={form.expectedPatients === '' || form.expectedPatients == null ? '' : String(form.expectedPatients)}
                onChange={(e) => updateField('expectedPatients', e.target.value.replace(/[^\d]/g, ''))}
                disabled={disabled}
                required
              />
            </label>
            <label>
              Remarks
              <input
                type="text"
                value={form.remarks}
                onChange={(e) => updateField('remarks', e.target.value)}
                disabled={disabled}
              />
            </label>
          </div>
        </div>
      </div>
    );
  }

  function renderAssignmentStage() {
    return (
      <CampAssignmentStage
        form={form}
        updateField={updateField}
        updateFields={updateFields}
        hcwContacts={hcwContacts}
        contactsLoading={contactsLoading}
        disabled={stageDisabled('assignment')}
        campStatus={campStatus}
      />
    );
  }

  function renderExecutionStage() {
    const disabled = stageDisabled('execution');
    const effectiveStatus = resolveEffectiveExecutionStatus(form);
    const canMarkCompleted = effectiveStatus === EXECUTION_STATUS.MARKED_EXECUTED;
    const docs = Array.isArray(form.executionDocuments) ? form.executionDocuments : [];
    const doctorForms = docs.filter((d) => normalizeExecutionDocType(d.docType) === 'doctor_form').length;
    const patientForms = docs.filter((d) => normalizeExecutionDocType(d.docType) === 'patient_form').length;

    function handleMarkCompleted() {
      const consumableBlockers = getExecutionConsumablesBlockers(form, mappedConsumables);
      if (consumableBlockers.length) {
        onValidationError?.(consumableBlockers[0]);
        return;
      }
      updateFields?.({
        executionStatus: EXECUTION_STATUS.CAMP_COMPLETED,
        inTime: form.inTime || form.startTime || '',
        outTime: form.outTime || form.endTime || '',
      });
    }

    return (
      <>
        <div className="form-grid camp-execution-status-row">
          <SelectField
            label="Chargeable Status"
            value={form.chargeableStatus}
            onChange={(v) => updateField('chargeableStatus', v)}
            options={CHARGEABLE_STATUSES}
            disabled={disabled}
          />
          <ExecutionStatusField effectiveStatus={effectiveStatus} />
          {canMarkCompleted ? (
            <div className="full camp-execution-complete-row">
              <button
                type="button"
                className="btn secondary btn-sm camp-execution-complete-btn"
                disabled={disabled}
                onClick={handleMarkCompleted}
              >
                Mark as Camp Completed
              </button>
            </div>
          ) : null}
          {effectiveStatus === EXECUTION_STATUS.MARKED_EXECUTED && !isExecutionReadyForFinance(form, mappedConsumables) ? (
            <p className="meta-text camp-execution-action-note full">
              Action required: complete mandatory execution details and mark as Camp Completed for Finance.
            </p>
          ) : null}
        </div>

        <div className="form-grid camp-execution-fields-grid">
          <label>
            In Time
            <input value={form.inTime} onChange={(e) => updateField('inTime', e.target.value)} disabled={disabled} placeholder="HH:MM" />
          </label>
          <label>
            Out Time
            <input value={form.outTime} onChange={(e) => updateField('outTime', e.target.value)} disabled={disabled} placeholder="HH:MM" />
          </label>
          <ReadOnlyField label="Total Hours" value={derived.totalHours} />
          <ReadOnlyField label="Extra hours" value={derived.extraHours} />
          <label>
            Travelled Kms (Round Trip)
            <input type="number" value={form.kmRoundTrip} onChange={(e) => updateField('kmRoundTrip', e.target.value)} disabled={disabled} />
          </label>
          <PunctualityField
            value={derived.punctuality}
            campStartTime={form.startTime}
            inTime={form.inTime}
          />
          <SelectField label="Attire" value={form.attire} onChange={(v) => updateField('attire', v)} options={ATTIRE_CHECK_OPTIONS} disabled={disabled} />
          <label>
            Patients Screened
            <input type="number" value={form.patientsCount} onChange={(e) => updateField('patientsCount', Number(e.target.value))} disabled={disabled} />
          </label>
          <label>
            Product Count
            <input type="number" value={form.rxCount} onChange={(e) => updateField('rxCount', Number(e.target.value))} disabled={disabled} />
          </label>
        </div>

        <div className="camp-execution-tracking-row">
          <CampExecutionDocuments
            docs={docs}
            campId={campId}
            onUploadDocuments={onUploadDocuments}
            uploadBusy={uploadBusy}
            disabled={disabled}
          />

          <CampConsumablesUsed
            value={form.consumablesUsed}
            onChange={(rows) => updateField('consumablesUsed', rows)}
            disabled={disabled}
            mappedItems={mappedConsumables}
          />
        </div>
      </>
    );
  }

  function renderFinancialStage() {
    const disabled = stageDisabled('financial');
    const submitted = Boolean(form.submittedToFinanceAt);
    const showHcwBlockers = !submitted && hcwFinanceBlockers.length > 0;
    return (
      <div className="form-grid">
        {assignedHcwLoading ? (
          <p className="meta-text full">Checking assigned HCW profile…</p>
        ) : null}
        {showHcwBlockers ? (
          <div className="camp-finance-hcw-blockers full">
            <p className="meta-text camp-finance-hcw-blockers-title">
              Complete the assigned HCW profile in Contact Directory before submitting to Finance:
            </p>
            <ul className="camp-finance-hcw-blockers-list">
              {hcwFinanceBlockers.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            {assignedHcwContact?.name ? (
              <p className="meta-text">
                Assigned HCW: <strong>{assignedHcwContact.name}</strong>
                {' · '}
                <a href="/master-data?scope=document&entity=contacts">Open Contact Directory</a>
              </p>
            ) : null}
          </div>
        ) : null}
        <label>
          Camp Revenue
          <input type="number" value={form.campRevenue} onChange={(e) => updateField('campRevenue', Number(e.target.value))} disabled={disabled} />
        </label>
        <label>
          Overtime Revenue
          <input type="number" value={form.overtimeRevenue} onChange={(e) => updateField('overtimeRevenue', Number(e.target.value))} disabled={disabled} />
        </label>
        <label>
          Other Revenue
          <input type="number" value={form.otherRevenue} onChange={(e) => updateField('otherRevenue', Number(e.target.value))} disabled={disabled} />
        </label>
        <ReadOnlyField label="Total Revenue (Auto)" value={derived.totalRevenue} />
        <label>
          Camp Amount
          <input type="number" value={form.campAmount} onChange={(e) => updateField('campAmount', Number(e.target.value))} disabled={disabled} />
        </label>
        <label>
          Travelling
          <input type="number" value={form.travelling} onChange={(e) => updateField('travelling', Number(e.target.value))} disabled={disabled} />
        </label>
        <label>
          Overtime
          <input type="number" value={form.overtimeExpense} onChange={(e) => updateField('overtimeExpense', Number(e.target.value))} disabled={disabled} />
        </label>
        <label>
          Other Expenses
          <input type="number" value={form.otherExpenses} onChange={(e) => updateField('otherExpenses', Number(e.target.value))} disabled={disabled} />
        </label>

        <div className="camp-payout-submit-row full">
          <ReadOnlyField label="Total Payout (Auto)" value={derived.totalPayout} />
          <SelectField
            label="Payment check"
            value={form.paymentSubmitStatus}
            onChange={(v) => updateField('paymentSubmitStatus', v)}
            options={PAYMENT_SUBMIT_STATUSES}
            disabled={disabled || submitted}
            required={!submitted}
          />
        </div>

        {submitted && (
          <div className="camp-finance-submitted full">
            <p className="meta-text">
              Submitted to Finance One
              {form.submittedToFinanceAt ? ` on ${new Date(form.submittedToFinanceAt).toLocaleString()}` : ''}.
              {' '}
              Check: <strong>{paymentSubmitStatusLabel(form.paymentSubmitStatus)}</strong>
              {' · '}
              Finance status: <strong>{financePaymentStatusLabel(form.financePaymentStatus)}</strong>
            </p>
            {form.financePaymentStatus === 'paid' && (
              <p className="meta-text">
                Paid {form.paidAmount ?? 0}
                {form.transactionId ? ` · UTR ${form.transactionId}` : ''}
                {derived.balance != null && derived.balance !== '' ? ` · Balance ${derived.balance}` : ''}
              </p>
            )}
            {campId && onDownloadFinanceExport && (
              <div className="camp-finance-download-actions">
                <button
                  type="button"
                  className="btn secondary btn-compact"
                  disabled={downloadFinanceBusy}
                  onClick={onDownloadFinanceExport}
                >
                  {downloadFinanceBusy ? ACTION.DOWNLOADING : ACTION.DOWNLOAD_EXCEL}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  const panels = {
    request: renderRequestStage,
    assignment: renderAssignmentStage,
    execution: renderExecutionStage,
    financial: renderFinancialStage,
  };
  const renderActivePanel = panels[resolvedActiveStage] || renderRequestStage;

  return (
    <div className="camp-lifecycle-form">
      <CampLifecycleStepper
        activeStage={resolvedActiveStage}
        campStatus={campStatus}
        reachedLifecycleStage={normalizeLifecycleStage(reachedLifecycleStage, 'request')}
        onSelect={(stage) => {
          const nextStage = normalizeLifecycleStage(stage, resolvedActiveStage);
          if (!canVisitLifecycleStage(reachedLifecycleStage, nextStage)) {
            onValidationError?.('Complete earlier stages before opening this section.');
            return;
          }
          const movingForward = lifecycleStageIndex(nextStage) > lifecycleStageIndex(resolvedActiveStage);
          if (movingForward && resolvedActiveStage === 'request') {
            const requestErrors = validateRequestStageForm(form);
            if (requestErrors.length) {
              onValidationError?.(requestErrors[0]);
              return;
            }
          }
          onStageChange(nextStage);
        }}
      />
      <div className="camp-lifecycle-panel">
        {renderActivePanel()}
      </div>
    </div>
  );
}
