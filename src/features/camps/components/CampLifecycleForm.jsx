import { useEffect, useMemo, useRef, useState } from 'react';
import { bindAutofillBlock, bindAutofillBlockSelect } from '../../../shared/suppressBrowserAutofill.js';
import CampAddressField from './CampAddressField.jsx';
import CampLocationFields from './CampLocationFields.jsx';
import { CampNameSelect } from './CampNameSelect';
import { DateInput } from './DateInput';
import OtherAwareSelect from '../../../components/ui/OtherAwareSelect.jsx';
import { PhoneField } from '../../../components/ui/PhoneField.jsx';
import { CampFormInput } from './CampFormInput.jsx';
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
  isExecutionCancellationForFinance,
  resolveCancelledClosureExecutionStatus,
  normalizeExecutionDocType,
  EXECUTION_STATUS,
  normalizeExecutionStatus,
  resolveEffectiveExecutionStatus,
  executionStatusLabel,
  getExecutionConsumablesBlockers,
  getExecutionFinanceBlockers,
  computePunctualityLateness,
  formatLatenessHhMm,
} from '../constants/campLifecycle';
import { financialWorkflowStatus } from '../constants/campWorkflowStatuses.js';
import { ACTION } from '../../../shared/labels.js';
import { validateRequestStageForm } from '../utils/validateRequestStage';
import { DOCTOR_SPECIALTY_OPTIONS, isRequestDateFarFromToday, isHistoricalCampDate } from '../constants/doctorSpecialty';
import { minAllowedCampDateIso } from '../utils/campDatePolicy';
import { computeDurationHours } from '../utils/campSchedule';
import { CampAssignmentStage } from './CampAssignmentStage';
import CampConsumablesUsed from './CampConsumablesUsed.jsx';
import { CampExecutionDocuments } from './CampExecutionDocuments.jsx';
import {
  DEFAULT_CONTACT_PERSON_LEVEL,
  emptyContactPerson,
  syncPrimaryContactFields,
} from '../utils/campContactPersons';
import { formatDoctorName, formatContactPersonName } from '../../../shared/textFormat.js';
import {
  FINANCE_PAYOUT_PART_FIELDS,
  FINANCE_REVENUE_PART_FIELDS,
  formatFinanceAmountValue,
  sanitizeFinanceAmountInput,
} from '../utils/campFinanceAmounts.js';
import { resolveClientMasterPricingFromRecords } from '../utils/campClientMasterPricing.js';

function ReadOnlyField({ label, value }) {
  return (
    <label>
      {label}
      <input value={value ?? ''} readOnly className="input-readonly" />
    </label>
  );
}

