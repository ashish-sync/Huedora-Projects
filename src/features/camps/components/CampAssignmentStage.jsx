import { useState } from 'react';
import { copyCampAssignmentDetails } from '../utils/campAssignmentCopy';
import { isCampDateDueForExecution } from '../utils/campAssignmentActions.js';
import { CampHcwAssignPicker } from './CampHcwAssignPicker';
import { CampHireRequestButton } from './CampHireRequestButton';
import { HcwSameDayCampsPanel } from './HcwSameDayCampsPanel';

function ReadOnlyField({ label, value }) {
  return (
    <label>
      {label}
      <input value={value ?? ''} readOnly className="input-readonly" />
    </label>
  );
}

export function CampAssignmentStage({
  form,
  updateFields,
  hcwContacts = [],
  contactsLoading = false,
  clientMasterProfessions = [],
  clientMasterProfession = '',
  clientMasterLoading = false,
  clientMasterHcwGap = '',
  disabled = false,
  campStatus = 'pending_review',
  excludeCampId = '',
}) {
  const [copyState, setCopyState] = useState('');
  const isTerminal = ['cancelled', 'rejected'].includes(campStatus);
  const isAssigned = form.assignmentDecision === 'assign'
    && (form.assignmentStatus === 'Assigned'
      || Boolean(form.hcwContactId)
      || form.lifecycleStage === 'execution');
  const fieldsDisabled = disabled || isTerminal;
  const canCopyDetails = Boolean(form.hcwName || form.hcwContactId);
  const canRaiseHireRequest = !isTerminal;

  async function handleCopyDetails() {
    const didCopy = await copyCampAssignmentDetails(form);
    if (!didCopy) return;
    setCopyState('copied');
    window.setTimeout(() => setCopyState(''), 2000);
  }

  if (campStatus !== 'approved' && !isTerminal) {
    return (
      <p className="meta-text camp-assignment-intro">
        This camp must be <strong>approved</strong> before a resource can be assigned.
      </p>
    );
  }

  function handleSelect(nextFields) {
    updateFields?.({
      ...nextFields,
      assignmentDecision: nextFields.hcwContactId ? 'assign' : '',
      assignmentRefusalReason: '',
    });
  }

  if (isAssigned) {
    const inExecution = form.lifecycleStage === 'execution'
      || isCampDateDueForExecution(form);
    return (
      <div className="camp-assignment-stage">
        <div className="camp-assignment-toolbar">
          <p className="meta-text camp-assignment-note">
            {inExecution
              ? 'HCW assigned. This camp is in the Execution stage (opens one day before the camp date).'
              : 'HCW assigned. This camp stays in Assignment until one day before the camp date, then moves to Execution.'}
          </p>
          {canRaiseHireRequest ? (
            <CampHireRequestButton
              form={form}
              professions={clientMasterProfessions.length
                ? clientMasterProfessions
                : clientMasterProfession}
              label="Raise hiring request"
            />
          ) : null}
        </div>
        <div className="form-grid camp-assignment-assign-panel">
          <ReadOnlyField label="HCW Category" value={form.hcwCategory || '—'} />
          <ReadOnlyField label="HCW Name" value={form.hcwName || '—'} />
          <ReadOnlyField label="HCW Contact" value={form.hcwContact || '—'} />
          {canCopyDetails ? (
            <div className="camp-assignment-copy-wrap full">
              <button
                type="button"
                className="btn secondary btn-compact"
                onClick={handleCopyDetails}
              >
                {copyState === 'copied' ? 'Copied' : 'Copy details'}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  if (isTerminal) {
    return (
      <p className="meta-text camp-assignment-note">
        Assignment closed: {form.assignmentRefusalReason || form.cancellationReason || campStatus}.
      </p>
    );
  }

  return (
    <div className="camp-assignment-stage">
      <div className="camp-assignment-toolbar">
        <p className="meta-text camp-assignment-intro">
          Select resource type, state, and city to find Contact Directory healthcare workers that match
          this Client’s Healthcare Worker role in Client Master.
          Same HCW on the same date needs at least 1 hour 30 minutes between one camp’s end and the next start
          (e.g. 8:00–14:00 → next earliest 15:30).
          Before assignment you can refuse the camp. After assignment, only cancel by Tylo or Client is allowed.
        </p>
        <CampHireRequestButton
          form={form}
          professions={clientMasterProfessions.length
            ? clientMasterProfessions
            : clientMasterProfession}
          disabled={fieldsDisabled}
          variant="button"
          label="Raise hiring request"
        />
      </div>
      <CampHcwAssignPicker
        hcwContacts={hcwContacts}
        contactsLoading={contactsLoading}
        disabled={fieldsDisabled}
        selectedContactId={form.hcwContactId || ''}
        clientMasterProfessions={clientMasterProfessions}
        clientMasterProfession={clientMasterProfession}
        clientMasterLoading={clientMasterLoading}
        clientMasterHcwGap={clientMasterHcwGap}
        onSelect={handleSelect}
      />
      {form.hcwContactId ? (
        <HcwSameDayCampsPanel
          hcwContactId={form.hcwContactId}
          hcwName={form.hcwName}
          campDate={form.campDate}
          excludeCampId={excludeCampId}
          excludeCampKey={form.campId}
        />
      ) : null}
    </div>
  );
}
