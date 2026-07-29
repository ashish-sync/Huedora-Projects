import { useMemo, useState } from 'react';
import CampAddressAutocomplete from './CampAddressAutocomplete.jsx';
import CampLocationFields from './CampLocationFields.jsx';
import { CampNameSelect } from './CampNameSelect';
import { DateInput } from './DateInput';
import OtherAwareSelect from '../../../components/ui/OtherAwareSelect.jsx';
import { usePicklistOptions } from '../../../shared/usePicklistOptions.js';
import { CampAssignmentStage } from './CampAssignmentStage';
import { CampLifecycleStepper } from './CampLifecycleStepper';
import {
  CAMP_SOURCE_OPTIONS,
  CHARGEABLE_STATUSES,
  EXECUTION_DOC_TYPES,
  EXECUTION_STATUSES,
  ATTIRE_CHECK_OPTIONS,
  computeLifecycleDerived,
  canEditLifecycleStage,
  hasReachedLifecycleStage,
  lifecycleStageIndex,
  isExecutionClosedOut,
  PAYMENT_SUBMIT_STATUSES,
  financePaymentStatusLabel,
  paymentSubmitStatusLabel,
} from '../constants/campLifecycle';
import { validateRequestStageForm } from '../utils/validateRequestStage';
import { DOCTOR_SPECIALTY_OPTIONS, isRequestDateFarFromToday } from '../constants/doctorSpecialty';

