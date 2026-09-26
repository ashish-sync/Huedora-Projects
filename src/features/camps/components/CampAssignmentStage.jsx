import { useState } from 'react';
import { Check, ClipboardCopy, Clock3, Info } from 'lucide-react';
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
  onHcwPersonSearch = null,
  onHcwFiltersChange = null,
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
  const hireProfessions = clientMasterProfessions.length
    ? clientMasterProfessions
    : clientMasterProfession;

  async function handleCopyDetails() {
    const didCopy = await copyCampAssignmentDetails(form, { clientMasterRecords });
    if (!didCopy) return;
    setCopyState('copied');
    window.setTimeout(() => setCopyState(''), 2000);
  }

  if (campStatus !== 'approved' && !isTerminal) {
    return (
      <div className="camp-assignment-stage">
        <div className="camp-assignment-callout camp-assignment-callout--wait" role="status">
          <Info size={16} strokeWidth={2} aria-hidden="true" />
          <p>
            This camp must be <strong>approved</strong> before a resource can be assigned.
          </p>
        </div>
      </div>
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
      <div className="camp-assignment-stage">
        <div className="camp-assignment-callout" role="status">
          <Info size={16} strokeWidth={2} aria-hidden="true" />
          <p>
            Assignment closed:
            {' '}
            {form.assignmentRefusalReason || form.cancellationReason || campStatus}.
          </p>
        </div>
      </div>
    );
  }

  if (isAssigned && !reassigning) {
    const inExecution = form.lifecycleStage === 'execution'
      || isCampDateDueForExecution(form);
    return (
      <div className="camp-assignment-stage">
        <header className="camp-assignment-header">
          <div className="camp-assignment-header-copy">
            <h3 className="camp-assignment-title">Resource assigned</h3>
            <p className="camp-assignment-subtitle">
              {financeLocked
                ? 'Locked after Finance submit — the HCW cannot be changed.'
                : inExecution
                  ? 'This camp is in Execution. You can still change the healthcare worker if needed.'
                  : 'Assigned camps move to Execution. Change the HCW below if needed.'}
            </p>
          </div>
          <div className="camp-assignment-header-actions">
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
                professions={hireProfessions}
                label="Raise hiring request"
              />
            ) : null}
          </div>
        </header>

        <div className="camp-assignment-panel">
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
      </div>
    );
  }

  return (
    <div className="camp-assignment-stage">
      <header className="camp-assignment-header">
        <div className="camp-assignment-header-copy">
          <h3 className="camp-assignment-title">
            {reassigning ? 'Change healthcare worker' : 'Assign healthcare worker'}
          </h3>
          <p className="camp-assignment-subtitle">
            {reassigning
              ? 'Pick a different Contact Directory match, then save the camp.'
              : 'Filter by resource type, state, and city. Matches use this client’s Healthcare Worker role from Client Master.'}
          </p>
        </div>
        <div className="camp-assignment-header-actions">
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
            professions={hireProfessions}
            disabled={fieldsDisabled}
            variant="button"
            label="Raise hiring request"
          />
        </div>
      </header>

      <ul className="camp-assignment-tips" aria-label="Assignment guidelines">
        <li>
          <Clock3 size={14} strokeWidth={2} aria-hidden="true" />
          <span>
            Same HCW, same day: keep at least
            {' '}
            <strong>30 minutes</strong>
            {' '}
            between camps (e.g. 14:00 end → next from 14:30). Shorter gaps need Reporting Manager approval.
          </span>
        </li>
        <li>
          <Info size={14} strokeWidth={2} aria-hidden="true" />
          <span>
            Before assignment you can
            {' '}
            <strong>refuse</strong>
            .
            After assignment, only cancel by Tylo or Client.
          </span>
        </li>
      </ul>

      <div className="camp-assignment-panel">
        <div className="camp-assignment-panel-label">Find contact</div>
        <CampHcwAssignPicker
          hcwContacts={hcwContacts}
          contactsLoading={contactsLoading}
          onPersonSearch={onHcwPersonSearch}
          onFiltersChange={onHcwFiltersChange}
          campState={form.state || ''}
          disabled={fieldsDisabled}
          selectedContactId={form.hcwContactId || ''}
          clientMasterProfessions={clientMasterProfessions}
          clientMasterProfession={clientMasterProfession}
          clientMasterLoading={clientMasterLoading}
          clientMasterHcwGap={clientMasterHcwGap}
          onSelect={handleSelect}
        />
      </div>

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
