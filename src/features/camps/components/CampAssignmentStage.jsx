import { useState } from 'react';
import { Check, ClipboardCopy } from 'lucide-react';
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

function snapshotAssignedHcw(form = {}) {
  return {
    hcwContactId: form.hcwContactId || '',
    hcwCategory: form.hcwCategory || '',
    hcwName: form.hcwName || '',
    hcwContact: form.hcwContact || '',
    assignmentDecision: form.assignmentDecision || 'assign',
    assignmentStatus: form.assignmentStatus || 'Assigned',
    assignmentRefusalReason: form.assignmentRefusalReason || '',
  };
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
  clientMasterRecords = [],
  disabled = false,
  campStatus = 'pending_review',
  excludeCampId = '',
}) {
  const [copyState, setCopyState] = useState('');
  const [reassigning, setReassigning] = useState(false);
  const [assignedSnapshot, setAssignedSnapshot] = useState(null);
  const isTerminal = ['cancelled', 'rejected'].includes(campStatus);
  const isAssigned = form.assignmentDecision === 'assign'
    && (form.assignmentStatus === 'Assigned'
      || Boolean(form.hcwContactId)
      || form.lifecycleStage === 'execution');
  const financeLocked = Boolean(form.submittedToFinanceAt);
  const fieldsDisabled = disabled || isTerminal || financeLocked;
  const canCopyDetails = Boolean(form.hcwName || form.hcwContactId);
  const canRaiseHireRequest = !isTerminal;
  const canChangeHcw = isAssigned && !fieldsDisabled;

  async function handleCopyDetails() {
    const didCopy = await copyCampAssignmentDetails(form, { clientMasterRecords });
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
      assignmentDecision: nextFields.hcwContactId ? 'assign' : (reassigning ? 'assign' : ''),
      assignmentStatus: nextFields.hcwContactId || reassigning ? 'Assigned' : form.assignmentStatus,
      assignmentRefusalReason: '',
    });
  }

  function startReassign() {
    setAssignedSnapshot(snapshotAssignedHcw(form));
    setReassigning(true);
  }

  function cancelReassign() {
    if (assignedSnapshot) {
      updateFields?.(assignedSnapshot);
    }
    setAssignedSnapshot(null);
    setReassigning(false);
  }

  if (isTerminal) {
    return (
      <p className="meta-text camp-assignment-note">
        Assignment closed: {form.assignmentRefusalReason || form.cancellationReason || campStatus}.
      </p>
    );
  }

  if (isAssigned && !reassigning) {
    const inExecution = form.lifecycleStage === 'execution'
      || isCampDateDueForExecution(form);
    return (
      <div className="camp-assignment-stage">
        <div className="camp-assignment-toolbar">
          <p className="meta-text camp-assignment-note">
            {financeLocked
              ? 'HCW assigned. Resource cannot be changed after Finance submit.'
              : inExecution
                ? 'HCW assigned. You can change the healthcare worker if needed; this camp is in Execution.'
                : 'HCW assigned. You can change the healthcare worker if needed. This camp stays in Assignment until one day before the camp date.'}
          </p>
          <div className="camp-assignment-toolbar-actions">
            {canChangeHcw ? (
              <button
                type="button"
                className="btn secondary btn-compact"
                onClick={startReassign}
              >
                Change HCW
              </button>
            ) : null}
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
        </div>
        <div className="form-grid camp-assignment-assign-panel">
          <ReadOnlyField label="HCW Category" value={form.hcwCategory || '—'} />
          <ReadOnlyField label="HCW Name" value={form.hcwName || '—'} />
          <ReadOnlyField label="HCW Contact" value={form.hcwContact || '—'} />
          {canCopyDetails ? (
            <div className="camp-assignment-copy-wrap full">
              <button
                type="button"
                className={`btn secondary btn-compact camp-assignment-copy-btn${copyState === 'copied' ? ' is-copied' : ''}`}
                onClick={handleCopyDetails}
              >
                {copyState === 'copied' ? (
                  <Check size={16} strokeWidth={2.25} aria-hidden="true" />
                ) : (
                  <ClipboardCopy size={16} strokeWidth={2} aria-hidden="true" />
                )}
                {copyState === 'copied' ? 'Copied' : 'Copy details'}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="camp-assignment-stage">
      <div className="camp-assignment-toolbar">
        <p className="meta-text camp-assignment-intro">
          {reassigning
            ? 'Select a different healthcare worker, then save the camp to apply the change. Same-day assignments should keep a 30-minute gap.'
            : 'Select resource type, state, and city to find Contact Directory healthcare workers that match this Client’s Healthcare Worker role in Client Master. Same HCW on the same date should keep at least 30 minutes between one camp’s end and the next start (e.g. 8:00–14:00 → next earliest 14:30). A shorter gap can proceed but needs Reporting Manager approval. Before assignment you can refuse the camp. After assignment, only cancel by Tylo or Client is allowed.'}
        </p>
        <div className="camp-assignment-toolbar-actions">
          {reassigning ? (
            <button
              type="button"
              className="btn secondary btn-compact"
              onClick={cancelReassign}
            >
              Cancel change
            </button>
          ) : null}
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
