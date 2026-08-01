import { useState } from 'react';
import { contactToHcwFields } from '../utils/campHcwContact';
import { copyCampAssignmentDetails } from '../utils/campAssignmentCopy';
import { CampHcwAssignPicker } from './CampHcwAssignPicker';

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
  clientMasterProfession = '',
  clientMasterLoading = false,
  disabled = false,
  campStatus = 'pending_review',
}) {
  const [copyState, setCopyState] = useState('');
  const isTerminal = ['cancelled', 'rejected'].includes(campStatus);
  const isAssigned = form.assignmentDecision === 'assign'
    && (form.assignmentStatus === 'Assigned'
      || Boolean(form.hcwContactId)
      || form.lifecycleStage === 'execution');
  const fieldsDisabled = disabled || isTerminal;
  const canCopyDetails = Boolean(form.hcwName || form.hcwContactId);

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
    return (
      <div className="camp-assignment-stage">
        <p className="meta-text camp-assignment-note">
          HCW assigned. This camp has moved to the Execution stage.
        </p>
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
      <p className="meta-text camp-assignment-intro">
        Select resource type, state, and city to find the healthcare worker configured for this client in Client Master.
        Before assignment you can refuse the camp. After assignment, only cancel by TCPL or Client is allowed.
      </p>
      <CampHcwAssignPicker
        hcwContacts={hcwContacts}
        contactsLoading={contactsLoading}
        disabled={fieldsDisabled}
        selectedContactId={form.hcwContactId || ''}
        clientMasterProfession={clientMasterProfession}
        clientMasterLoading={clientMasterLoading}
        onSelect={handleSelect}
      />
    </div>
  );
}
