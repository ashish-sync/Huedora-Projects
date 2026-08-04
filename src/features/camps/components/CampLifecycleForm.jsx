import { useMemo, useState } from 'react';
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
import {
  CAMP_FINANCE_EXPENSE_CATEGORY,
  CAMP_FINANCE_EXPENSE_SUB_CATEGORY,
} from '../utils/campFinanceExpense.js';

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
  clientMasterProfessions = [],
  clientMasterProfession = '',
  clientMasterLoading = false,
  onValidationError,
  reachedLifecycleStage = 'request',
  mappedConsumables = [],
  canSetHistoricalCampDates = false,
}) {
  const resolvedActiveStage = normalizeLifecycleStage(activeStage, 'request');
  const derived = useMemo(() => computeLifecycleDerived(form), [form]);
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
                emptyLabel={!form.clientId ? 'Select client first' : !form.campaignType ? 'Select division first' : singleMethodOption ? form.campaignName : 'Select method'}
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
      if (isRevenuePart || isPayoutPart) {
        const nextForm = { ...form, [field]: nextValue };
        const nextDerived = computeLifecycleDerived(nextForm);
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
        <ReadOnlyField
          label="Expense Category *"
          value={form.expenseCategory || CAMP_FINANCE_EXPENSE_CATEGORY}
        />
        <ReadOnlyField
          label="Expense Sub-Category *"
          value={form.expenseSubCategory || CAMP_FINANCE_EXPENSE_SUB_CATEGORY}
        />
        <FinanceAmountField
          label="Camp Revenue"
          value={form.campRevenue}
          onChange={(v) => updateFinanceAmount('campRevenue', v)}
          disabled={disabled}
        />
        <FinanceAmountField
          label="Overtime Revenue"
          value={form.overtimeRevenue}
          onChange={(v) => updateFinanceAmount('overtimeRevenue', v)}
          disabled={disabled}
        />
        <FinanceAmountField
          label="Other Revenue"
          value={form.otherRevenue}
          onChange={(v) => updateFinanceAmount('otherRevenue', v)}
          disabled={disabled}
        />
        <FinanceAmountField
          label="Total Revenue (Auto)"
          value={form.totalRevenue ?? derived.totalRevenue}
          onChange={(v) => updateFinanceAmount('totalRevenue', v)}
          disabled={disabled}
        />
        <FinanceAmountField
          label="Camp Amount"
          value={form.campAmount}
          onChange={(v) => updateFinanceAmount('campAmount', v)}
          disabled={disabled}
        />
        <FinanceAmountField
          label="Travelling"
          value={form.travelling}
          onChange={(v) => updateFinanceAmount('travelling', v)}
          disabled={disabled}
        />
        <FinanceAmountField
          label="Overtime"
          value={form.overtimeExpense}
          onChange={(v) => updateFinanceAmount('overtimeExpense', v)}
          disabled={disabled}
        />
        <FinanceAmountField
          label="Other Expenses"
          value={form.otherExpenses}
          onChange={(v) => updateFinanceAmount('otherExpenses', v)}
          disabled={disabled}
        />

        <div className="camp-payout-submit-row full">
          <FinanceAmountField
            label="Total Payout (Auto)"
            value={form.totalPayout ?? derived.totalPayout}
            onChange={(v) => updateFinanceAmount('totalPayout', v)}
            disabled={disabled}
          />
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
