import { useMemo, useState } from 'react';
import PinLocationLookup from '../../../components/ui/PinLocationLookup.jsx';
import { CampNameSelect } from './CampNameSelect';
import { DateInput } from './DateInput';
import { CampAssignmentStage } from './CampAssignmentStage';
import { CampLifecycleStepper } from './CampLifecycleStepper';
import {
  CAMP_SOURCE_OPTIONS,
  CHARGEABLE_STATUSES,
  EXECUTION_DOC_TYPES,
  EXECUTION_STATUSES,
  QUALITY_RATINGS,
  computeLifecycleDerived,
  canEditLifecycleStage,
  hasReachedLifecycleStage,
  lifecycleStageIndex,
} from '../constants/campLifecycle';
import { validateRequestStageForm } from '../utils/validateRequestStage';

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
  hcwContacts = [],
  contactsLoading = false,
  clientName = '',
  onValidationError,
  reachedLifecycleStage = 'request',
}) {
  const [docType, setDocType] = useState('doctor_form');
  const derived = useMemo(() => computeLifecycleDerived(form), [form]);

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
        <ReadOnlyField
          label="Request Date"
          value={form.requestDate || ''}
        />
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
        <label className="full">
          Camp Address
          <input value={form.campAddress} onChange={(e) => updateField('campAddress', e.target.value)} disabled={disabled} required />
        </label>
        <div className="full camp-location-grid">
          <PinLocationLookup
            disabled={disabled}
            required
            value={{
              pinCode: form.pincode || '',
              city: form.city,
              state: form.state,
              zone: form.zone || '',
              stateId: form.stateId || '',
              cityId: form.cityId || '',
            }}
            onChange={(loc) => {
              updateFields?.({
                pincode: loc.pinCode || '',
                city: loc.city || '',
                state: loc.state || '',
                stateId: loc.stateId || '',
                cityId: loc.cityId || '',
                zone: loc.zone || '',
              });
            }}
          />
          <label className="camp-location-hq">
            HQ
            <input value={form.hq} onChange={(e) => updateField('hq', e.target.value)} disabled={disabled} required />
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
        clientName={clientName}
        disabled={stageDisabled('assignment')}
        campStatus={campStatus}
      />
    );
  }

  function renderExecutionStage() {
    const disabled = stageDisabled('execution');
    const docs = Array.isArray(form.executionDocuments) ? form.executionDocuments : [];
    const doctorForms = docs.filter((d) => d.docType === 'doctor_form').length;
    const patientForms = docs.filter((d) => d.docType === 'patient_form').length;

    return (
      <>
        <div className="form-grid">
          <SelectField label="Execution Status" value={form.executionStatus} onChange={(v) => updateField('executionStatus', v)} options={EXECUTION_STATUSES} disabled={disabled} />
          <label className="full">
            Cancellation / Rejection Reason
            <textarea rows={2} value={form.cancellationReason} onChange={(e) => updateField('cancellationReason', e.target.value)} disabled={disabled} />
          </label>
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
          <SelectField label="Punctuality" value={form.punctuality} onChange={(v) => updateField('punctuality', v)} options={QUALITY_RATINGS} disabled={disabled} />
          <SelectField label="Attire" value={form.attire} onChange={(v) => updateField('attire', v)} options={QUALITY_RATINGS} disabled={disabled} />
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
          <p className="meta-text">Minimum 2 required: Doctor Form and Patient Form ({doctorForms} doctor, {patientForms} patient uploaded)</p>
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
                  multiple
                  disabled={disabled || uploadBusy}
                  onChange={(e) => {
                    const files = e.target.files;
                    if (files?.length) onUploadDocuments(files, docType);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
          )}
        </section>
      </>
    );
  }

  function renderFinancialStage() {
    const disabled = stageDisabled('financial');
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
        <ReadOnlyField label="Total Payout (Auto)" value={derived.totalPayout} />
        <label>
          Paid Amount
          <input type="number" value={form.paidAmount} onChange={(e) => updateField('paidAmount', Number(e.target.value))} disabled={disabled} />
        </label>
        <ReadOnlyField label="Balance (Auto)" value={derived.balance} />
        <label>
          Transaction ID / UTR
          <input value={form.transactionId} onChange={(e) => updateField('transactionId', e.target.value)} disabled={disabled} />
        </label>
        <label className="full">
          Payment Remark
          <textarea rows={2} value={form.paymentRemark} onChange={(e) => updateField('paymentRemark', e.target.value)} disabled={disabled} />
        </label>
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
