import { useMemo, useState } from 'react';
import {
  ASSIGNMENT_DECISIONS,
  ASSIGNMENT_REFUSAL_REASONS,
} from '../constants/campLifecycle';
import { contactToHcwFields, filterHcwContacts } from '../utils/campHcwContact';
import { copyCampAssignmentDetails } from '../utils/campAssignmentCopy';

function DecisionToggle({ value, onChange, disabled }) {
  return (
    <div className="camp-assignment-decision" role="radiogroup" aria-label="Assignment action">
      {ASSIGNMENT_DECISIONS.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            className={`camp-assignment-decision-btn${active ? ' is-active' : ''}`}
            disabled={disabled}
            aria-pressed={active}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

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
  updateField,
  updateFields,
  hcwContacts = [],
  contactsLoading = false,
  disabled = false,
  campStatus = 'pending_review',
  clientName = '',
}) {
  const [copyState, setCopyState] = useState('');
  const hcwOptions = useMemo(() => filterHcwContacts(hcwContacts), [hcwContacts]);
  const isTerminal = ['cancelled', 'rejected'].includes(campStatus);
  const isAssigned = form.assignmentDecision === 'assign'
    && (form.assignmentStatus === 'Assigned' || form.lifecycleStage === 'execution');
  const isRefused = form.assignmentDecision === 'refuse' && isTerminal;
  const fieldsDisabled = disabled || isTerminal;
  const canCopyDetails =
    form.assignmentDecision === 'assign' && Boolean(form.hcwName || form.hcwContactId);

  async function handleCopyDetails() {
    const didCopy = await copyCampAssignmentDetails(form, { clientName });
    if (!didCopy) return;
    setCopyState('copied');
    window.setTimeout(() => setCopyState(''), 2000);
  }

  if (campStatus !== 'approved' && !isTerminal) {
    return (
      <p className="meta-text camp-assignment-intro">
        This camp must be <strong>approved</strong> before you can assign or refuse a resource.
      </p>
    );
  }

  function handleDecision(decision) {
    if (fieldsDisabled) return;
    if (decision === 'assign') {
      updateFields?.({
        assignmentDecision: 'assign',
        assignmentRefusalReason: '',
        assignmentStatus: 'Pending',
      });
      return;
    }
    updateFields?.({
      assignmentDecision: 'refuse',
      hcwContactId: '',
      hcwCategory: '',
      hcwName: '',
      hcwContact: '',
      assignmentStatus: 'Pending',
    });
  }

  function handleContactPick(contactId) {
    const contact = hcwOptions.find((c) => String(c._id) === String(contactId));
    updateFields?.({
      ...contactToHcwFields(contact),
      assignmentDecision: 'assign',
      assignmentRefusalReason: '',
    });
  }

  if (isAssigned && !fieldsDisabled) {
    // assigned and still editable — rare; show filled state
  }

  return (
    <div className="camp-assignment-stage">
      <p className="meta-text camp-assignment-intro">
        Choose <strong>Assign</strong> to allocate an HCW from Contact Directory and move to Camp Execution,
        or <strong>Refuse</strong> to close the camp at this stage.
      </p>

      {!isTerminal && (
        <div className="camp-assignment-decision-wrap">
          <span className="camp-assignment-decision-label">Action</span>
          <DecisionToggle
            value={form.assignmentDecision}
            onChange={handleDecision}
            disabled={fieldsDisabled}
          />
        </div>
      )}

      {form.assignmentDecision === 'assign' && (
        <div className="form-grid camp-assignment-assign-panel">
          <label className="full">
            HCW from Contact Directory
            <select
              value={form.hcwContactId || ''}
              onChange={(e) => handleContactPick(e.target.value)}
              disabled={fieldsDisabled || contactsLoading}
              required
            >
              <option value="">
                {contactsLoading ? 'Loading contacts…' : 'Select healthcare worker'}
              </option>
              {hcwOptions.map((contact) => (
                <option key={contact._id} value={contact._id}>
                  {contact.name}
                  {contact.profession ? ` · ${contact.profession}` : ''}
                  {contact.city ? ` · ${contact.city}` : ''}
                </option>
              ))}
            </select>
          </label>
          <ReadOnlyField label="HCW Category" value={form.hcwCategory || '—'} />
          <ReadOnlyField label="HCW Name" value={form.hcwName || '—'} />
          <ReadOnlyField label="HCW Contact" value={form.hcwContact || '—'} />
          {!hcwOptions.length && !contactsLoading ? (
            <p className="meta-text full">
              No healthcare workers found in Contact Directory. Add Resource or Healthcare Worker contacts first.
            </p>
          ) : null}
          {canCopyDetails ? (
            <div className="camp-assignment-copy-wrap full">
              <button
                type="button"
                className="btn btn-secondary btn-compact"
                onClick={handleCopyDetails}
              >
                {copyState === 'copied' ? 'Copied' : 'Copy details'}
              </button>
              <p className="meta-text camp-assignment-copy-hint">
                Copies client, clinic, contact, and HCW details for WhatsApp or email.
              </p>
            </div>
          ) : null}
        </div>
      )}

      {form.assignmentDecision === 'refuse' && (
        <div className="form-grid camp-assignment-refuse-panel">
          <label className="full">
            Refusal reason
            <select
              value={form.assignmentRefusalReason || ''}
              onChange={(e) => updateField('assignmentRefusalReason', e.target.value)}
              disabled={fieldsDisabled}
              required
            >
              <option value="">Select reason</option>
              {ASSIGNMENT_REFUSAL_REASONS.map((reason) => (
                <option key={reason} value={reason}>{reason}</option>
              ))}
            </select>
          </label>
          <p className="meta-text full">
            The camp will not proceed beyond Resource Assignment after you save with a refusal reason.
          </p>
        </div>
      )}

      {isAssigned && (
        <p className="meta-text camp-assignment-note">
          HCW assigned. This camp has moved to the Execution stage.
        </p>
      )}

      {isRefused && (
        <p className="meta-text camp-assignment-note">
          Assignment closed: {form.assignmentRefusalReason || form.cancellationReason || campStatus}.
        </p>
      )}
    </div>
  );
}