function FinanceAmountField({ label, value, onChange, disabled, hint }) {
  return (
    <label>
      {label}
      <CampFormInput
        type="text"
        inputMode="decimal"
        value={formatFinanceAmountValue(value)}
        onChange={(e) => onChange(sanitizeFinanceAmountInput(e.target.value))}
        disabled={disabled}
        placeholder="0"
      />
      {hint ? <span className="meta-text">{hint}</span> : null}
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
      <ReadOnlyField label="Execution Status" value={executionStatusLabel(effectiveStatus)} />
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
  clientMasterProfessions = [],
  clientMasterProfession = '',
  clientMasterLoading = false,
  clientMasterHcwGap = '',
  onValidationError,
  reachedLifecycleStage = 'request',
  mappedConsumables = [],
  clientMasterRecords = [],
  onConfirmPayment = null,
  onHoldPayment = null,
  onReleaseHold = null,
  financialActionBusy = false,
  canSetHistoricalCampDates = false,
}) {
  const resolvedActiveStage = normalizeLifecycleStage(activeStage, 'request');
  const clientMasterPricing = useMemo(
    () => resolveClientMasterPricingFromRecords(clientMasterRecords, {
      campaignType: form.campaignType,
      campaignName: form.campaignName,
    }),
    [clientMasterRecords, form.campaignType, form.campaignName],
  );
  const derived = useMemo(
    () => computeLifecycleDerived(form, { pricing: clientMasterPricing }),
    [form, clientMasterPricing],
  );
  const revenueAutoSyncRef = useRef(true);
  const revenueSyncCampKeyRef = useRef('');

  useEffect(() => {
    const campKey = String(campId || form._id || form.campId || '');
    if (revenueSyncCampKeyRef.current !== campKey) {
      revenueSyncCampKeyRef.current = campKey;
      revenueAutoSyncRef.current = true;
    }
  }, [campId, form._id, form.campId]);

  useEffect(() => {
    if (!clientMasterPricing || !updateFields || !derived.revenueAutoCalculated) return;
    if (!revenueAutoSyncRef.current) return;

    const formula = {
      campRevenue: derived.formulaCampRevenue,
      travelRevenue: derived.formulaTravelRevenue,
      overtimeRevenue: derived.formulaOvertimeRevenue,
      otherRevenue: derived.formulaOtherRevenue,
      totalRevenue: derived.formulaTotalRevenue,
    };
    const hasStoredRevenue = FINANCE_REVENUE_PART_FIELDS.some(
      (key) => Number(form[key] || 0) !== 0,
    );
    const differsFromFormula = FINANCE_REVENUE_PART_FIELDS.some(
      (key) => Number(form[key] || 0) !== Number(formula[key] || 0),
    );
    if (hasStoredRevenue && differsFromFormula) {
      revenueAutoSyncRef.current = false;
      return;
    }

    const same = FINANCE_REVENUE_PART_FIELDS.every(
      (key) => Number(form[key] || 0) === Number(formula[key] || 0),
    ) && Number(form.totalRevenue || 0) === Number(formula.totalRevenue || 0);
    if (same) return;
    updateFields(formula);
  }, [
    clientMasterPricing,
    derived.revenueAutoCalculated,
    derived.formulaCampRevenue,
    derived.formulaTravelRevenue,
    derived.formulaOvertimeRevenue,
    derived.formulaOtherRevenue,
    derived.formulaTotalRevenue,
    form.campRevenue,
    form.travelRevenue,
    form.overtimeRevenue,
    form.otherRevenue,
    form.totalRevenue,
    updateFields,
  ]);
  const { options: specialtyOptions } = usePicklistOptions('camp.doctorSpecialty', DOCTOR_SPECIALTY_OPTIONS);
  const requestDateWarning = isRequestDateFarFromToday(form.requestDate)
    && !isHistoricalCampDate(form.requestDate);
  const campDateHistorical = isHistoricalCampDate(form.campDate);
  const requestDateHistorical = isHistoricalCampDate(form.requestDate);
  const earliestAllowedDate = canSetHistoricalCampDates ? undefined : minAllowedCampDateIso();

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
    const singleDivisionOption = divisionOptions.length === 1;
    const singleMethodOption = campNameOptions.length === 1;

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
                <option value="">Select Client</option>
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
                disabled={disabled || programsLoading || !form.clientId || !divisionOptions.length || singleDivisionOption}
                required
              >
                <option value="">{programsLoading ? 'Loading…' : singleDivisionOption ? form.campaignType : 'Select division / therapy'}</option>
                {divisionOptions.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </label>
            <label>
              Method
              <CampNameSelect
                value={form.campaignName}
                onChange={(v) => updateField('campaignName', v)}
                disabled={disabled || programsLoading || !form.clientId || !form.campaignType || !campNameOptions.length || singleMethodOption}
                required
                options={campNameOptions}
                emptyLabel={!form.clientId ? 'Select Client first' : !form.campaignType ? 'Select division first' : singleMethodOption ? form.campaignName : 'Select method'}
              />
            </label>
          </div>
          <div className="camp-request-dates-row full">
            <label>
              Camp Date
              <DateInput
                hideLabel
                value={form.campDate}
                onChange={(v) => updateField('campDate', v)}
                disabled={disabled}
                required
                min={earliestAllowedDate}
              />
            </label>
            <label>
              Request Date
              <DateInput
                hideLabel
                value={form.requestDate}
                onChange={(v) => updateField('requestDate', v)}
                disabled={disabled}
                min={earliestAllowedDate}
              />
            </label>
          </div>
          {campDateHistorical && !canSetHistoricalCampDates ? (
            <p className="meta-text full camp-request-date-warning camp-request-date-warning--error">
              Camp date is more than 2 days before today. Only Team Leaders can use this date.
            </p>
          ) : null}
          {requestDateHistorical && !canSetHistoricalCampDates ? (
            <p className="meta-text full camp-request-date-warning camp-request-date-warning--error">
              Request date is more than 2 days before today. Only Team Leaders can use this date.
            </p>
          ) : null}
          {requestDateWarning ? (
            <p className="meta-text full camp-request-date-warning">
              Request date is more than 2 days from today. Confirm this is intentional.
            </p>
          ) : null}
          <div className="camp-request-times full">
            <label>
              Camp Start Time
              <CampFormInput type="time" value={form.startTime} onChange={(e) => updateField('startTime', e.target.value)} disabled={disabled} required />
            </label>
            <label>
              Camp End Time
              <CampFormInput type="time" value={form.endTime} onChange={(e) => updateField('endTime', e.target.value)} disabled={disabled} required />
            </label>
            <ReadOnlyField label="Camp Duration" value={durationLabel} />
            <ReadOnlyField label="Camp Slot" value={derived.campSlot} />
          </div>
          <div className="camp-request-doctor-row full">
            <label>
              Doctor Name
              <CampFormInput
                value={form.doctorName}
                onChange={(e) => updateField('doctorName', e.target.value)}
                onBlur={(e) => updateField('doctorName', formatDoctorName(e.target.value))}
                disabled={disabled}
                required
              />
              {!disabled ? (
                <span className="meta-text">Title Case, no Dr or Dr. prefix</span>
              ) : null}
            </label>
            <label>
              Doctor Code
              <CampFormInput value={form.doctorCode} onChange={(e) => updateField('doctorCode', e.target.value)} disabled={disabled} required />
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
                    {...bindAutofillBlockSelect()}
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
                  <CampFormInput
                    value={contact.name || ''}
                    onChange={(e) => updateContactPerson(index, { name: e.target.value })}
                    onBlur={(e) => updateContactPerson(index, { name: formatContactPersonName(e.target.value) })}
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
              <CampFormInput
                value={form.hq}
                onChange={(e) => updateFields?.({ hq: e.target.value, hqManuallyEdited: true })}
                disabled={disabled}
                required
              />
            </label>
            <label>
              Expected Patients
              <CampFormInput
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
              <CampFormInput
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
        clientMasterProfessions={clientMasterProfessions}
        clientMasterProfession={clientMasterProfession}
        clientMasterLoading={clientMasterLoading}
        clientMasterHcwGap={clientMasterHcwGap}
        clientMasterRecords={clientMasterRecords}
        disabled={stageDisabled('assignment')}
        campStatus={campStatus}
        excludeCampId={campId || ''}
      />
    );
  }

  function renderExecutionStage() {
    const disabled = stageDisabled('execution');
    const cancelledClosure = campStatus === 'cancelled'
      && isExecutionCancellationForFinance({ status: campStatus, ...form });
    const effectiveStatus = cancelledClosure
      ? (resolveCancelledClosureExecutionStatus({ status: campStatus, ...form }) || resolveEffectiveExecutionStatus(form))
      : resolveEffectiveExecutionStatus(form);
    const canMarkCompleted = !cancelledClosure && effectiveStatus === EXECUTION_STATUS.MARKED_EXECUTED;
    const docs = Array.isArray(form.executionDocuments) ? form.executionDocuments : [];
    const doctorForms = docs.filter((d) => normalizeExecutionDocType(d.docType) === 'doctor_form').length;
    const patientForms = docs.filter((d) => normalizeExecutionDocType(d.docType) === 'patient_form').length;

    function handleMarkCompleted() {
      const blockers = getExecutionFinanceBlockers(form, mappedConsumables);
      if (blockers.length) {
        onValidationError?.(blockers[0]);
        return;
      }
      updateFields?.({
        executionStatus: EXECUTION_STATUS.CAMP_COMPLETED,
        markComplete: true,
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
                Mark Complete
              </button>
            </div>
          ) : null}
          {cancelledClosure ? (
            <div className="full camp-execution-action-note-wrap">
              <p className="meta-text camp-execution-action-note">
                This camp was cancelled. Open Finance &amp; Settlement to complete closure billing.
              </p>
              <button
                type="button"
                className="btn secondary btn-sm"
                onClick={() => onStageChange?.('financial')}
              >
                Go to Finance &amp; Settlement
              </button>
            </div>
          ) : null}
          {!cancelledClosure && effectiveStatus === EXECUTION_STATUS.MARKED_EXECUTED && !isExecutionReadyForFinance(form, mappedConsumables) ? (
            <p className="meta-text camp-execution-action-note full">
              Action required: complete Out Time, Travelled Kms, Patients, Product Count, documents, and consumables, then Mark Complete.
            </p>
          ) : null}
        </div>

        <div className="form-grid camp-execution-fields-grid">
          <label>
            In Time
            <CampFormInput value={form.inTime} onChange={(e) => updateField('inTime', e.target.value)} disabled={disabled} placeholder="HH:MM" />
          </label>
          <label>
            Out Time
            <CampFormInput value={form.outTime} onChange={(e) => updateField('outTime', e.target.value)} disabled={disabled} placeholder="HH:MM" />
          </label>
          <ReadOnlyField label="Total Hours" value={derived.totalHours} />
          <ReadOnlyField label="Extra hours" value={derived.extraHours} />
          <label>
            Travelled Kms (Round Trip)
            <CampFormInput type="number" value={form.kmRoundTrip} onChange={(e) => updateField('kmRoundTrip', e.target.value)} disabled={disabled} />
          </label>
          <PunctualityField
            value={derived.punctuality}
            campStartTime={form.startTime}
            inTime={form.inTime}
          />
          <SelectField label="Attire" value={form.attire} onChange={(v) => updateField('attire', v)} options={ATTIRE_CHECK_OPTIONS} disabled={disabled} />
          <label>
            Patients Screened
            <CampFormInput type="number" value={form.patientsCount} onChange={(e) => updateField('patientsCount', Number(e.target.value))} disabled={disabled} />
          </label>
          <label>
            Product Count
            <CampFormInput type="number" value={form.rxCount} onChange={(e) => updateField('rxCount', Number(e.target.value))} disabled={disabled} />
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
            patientsScreened={form.patientsCount}
          />
        </div>
      </>
    );
  }

  function renderFinancialStage() {
    const disabled = stageDisabled('financial');
    const submitted = Boolean(form.submittedToFinanceAt);
    const showHcwBlockers = !submitted && hcwFinanceBlockers.length > 0;

    function updateFinanceAmount(field, raw) {
      const nextValue = sanitizeFinanceAmountInput(raw);
      const isRevenuePart = FINANCE_REVENUE_PART_FIELDS.includes(field);
      const isPayoutPart = FINANCE_PAYOUT_PART_FIELDS.includes(field);
      if (isRevenuePart || field === 'totalRevenue') {
        revenueAutoSyncRef.current = false;
      }
      if (isRevenuePart || isPayoutPart) {
        const nextForm = { ...form, [field]: nextValue };
        const nextDerived = computeLifecycleDerived(nextForm, { pricing: clientMasterPricing });
        updateFields?.({
          [field]: nextValue,
          ...(isRevenuePart ? { totalRevenue: nextDerived.totalRevenue } : {}),
          ...(isPayoutPart ? { totalPayout: nextDerived.totalPayout } : {}),
        });
        return;
      }
      updateField(field, nextValue);
    }

    return (
      <div className="form-grid">
        {assignedHcwLoading ? (
          <p className="meta-text full">Checking assigned HCW profile…</p>
        ) : null}
        {showHcwBlockers ? (
          <div className="camp-finance-hcw-blockers full">
            <p className="meta-text camp-finance-hcw-blockers-title">
              Complete the payee profile in Contact Directory before submitting to Finance:
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
                <a href="/master-one?scope=document&entity=contacts">Open Contact Directory</a>
              </p>
            ) : null}
          </div>
        ) : null}
        <div className="camp-finance-section full">
          <p className="camp-finance-section__title">Revenue</p>
          <div className="camp-finance-section__row camp-finance-section__row--4">
            <FinanceAmountField
              label="Camp Revenue"
              value={form.campRevenue ?? derived.campRevenue}
              onChange={(v) => updateFinanceAmount('campRevenue', v)}
              disabled={disabled}
            />
            <FinanceAmountField
              label="Travel Revenue"
              value={form.travelRevenue ?? derived.travelRevenue}
              onChange={(v) => updateFinanceAmount('travelRevenue', v)}
              disabled={disabled}
            />
            <FinanceAmountField
              label="Overtime Revenue"
              value={form.overtimeRevenue ?? derived.overtimeRevenue}
              onChange={(v) => updateFinanceAmount('overtimeRevenue', v)}
              disabled={disabled}
            />
            <FinanceAmountField
              label="Other Revenue"
              value={form.otherRevenue ?? derived.otherRevenue}
              onChange={(v) => updateFinanceAmount('otherRevenue', v)}
              disabled={disabled}
            />
          </div>
          {clientMasterPricing ? (
            <p className="meta-text">
              Defaults from Client Master — Travel (distance excess)
              {' '}
              {formatFinanceAmountValue(derived.otherRevenueDistance)}
              {' · '}
              Other (patient excess)
              {' '}
              {formatFinanceAmountValue(derived.otherRevenuePatients)}
              {clientMasterPricing.programName || clientMasterPricing.campName
                ? ` · ${[clientMasterPricing.programName, clientMasterPricing.campName].filter(Boolean).join(' / ')}`
                : ''}
              . You can override any revenue amount.
            </p>
          ) : (
            <p className="meta-text">
              Link Client Master units (Executed / Cancelled / OT / Patients / KMs) for this client’s division and method to auto-calculate revenue defaults. Amounts stay editable either way.
            </p>
          )}
        </div>

        <div className="camp-finance-section full">
          <p className="camp-finance-section__title">Payout</p>
          <div className="camp-finance-section__row camp-finance-section__row--4">
            <FinanceAmountField
              label="Camp Payout"
              value={form.campAmount}
              onChange={(v) => updateFinanceAmount('campAmount', v)}
              disabled={disabled}
            />
            <FinanceAmountField
              label="Travel Payout"
              value={form.travelling}
              onChange={(v) => updateFinanceAmount('travelling', v)}
              disabled={disabled}
            />
            <FinanceAmountField
              label="Overtime Payout"
              value={form.overtimeExpense}
              onChange={(v) => updateFinanceAmount('overtimeExpense', v)}
              disabled={disabled}
            />
            <FinanceAmountField
              label="Other Payouts"
              value={form.otherExpenses}
              onChange={(v) => updateFinanceAmount('otherExpenses', v)}
              disabled={disabled}
            />
          </div>
        </div>

        <div className="camp-finance-section full">
          <p className="camp-finance-section__title">Summary</p>
          <div className="camp-finance-section__row camp-finance-section__row--4">
            <FinanceAmountField
              label="Total Revenue"
              value={form.totalRevenue ?? derived.totalRevenue}
              onChange={(v) => updateFinanceAmount('totalRevenue', v)}
              disabled={disabled}
            />
            <FinanceAmountField
              label="Total Payout"
              value={form.totalPayout ?? derived.totalPayout}
              onChange={(v) => updateFinanceAmount('totalPayout', v)}
              disabled={disabled}
            />
            <ReadOnlyField
              label="Net Contribution"
              value={formatFinanceAmountValue(
                Math.round((
                  (Number(form.totalRevenue ?? derived.totalRevenue) || 0)
                  - (Number(form.totalPayout ?? derived.totalPayout) || 0)
                ) * 100) / 100,
              )}
            />
            <ReadOnlyField
              label="Payment Check"
              value={financialWorkflowStatus(form).label}
            />
          </div>
        </div>

        {!submitted && form.financePaymentStatus !== 'paid' ? (
          <div className="full camp-finance-workflow-actions">
            {(form.paymentSubmitStatus === 'payment_not_checked' || !form.paymentSubmitStatus) ? (
              <button
                type="button"
                className="btn secondary btn-sm"
                disabled={disabled || financialActionBusy || !onConfirmPayment}
                onClick={() => onConfirmPayment?.()}
              >
                Confirm Payment
              </button>
            ) : null}
            {form.paymentSubmitStatus === 'payment_hold' ? (
              <button
                type="button"
                className="btn secondary btn-sm"
                disabled={disabled || financialActionBusy || !onReleaseHold}
                onClick={() => onReleaseHold?.()}
              >
                Release Hold
              </button>
            ) : (
              <>
                <label className="camp-hold-remark-field">
                  Hold Remark
                  <CampFormInput
                    value={form.paymentRemark || ''}
                    onChange={(e) => updateField('paymentRemark', e.target.value)}
                    disabled={disabled || form.financePaymentStatus === 'paid'}
                    placeholder="Required when placing on Hold"
                  />
                </label>
                <button
                  type="button"
                  className="btn secondary btn-sm"
                  disabled={disabled || financialActionBusy || !onHoldPayment}
                  onClick={() => onHoldPayment?.(form.paymentRemark)}
                >
                  Hold
                </button>
              </>
            )}
          </div>
        ) : null}

        {submitted && (
          <div className="camp-finance-submitted full">
            <p className="meta-text">
              Submitted to Finance One
              {form.submittedToFinanceAt ? ` on ${new Date(form.submittedToFinanceAt).toLocaleString()}` : ''}.
              {' '}
              Payment Check: <strong>{financialWorkflowStatus(form).label}</strong>
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