function ReadOnlyField({ label, value }) {
  return (
    <label>
      {label}
      <input value={value ?? ''} readOnly className="input-readonly" />
    </label>
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
  onSubmitToFinance,
  submitFinanceBusy = false,
  onDownloadFinanceExport,
  downloadFinanceBusy = false,
  hcwContacts = [],
  contactsLoading = false,
  onValidationError,
  reachedLifecycleStage = 'request',
}) {
  const [docType, setDocType] = useState('doctor_form');
  const derived = useMemo(() => computeLifecycleDerived(form), [form]);
  const { options: specialtyOptions } = usePicklistOptions('camp.doctorSpecialty', DOCTOR_SPECIALTY_OPTIONS);
  const requestDateWarning = isRequestDateFarFromToday(form.requestDate);

  const stageDisabled = (stage) => stageReadOnly[stage] ?? false;

  function renderRequestStage() {
    const disabled = stageDisabled('request');
    return (
      <div className="form-grid">
        <p className="meta-text full camp-request-required-note">
          All request stage fields are required before the camp can be approved or move to Resource Assignment.
        </p>
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
        {requestDateWarning && (
          <p className="meta-text full camp-request-date-warning">
            Request date is more than 2 days from today. Confirm this is intentional.
          </p>
        )}
        <label>
          Camp Start Time
          <input type="time" value={form.startTime} onChange={(e) => updateField('startTime', e.target.value)} disabled={disabled} required />
        </label>
        <label>
          Camp End Time
          <input type="time" value={form.endTime} onChange={(e) => updateField('endTime', e.target.value)} disabled={disabled} required />
        </label>
        <ReadOnlyField
          label="Camp Duration"
          value={form.durationHours ? `${form.durationHours} hr` : '—'}
        />
        <ReadOnlyField label="Camp Slot" value={derived.campSlot} />
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
        <label className="full">
          Camp / Clinic Address
          <CampAddressAutocomplete
            disabled={disabled}
            required
            value={form.campAddress || ''}
            onChange={(value) => updateField('campAddress', value)}
            onPlaceSelected={(loc) => {
              updateFields?.({
                campAddress: loc.campAddress || form.campAddress,
                city: loc.city || form.city || '',
                pincode: loc.pincode || form.pincode || '',
                ...(form.hqManuallyEdited ? {} : { hq: loc.city || form.city || '' }),
              });
            }}
          />
        </label>
        <div className="full camp-location-grid">
          <CampLocationFields
            disabled={disabled}
            required
            value={{
              city: form.city || '',
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
          <label className="camp-location-hq">
            HQ
            <input
              value={form.hq}
              onChange={(e) => updateFields?.({ hq: e.target.value, hqManuallyEdited: true })}
              disabled={disabled}
              required
            />
          </label>
        </div>
        <label>
          Contact Person Name
          <input value={form.fieldPersonName} onChange={(e) => updateField('fieldPersonName', e.target.value)} disabled={disabled} required />
        </label>
        <label>
          Expected Patients
          <input type="number" min="1" value={form.expectedPatients} onChange={(e) => updateField('expectedPatients', Number(e.target.value))} disabled={disabled} required />
        </label>
        <label>
          Contact Person Number
          <input value={form.fieldPersonPhone} onChange={(e) => updateField('fieldPersonPhone', e.target.value)} disabled={disabled} required />
        </label>
        <label className="full">
          Remarks
          <textarea value={form.remarks} onChange={(e) => updateField('remarks', e.target.value)} disabled={disabled} rows={2} />
        </label>
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
    const executionClosedOut = isExecutionClosedOut(form.executionStatus);
    const docs = Array.isArray(form.executionDocuments) ? form.executionDocuments : [];
    const doctorForms = docs.filter((d) => d.docType === 'doctor_form').length;
    const patientForms = docs.filter((d) => d.docType === 'patient_form').length;

    function handleExecutionStatusChange(value) {
      if (isExecutionClosedOut(value)) {
        updateFields({
          executionStatus: value,
          chargeableStatus: '',
          inTime: '',
          outTime: '',
          kmRoundTrip: 0,
          attire: '',
          labCoat: '',
          patientsCount: 0,
          rxCount: 0,
        });
        return;
      }
      updateField('executionStatus', value);
    }

    return (
      <>
        <div className="form-grid">
          <SelectField
            label="Execution Status"
            value={form.executionStatus}
            onChange={handleExecutionStatusChange}
            options={EXECUTION_STATUSES}
            disabled={disabled}
          />
          {executionClosedOut ? (
            <label className="full">
              Cancellation / Rejection Reason
              <textarea
                rows={2}
                value={form.cancellationReason}
                onChange={(e) => updateField('cancellationReason', e.target.value)}
                disabled={disabled}
                required
              />
            </label>
          ) : null}
        </div>

        {executionClosedOut ? (
          <p className="meta-text camp-execution-closed-note">
            Execution is cancelled or rejected. No further execution details or documents are required.
          </p>
        ) : (
          <>
            <div className="form-grid">
              <SelectField label="Chargeable Status" value={form.chargeableStatus} onChange={(v) => updateField('chargeableStatus', v)} options={CHARGEABLE_STATUSES} disabled={disabled} />
              <label>
                In Time
                <input value={form.inTime} onChange={(e) => updateField('inTime', e.target.value)} disabled={disabled} placeholder="HH:MM" />
              </label>
              <label>
                Out Time
                <input value={form.outTime} onChange={(e) => updateField('outTime', e.target.value)} disabled={disabled} placeholder="HH:MM" />
              </label>
              <ReadOnlyField label="Total Hours (Auto)" value={derived.totalHours} />
              <ReadOnlyField label="Extra Hours (Auto)" value={derived.extraHours} />
              <label>
                KM (Round Trip)
                <input type="number" value={form.kmRoundTrip} onChange={(e) => updateField('kmRoundTrip', e.target.value)} disabled={disabled} />
              </label>
              <ReadOnlyField label="Punctuality (Auto)" value={derived.punctuality} />
              <SelectField label="Attire" value={form.attire} onChange={(v) => updateField('attire', v)} options={ATTIRE_CHECK_OPTIONS} disabled={disabled} />
              <SelectField label="Lab Coat" value={form.labCoat} onChange={(v) => updateField('labCoat', v)} options={ATTIRE_CHECK_OPTIONS} disabled={disabled} />
              <label>
                Patients Count
                <input type="number" value={form.patientsCount} onChange={(e) => updateField('patientsCount', Number(e.target.value))} disabled={disabled} />
              </label>
              <label>
                Rx Count
                <input type="number" value={form.rxCount} onChange={(e) => updateField('rxCount', Number(e.target.value))} disabled={disabled} />
              </label>
            </div>

            <section className="camp-lifecycle-docs">
              <h3>Execution Documents</h3>
              <p className="meta-text">Minimum 2 required: DF and PF ({doctorForms} doctor, {patientForms} patient uploaded)</p>
              {docs.length > 0 && (
                <ul className="camp-lifecycle-doc-list">
                  {docs.map((doc) => (
                    <li key={doc.id || doc.storedName}>
                      {doc.fileName || doc.storedName}
                      {' — '}
                      {EXECUTION_DOC_TYPES.find((t) => t.value === doc.docType)?.label || doc.docType}
                      {doc.url && (
                        <>
                          {' '}
                          <a href={doc.url} target="_blank" rel="noreferrer">View</a>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {campId && onUploadDocuments && (
                <div className="camp-lifecycle-doc-upload">
                  <SelectField label="Document type" value={docType} onChange={setDocType} options={EXECUTION_DOC_TYPES} disabled={disabled || uploadBusy} />
                  <label>
                    Upload files
                    <input
                      type="file"
                      multiple={docType !== 'gps_selfie'}
                      accept={docType === 'gps_selfie' ? 'image/*' : undefined}
                      disabled={disabled || uploadBusy}
                      onChange={(e) => {
                        const files = e.target.files;
                        if (files?.length) onUploadDocuments(files, docType);
                        e.target.value = '';
                      }}
                    />
                  </label>
                  {docType === 'gps_selfie' && (
                    <p className="meta-text">Image only. Attaches the GPS selfie next to In Time.</p>
                  )}
                </div>
              )}
            </section>
          </>
        )}
      </>
    );
  }

  function renderFinancialStage() {
    const disabled = stageDisabled('financial');
    const submitted = Boolean(form.submittedToFinanceAt);
    return (
      <div className="form-grid">
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
                  className="btn btn-secondary btn-compact"
                  disabled={downloadFinanceBusy}
                  onClick={onDownloadFinanceExport}
                >
                  {downloadFinanceBusy ? 'Downloading…' : 'Download Excel'}
                </button>
              </div>
            )}
          </div>
        )}

        {campId && onSubmitToFinance && !submitted && !disabled && (
          <div className="camp-finance-submit-actions full">
            <button
              type="button"
              className="btn btn-primary"
              disabled={submitFinanceBusy || !form.paymentSubmitStatus}
              onClick={onSubmitToFinance}
            >
              {submitFinanceBusy ? 'Submitting…' : 'Submit to Finance One'}
            </button>
            <p className="meta-text">
              Save payout details and send to Finance One for payment processing.
            </p>
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

  return (
    <div className="camp-lifecycle-form">
      <CampLifecycleStepper
        activeStage={activeStage}
        campStatus={campStatus}
        reachedLifecycleStage={reachedLifecycleStage}
        onSelect={(stage) => {
          if (!hasReachedLifecycleStage(reachedLifecycleStage, stage)) {
            onValidationError?.('Complete earlier stages before opening this section.');
            return;
          }
          const movingForward = lifecycleStageIndex(stage) > lifecycleStageIndex(activeStage);
          if (movingForward && activeStage === 'request') {
            const requestErrors = validateRequestStageForm(form);
            if (requestErrors.length) {
              onValidationError?.(requestErrors[0]);
              return;
            }
          }
          if (!canEditLifecycleStage(campStatus, stage, reachedLifecycleStage)) {
            onValidationError?.('This stage cannot be edited for the current camp status.');
            return;
          }
          onStageChange(stage);
        }}
      />
      <div className="camp-lifecycle-panel">
        {panels[activeStage]?.()}
      </div>
    </div>
  );
}
