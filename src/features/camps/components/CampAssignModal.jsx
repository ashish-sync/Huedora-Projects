import { useEffect, useState } from 'react';
import FeedbackBanner from '../../../components/ui/FeedbackBanner.jsx';
import { createPortal } from 'react-dom';
import { contactToHcwFields } from '../utils/campHcwContact';
import { campApi } from '../campOpsApi';
import { CampHcwAssignPicker } from './CampHcwAssignPicker';

export function CampAssignModal({
  camp,
  hcwContacts = [],
  contactsLoading = false,
  onClose,
  onSaved,
}) {
  const [fields, setFields] = useState(() => contactToHcwFields(
    hcwContacts.find((c) => String(c._id) === String(camp?.hcwContactId)),
  ));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleEscape(event) {
      if (event.key === 'Escape' && !saving) onClose?.();
    }

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, saving]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!fields.hcwContactId) {
      setError('Select a healthcare worker');
      return;
    }
    if (!fields.hcwCategory || !fields.hcwName || !fields.hcwContact) {
      setError('HCW Category, Name, and Contact are required');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const { data } = await campApi.update(camp._id, {
        assignmentDecision: 'assign',
        assignmentRefusalReason: '',
        hcwContactId: fields.hcwContactId,
        hcwCategory: fields.hcwCategory,
        hcwName: fields.hcwName,
        hcwContact: fields.hcwContact,
        editingStage: 'assignment',
        lifecycleStage: 'assignment',
        lifecycleOnly: true,
      });
      onSaved?.(data?.data || data);
    } catch (err) {
      setError(err?.message || 'Failed to assign resource');
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div className="camp-ops-root camp-info-portal-root">
      <div className="modal-overlay camp-info-modal-overlay" onClick={onClose}>
        <form
          className="modal-card camp-assign-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="camp-assign-modal-title"
          onClick={(event) => event.stopPropagation()}
          onSubmit={handleSubmit}
        >
          <header className="camp-approval-issues-header">
            <div>
              <h2 id="camp-assign-modal-title">Assign resource</h2>
              {camp?.campId && <p className="camp-approval-issues-subtitle">{camp.campId}</p>}
            </div>
            <button type="button" className="camp-info-modal-close" aria-label="Close" onClick={onClose}>
              ×
            </button>
          </header>

          <div className="camp-assign-modal-body">
            {error && <FeedbackBanner variant="error" className="camp-assign-modal-error">{error}</FeedbackBanner>}
            <p className="camp-approval-issues-lead">
              Filter Healthcare Worker contacts by resource type and profession, then pick the person to assign.
              The camp moves to Execution after assignment.
            </p>
            <CampHcwAssignPicker
              hcwContacts={hcwContacts}
              contactsLoading={contactsLoading}
              disabled={saving}
              selectedContactId={fields.hcwContactId}
              onSelect={(nextFields) => {
                setFields(nextFields);
                setError('');
              }}
            />
          </div>

          <footer className="camp-assign-modal-footer">
            <button type="button" className="btn secondary btn-compact" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-compact" disabled={saving || contactsLoading}>
              {saving ? 'Assigning…' : 'Assign'}
            </button>
          </footer>
        </form>
      </div>
    </div>,
    document.body,
  );
}
